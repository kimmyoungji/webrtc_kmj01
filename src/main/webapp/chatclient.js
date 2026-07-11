// WebSocket and WebRTC based multi-user chat sample with two-way video
// calling, including use of TURN if applicable or necessary.
//
// This file contains the JavaScript code that implements the client-side
// features for connecting and managing chat and video calls.
//
// To read about how this sample works:  http://bit.ly/webrtc-from-chat
//
// Any copyright is dedicated to the Public Domain.
// http://creativecommons.org/publicdomain/zero/1.0/
//
// modified by myoungjikim and claude - 2026.03 ~ 2026.09

"use strict";

// hostname
var myHostname = window.location.hostname;
if (!myHostname) myHostname = "localhost";

// adapter.js가 덮어쓰기 이전 브라우저의 원래 getStats 함수가져오기 (adapter.js의 getStats는 내부적으로 수정될 우려가 있음)
const _nativeGetStats = RTCPeerConnection.prototype.getStats;

// Audio/Visual 하드웨어 데이터 스트림 설정
var mediaConstraints = {
  audio: true,   
  video: {
    aspectRatio: {
      ideal: 1.333333
    }
  }
};

/* 전역 변수 */
let myUsername = null;		  // 내 사용자명
let targetUsername = null;    // 타겟 사용자명

let connection = null;  	  // websocket 연결 객체 저장 변수
let myPeerConnection = null;  // webrtc 연결 객체 저장 변수

let webcamStream = null; 	  // 웹캠 데이터 스트림 객체 저장

let audioTransceiver = null;  // webrtc 연결의 음성 데이터 송수신 객체 저장
let videoTransceiver = null;  // webrtc 연결의 영상 데이터 송수신 객체 저장

let makingAnswer = false; 	  // 응답 생성 중 여부
       
let localICECandidates = [];  // 로컬 ice 후보 배열
let remoteICECandidates = []; // 원격 ice 후보 배열

// Output logging information to console.
function log(text) {
  var time = new Date();
  console.log("[" + time.toLocaleTimeString() + "] " + text);
}

// Output an error message to console.
function log_error(text) {
  var time = new Date();
  console.trace("[" + time.toLocaleTimeString() + "] " + text);
}

// 페이지 로드 시 자동으로 WebSocket 연결 수립
// 사전 조건: chat.html에서 이미 로드됨, auth.js를 통해 토큰 확인됨
window.addEventListener('DOMContentLoaded', () => {
  connect();  // 쿠키는 브라우저가 자동 전송 → 인증 실패 시 onclose에서 처리
});

// Send a JavaScript object by converting it to JSON and sending
// it as a message on the WebSocket connection.
function sendToServer(msg) {
  var msgJSON = JSON.stringify(msg);

  log("sending Message: ");
  console.dir(msg);
  connection.send(msgJSON);
}

// Web Socket 연결
// Open and configure the connection to the WebSocket server.
// 페이지 로드 시 자동으로 호출되거나, 재연결 시 호출됨
function connect() {
	myUsername = sessionStorage.getItem('username');
	
	let serverUrl;
	let scheme = "ws";

  // https 연결일 경우 wss로 scheme 변경
  if (document.location.protocol === "https:") {
    scheme += "s";
  }
  
  // pathname에서 마지막 세그먼트를 제거하여 컨텍스트 패스를 얻기
  var contextPath = window.location.pathname.replace(/\/[^/]*$/, "");
  
  // serverUrl 구성
  serverUrl = scheme + "://" + window.location.host + contextPath + "/ws"
  
  // 웹소켓 연결 객체 생성
  connection = new WebSocket(serverUrl);

  connection.onopen = function(evt) {
    log("WebSocket Connection opened (Signalling Server Connection Established)");
    log(`Connecting to server: ${serverUrl}`);
  };

  connection.onerror = function(evt) {
    console.dir(evt);
  }
  
  // onclose event
  connection.onclose = function(evt) {
    log('WebSocket closed: ' + evt.code + ' ' + evt.reason);
    
    // 토큰 관련 오류 처리
    if (evt.code === 1002 || evt.reason === 'Invalid token' || evt.reason === 'Username already in use') {
      alert('연결이 종료되었습니다: ' + evt.reason + '\n다시 로그인해주세요.');
      performLogout(true);
    } else if (evt.reason) {
      alert('WebSocket 연결이 종료되었습니다: ' + evt.reason);
    }
  }

  // onmessage event
  connection.onmessage = function(evt) {
    var msg = JSON.parse(evt.data);
	
    log("Message received: ");
    console.dir(msg);

    switch(msg.type) {

      case "userlist":      // Received an updated user list
        handleUserlistMsg(msg);
        break;

      // Signaling messages: these messages are used to trade WebRTC
      // signaling information during negotiations leading up to a video
      // call.

      case "video-offer":  // Invitation and offer to chat
        handleVideoOfferMsg(msg);
        break;

      case "video-answer":  // Callee has answered our offer
        handleVideoAnswerMsg(msg);
        break;

      case "new-ice-candidate": // A new ICE candidate has been received
        handleNewICECandidateMsg(msg);
        break;

      case "hang-up": // The other peer has hung up the call
        handleHangUpMsg(msg);
        break;

      // Unknown message; output to console for debugging.

      default:
        log_error(msg);
    }
  };
}

/**
 * RTCPeerConnection 생성
 * 주요 동작:
 * 1) get turn-credentials (turn 서버 연결정보)
 * 2) new RTCPeerConnection()
 * 3) 이벤트 헨들러 등록
 */
async function createPeerConnection() {
	// turn-credentials (turn 서버 연결정보) 가져오기
	const contextPath = window.location.pathname.replace(/\/[^/]*$/, "");
  	const credResponse = await authorizedFetch(contextPath + '/api/turn-credentials');
  	const credData = await credResponse.json();
	
	// RTCPeerConnection 생성
	log("- Creating PeerConnection with dynamic ICE servers");
	myPeerConnection = new RTCPeerConnection({
    	iceServers: [
      		// { urls: "stun:stun.l.google.com:19302" },
      		...credData.iceServers
    	]
	});
	log("- myPeerConnection: " + myPeerConnection);
  	
  	// 이벤트 헨들러 등록
  	// when new local icecandidate is found
  	myPeerConnection.onicecandidate = handleICECandidateEvent; // add local icecandidate, send "new-ice-candidate" msg to server
 	// when the actual connection between peers changes (state 종류: new, checking, connected, disconnected, completed, failed )
  	myPeerConnection.oniceconnectionstatechange = handleICEConnectionStateChangeEvent; //check and log conn state, closeVideoCall if state="disconnected"
  	// ice 후보 수집 상태가 변경되었을 때 발생 (ex: myPeerConnecion.addICECandidate(icecandi)) / (state 종류: new, gathering, complete)
  	myPeerConnection.onicegatheringstatechange = handleICEGatheringStateChangeEvent; // logging
  	// sdp 변경시 발생 (ex: myPeerConnection.setRemoteDescription(desc))
	// (state 종류: stable, has-local-sdp, has-remote-sdp, closed) - 한가지 이상의 상태가 공존할 수 없음
  	myPeerConnection.onsignalingstatechange = handleSignalingStateChangeEvent; //logging, closeVideoCall if state=="closed""
  	// local의 연결상태가 바뀌어 새로운 sdp를 생성하여 peer에게 전달해야할 때 발생. (ex: myPeerConnection.addTrack()) 
  	myPeerConnection.onnegotiationneeded = handleNegotiationNeededEvent; //create offersdp, send "video-offer" msg to server(if not makingAnswer)
  	// 상대방이 보내는 미디어 트랙이 local myPeerConnection에 도착시 발생
  	myPeerConnection.ontrack = handleTrackEvent; // attach received track to video element
}

/**
 * local의 연결상태가 바뀌어 새로운 sdp를 생성하여 peer에게 전달해야할 때(협상=negotiation) 발생. (ex: myPeerConnection.addTrack()) 
 * 주요동작:
 * 1) create offersdp
 * 2) send "video-offer" msg to server(if not makingAnswer)
 */
async function handleNegotiationNeededEvent() {
  try {
    const offer = await myPeerConnection.createOffer();
    log("- creating SDP offer");
    log("- offer: " + offer);

    // callee가 answer 만드는 중이면 offer 재전송 금지
    if (makingAnswer) {
      log("- skip negotiationneeded while making answer");
      return;
    }

    // If the connection hasn't yet achieved the "stable" state,
    // return to the caller. Another negotiationneeded event
    // will be fired when the state stabilizes.
    if (myPeerConnection.signalingState != "stable") {
      log("- The connection isn't stable yet; postponing...")
      return;
    }

    // Establish the offer as the local peer's current
    // description.
    await myPeerConnection.setLocalDescription(offer);

    // Send the offer to the remote peer.
    sendToServer({
      name: myUsername,
      target: targetUsername,
      type: "video-offer",
      sdp: myPeerConnection.localDescription
    });
  } catch(err) {
    reportError(err);
  };
}

// Called by the WebRTC layer when events occur on the media tracks
// on our WebRTC call. This includes when streams are added to and
// removed from the call.
//
// track events include the following fields:
//
// RTCRtpReceiver       receiver
// MediaStreamTrack     track
// MediaStream[]        streams
// RTCRtpTransceiver    transceiver
//
// In our case, we're just taking the first stream found and attaching
// it to the <video> element for incoming media.
function handleTrackEvent(event) {
  log("- attach track to video element, and activate hangup button");
  document.getElementById("received_video").srcObject = event.streams[0];
  document.getElementById("hangup-button").disabled = false;
  document.getElementById("mute-button").disabled = false;
  document.getElementById("video-button").disabled = false;
}

// Handles |icecandidate| events by forwarding the specified
// ICE candidate (created by our local ICE agent) to the other
// peer through the signaling server.
function handleICECandidateEvent(event) {
  localICECandidates.push(event.candidate);
  if (event.candidate) {
    sendToServer({
      type: "new-ice-candidate",
      target: targetUsername,
      candidate: event.candidate
    });
  }
}

// Handle |iceconnectionstatechange| events. This will detect
// when the ICE connection is closed, failed, or disconnected.
// This is called when the state of the ICE agent changes.
function handleICEConnectionStateChangeEvent(event) {
  switch(myPeerConnection.iceConnectionState) {
    case "connected":
    case "completed":
      _nativeGetStats.call(myPeerConnection).then(stats => {
        stats.forEach(report => {
          if (report.type === "candidate-pair" && report.nominated && report.state === "succeeded") {
            const local  = stats.get(report.localCandidateId);
            const remote = stats.get(report.remoteCandidateId);
            log(">>> Selected ICE Candidate Pair <<<");
            log("- Local:  [" + local.candidateType  + "] " + local.address  + ":" + local.port  + " (" + local.protocol  + ")");
            log("- Remote: [" + remote.candidateType + "] " + remote.address + ":" + remote.port + " (" + remote.protocol + ")");
          }
        });
      });
      break;
    case "closed":
    case "failed":
    case "disconnected":
      closeVideoCall();
      break;
  }
}

// Set up a |signalingstatechange| event handler. This will detect when
// the signaling connection is closed.
//
// NOTE: This will actually move to the new RTCPeerConnectionState enum
// returned in the property RTCPeerConnection.connectionState when
// browsers catch up with the latest version of the specification!
function handleSignalingStateChangeEvent(event) {
  console.log("========> WebRTC signaling state changed to: " + myPeerConnection.signalingState);
  switch(myPeerConnection.signalingState) {
    case "closed":
      closeVideoCall();
      break;
  }
}

// Handle the |icegatheringstatechange| event. This lets us know what the
// ICE engine is currently working on: "new" means no networking has happened
// yet, "gathering" means the ICE engine is currently gathering candidates,
// and "complete" means gathering is complete. Note that the engine can
// alternate between "gathering" and "complete" repeatedly as needs and
// circumstances change.
//
// We don't need to do anything when this happens, but we log it to the
// console so you can see what's going on when playing with the sample.
function handleICEGatheringStateChangeEvent(event) {
  console.log("========> ICE gathering state changed to: " + myPeerConnection.iceGatheringState);
}

// Given a message containing a list of usernames, this function
// populates the user list box with those names, making each item
// clickable to allow starting a video call.
function handleUserlistMsg(msg) {
  var listElem = document.getElementById("userlist");

  // Remove all current list members. We could do this smarter,
  // by adding and updating users instead of rebuilding from
  // scratch but this will do for this sample.
  while (listElem.firstChild) {
    listElem.removeChild(listElem.firstChild);
  }

  // Add member names from the received list.
  msg.users.forEach(function(username) {
    var item = document.createElement("li");
    item.appendChild(document.createTextNode(username));
    item.addEventListener("click", invite, false);

    listElem.appendChild(item);
  });
}

// Close the RTCPeerConnection and reset variables so that the user can
// make or receive another call if they wish. This is called both
// when the user hangs up, the other user hangs up, or if a connection
// failure is detected.
function closeVideoCall() {
	log("Closing the call");
	var localVideo = document.getElementById("local_video");
	
	// Close the RTCPeerConnection
	if (myPeerConnection) {

    	// Disconnect all our event listeners; we don't want stray events
    	// to interfere with the hangup while it's ongoing.
	    myPeerConnection.ontrack = null;
	    myPeerConnection.onicecandidate = null;
	    myPeerConnection.oniceconnectionstatechange = null;
	    myPeerConnection.onsignalingstatechange = null;
	    myPeerConnection.onicegatheringstatechange = null;
	    myPeerConnection.onnegotiationneeded = null;

	    // Stop all transceivers on the connection
	    myPeerConnection.getTransceivers().forEach(transceiver => {
	      transceiver.stop();
	    });
	
	    // Stop the webcam preview as well by pausing the <video>
	    // element, then stopping each of the getUserMedia() tracks
	    // on it.
	    if (localVideo.srcObject) {
	      localVideo.pause();
	      localVideo.srcObject.getTracks().forEach(track => {
	        track.stop();
	      });
	    }
	
	    // Close the peer connection
	    myPeerConnection.close();
	    myPeerConnection = null;
	    webcamStream = null;
  	}

	// Disable the hangup button
	document.getElementById("hangup-button").disabled = true;
	document.getElementById("mute-button").disabled = true;
	document.getElementById("mute-button").textContent = "🎤 마이크 끄기";
	document.getElementById("video-button").disabled = true;
	document.getElementById("video-button").textContent = "📷 카메라 끄기";
	targetUsername = null;
}

// 오디오 활성/비활성 토글 
function toggleAudio() {
    // 1. 활성 통화 없으면 종료
    if (!audioTransceiver) return;

    // 2. 현재 마이크를 보내고 있는 상태인가? (참고: transceiver.direction 의 상태 4가지: sendonly, recvonly, sendrecv, inactive)
    const isSending = audioTransceiver.direction === 'sendrecv' 
                   || audioTransceiver.direction === 'sendonly'; 

    // 3. 반대 방향으로 전환
    audioTransceiver.direction = isSending ? 'recvonly' : 'sendrecv';

    // 4. 버튼 텍스트 업데이트
    document.getElementById("mute-button").textContent 
        = isSending ? "🔇 마이크 켜기" : "🎤 마이크 끄기";
}

// 비디오 활성/비활성 토글 
function toggleVideo() {
	if (!videoTransceiver) return;
	const isSending = videoTransceiver.direction === 'sendrecv' || videoTransceiver.direction === 'sendonly';
	videoTransceiver.direction = isSending ? 'recvonly' : 'sendrecv';
	document.getElementById("video-button").textContent = isSending ? "🚫 카메라 켜기" : "📷 카메라 끄기";
}

// Handle the "hang-up" message, which is sent if the other peer
// has hung up the call or otherwise disconnected.
function handleHangUpMsg(msg) {
  closeVideoCall();
}

// Hang up the call by closing our end of the connection, then
// sending a "hang-up" message to the other peer (keep in mind that
// the signaling is done on a different connection). This notifies
// the other peer that the connection should be terminated and the UI
// returned to the "no call in progress" state.
function hangUpCall() {
  sendToServer({
    name: myUsername,
    target: targetUsername,
    type: "hang-up"
  });
  closeVideoCall();
}

// 설명: 타겟사용자명 클릭시 발생하는 이벤트. 미팅을 시작하는 메서드. 
// 주요동작: 
// 1) 타겟사용자명 변수값 저장
// 2) createPeerConnection() 호출하여 WebRTC연결객체 생성 -> trigger onicecandidate event (webRTC연결객체를 생성하면서 ice candidate가 찾아짐) -> "new-ice-candidate" 메세지 서버 전송
// 3) 웹캠 데이터 스트림 가져오기, 화면의 프리뷰 영상 요소에 데이터 스트림 연결 
// 4) myPeerConnection.addTrack() 호출하여 웹캠 데이터 스트림을 WebRTC연결객체에 연결 -> trigger onnegotitationneeded event -> offer sdp 생성하여 이를 "video-offer" 메세지로 구성해 서버 전송
async function invite(evt) {
	// 중복 연결 시도 검증
	if (myPeerConnection) {
		alert("You can't start a call because you already have one open!");
		return;
	} 
	
	// 클릭된 사용자명 가져오기
    const clickedUsername = evt.target.textContent;
	
	// 자기 자신 연결 검증
    if (clickedUsername === myUsername) {
      alert("I'm afraid I can't let you talk to yourself. That would be weird.");
      return;
    }
	
	// 타겟사용자명 저장
    targetUsername = clickedUsername;
	
	// WebRTCPeerConnection 객체 생성
    await createPeerConnection();

	// 웹캠 데이터 스트림 가져오기, video요소에 연결
    try {
      webcamStream = await navigator.mediaDevices.getUserMedia(mediaConstraints);
      document.getElementById("local_video").srcObject = webcamStream;
    } catch(err) {
      handleGetUserMediaError(err);
	  return;
    }

    // 웹캠 데이터 스트림 WebRTCPeerConnection에 연결
    try {
      webcamStream.getTracks().forEach(track => {
        const tc = myPeerConnection.addTransceiver(track, {streams: [webcamStream]});
		if (track.kind === 'audio') audioTransceiver = tc;
		else videoTransceiver = tc
      });
    } catch(err) {
      handleGetUserMediaError(err);
	  return;
    }
}

/**
 * "video-offer" 메세지 헨들러
 * 주요동작:
 * 1) 타겟사용자명 변수값 저장
 * 2) createPeerConnection() 호출하여 WebRTC연결객체 생성 -> trigger onicecandidate event (webRTC연결객체를 생성하면서 ice candidate가 찾아짐) -> "new-ice-candidate" 메세지 서버 전송
 * 3) remote sdp 등록
 * 4) 웹캠 데이터 스트림 가져오기, 화면의 프리뷰 영상 요소에 데이터 스트림 연결 
 * 5) myPeerConnection.addTrack() 호출하여 웹캠 데이터 스트림을 WebRTC연결객체에 연결 -> answer sdp 생성하여 이를 "video-answer" 메세지로 구성해 서버 전송
 */
async function handleVideoOfferMsg(msg) {
	// 타겟사용자명 저장
	targetUsername = msg.name;
	
	// WebRTCPeerConnection 객체 생성
	if (!myPeerConnection) {
		await createPeerConnection();
	}
	
	// 원격 sdp 지정 -> 그래야 로컬 webRTC 레이어가 caller와 어떻게 연결할지 알 수 있음 
	const desc = new RTCSessionDescription(msg.sdp);
	
	// 만약 로컬의 signalingState가 "stable"이 아닌 경우 ("has-remote-sdp", "has-local-sdp", "closed" 일수 있음) -> 즉 앞서서 연결이 시도된 흔적이 남아있는 경우
	// signaling state를 초기화(rollback to stable) 시켜주고, 지금 막 새로들어온 remote sdp를 등록해주는 동작이다.
  	if (myPeerConnection.signalingState != "stable") {
	    await Promise.all([
	      myPeerConnection.setLocalDescription({type: "rollback"}), // signaling state를 초기화(rollback to stable) 
	      myPeerConnection.setRemoteDescription(desc) // remote sdp를 등록
	    ]);
		return;
  	} 
	// 이미"stable" 상태일 경우엔 바로 remote sdp를 등록해주기
  	else {
		await myPeerConnection.setRemoteDescription(desc);
	}
	
	// 초기 연결 시에만 webcam 취득 및 트랙 등록 (재협상 시에는 생략 — 기존 트랜시버를 재사용)
	if (!webcamStream) {
		try {
			webcamStream = await navigator.mediaDevices.getUserMedia(mediaConstraints);
			document.getElementById("local_video").srcObject = webcamStream;
		} catch(err) {
			handleGetUserMediaError(err);
			return;
		}

		try {
			webcamStream.getTracks().forEach(track => {
				const sender = myPeerConnection.addTrack(track, webcamStream);  // 중요) callee 측에서는 반드시 addTrack 을 사용해야함. 왜냐하면, caller 측에서 이미 webrtc연결에 transceiver를 등록했기 때문
				const tc = myPeerConnection.getTransceivers().find(t => t.sender === sender)
				if(track.kind === 'audio') audioTransceiver = tc;
				else videoTransceiver = tc;
			});
		} catch(err) {
			handleGetUserMediaError(err);
		}
	}

	// video-answer 생성중 여부 플래그 -> addTrack으로 인한 onnegotiationneeded event 헨들러 내부에서 사용됨. video-offer 재전송을 방지
	makingAnswer = true;
  	
	// 로컬 sdp 생성
	await myPeerConnection.setLocalDescription(await myPeerConnection.createAnswer());
	
	// "video-answer" 메세지 서버 전송
	sendToServer({
		name: myUsername,
	    target: targetUsername,
	    type: "video-answer",
	    sdp: myPeerConnection.localDescription
	});
	
	// video-answer 생성종료
	makingAnswer = false;
}

/**
 * "video-answer" 메세지 헨들러
 * 주요동작:
 * 1) remote sdp 등록
 */
async function handleVideoAnswerMsg(msg) {
  // remote sdp를 등록해주기 (video-offer를 보낸 후 응답으로 video-answer가 오기 때문에 이시점에 signaling state는 항상 "has-local-sdp"이기에 상태 검증 생략)
  var desc = new RTCSessionDescription(msg.sdp);
  await myPeerConnection.setRemoteDescription(desc).catch(reportError);
}

/**
 * "new-ice-candidate" 메세지 헨들러
 */
async function handleNewICECandidateMsg(msg) {
  // 새로운 ice 후보객체 생성
  var candidate = new RTCIceCandidate(msg.candidate);
  
  try {
	log("- add received ICE candidate: " + JSON.stringify(candidate));
	remoteICECandidates.push(candidate);
    await myPeerConnection.addIceCandidate(candidate)
  } catch(err) {
    reportError(err);
    log("- Failed to add ICE candidate to peer connection");
  }
}

// Handle errors which occur when trying to access the local media
// hardware; that is, exceptions thrown by getUserMedia(). The two most
// likely scenarios are that the user has no camera and/or microphone
// or that they declined to share their equipment when prompted. If
// they simply opted not to share their media, that's not really an
// error, so we won't present a message in that situation.
function handleGetUserMediaError(e) {
  log_error(e);
  switch(e.name) {
    case "NotFoundError":
      alert("Unable to open your call because no camera and/or microphone" +
            "were found.");
      break;
    case "SecurityError":
    case "PermissionDeniedError":
      // Do nothing; this is the same as the user canceling the call.
      break;
    default:
      alert("Error opening your camera and/or microphone: " + e.message);
      break;
  }
  
  // Make sure we shut down our end of the RTCPeerConnection so we're
  // ready to try again.
  closeVideoCall();
}

// Handles reporting errors. Currently, we just dump stuff to console but
// in a real-world application, an appropriate (and user-friendly)
// error message should be displayed.
function reportError(errMessage) {
  log_error(`Error ${errMessage.name}: ${errMessage.message}`);
}
