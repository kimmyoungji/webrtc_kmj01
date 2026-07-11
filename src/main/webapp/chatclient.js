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

var myUsername = null;
var targetUsername = null;      

var connection = null;  	 // websocket 연결 객체 저장 변수
var myPeerConnection = null; // webrtc 연결 객체 저장 변수
var transceiver = null;		 // 
var webcamStream = null;        

var makingAnswer = false;       
var localICECandidates = [];
var remoteICECandidates = [];

// Output logging information to console.
function log(text) {
  var time = new Date();
  console.log("[" + time.toLocaleTimeString() + "] " + text);
}

// Output Event logging information to console.
// Usage:
//   const end = eventLog("createPeerConnection");
//   ... event body logs ...
//   end();
function eventLog(title) {
  const TOTAL_WIDTH = 50;
  const inner = " " + title + " ";
  const padTotal = TOTAL_WIDTH - inner.length;
  const header = inner + ">".repeat(padTotal);
  console.log(header);
  return function() {
   console.log(">".repeat(padTotal) + inner);
    console.log("\n");
  };
}
// Output an error message to console.
function log_error(text) {
  var time = new Date();
  console.trace("[" + time.toLocaleTimeString() + "] " + text);
}

/**
 * 페이지 로드 시 자동으로 WebSocket 연결 수립
 * 사전 조건: chat.html에서 이미 로드됨, auth.js를 통해 토큰 확인됨
 */

/* type1 */
/* window.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('jwtToken');
  if (token) {
    log('자동으로 WebSocket 연결을 시작합니다...');
    connect();
  } else {
    log_error('JWT 토큰이 없습니다. 로그인 페이지로 이동합니다.');
    window.location.href = 'login.html';
  }
}); */

/* type2 */
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

// Open and configure the connection to the WebSocket server.
// 페이지 로드 시 자동으로 호출되거나, 재연결 시 호출됨
function connect() {
  // localStorage에서 JWT 토큰 가져오기
  
  // type1
  /* const token = localStorage.getItem('jwtToken');
  if (!token) {
    log_error('JWT 토큰이 없습니다. 로그인 페이지로 이동합니다.');
    window.location.href = 'login.html';
    return;
  }

  accessToken = token;
  myUsername = localStorage.getItem('username'); */
  
  //type2
  const myUsername = sessionStorage.getItem('username');

  var serverUrl;
  var scheme = "ws";

  // If this is an HTTPS connection, we have to use a secure WebSocket
  // connection too, so add another "s" to the scheme.
  if (document.location.protocol === "https:") {
    scheme += "s";
  }
  
  // [Spring 변환] 원본: scheme + "://" + myHostname + ":6503" (별도 Node.js 포트)
  // Spring WebSocket은 동일한 서버의 /ws 엔드포인트에서 처리한다.
  // pathname에서 마지막 세그먼트를 제거하면 컨텍스트 패스를 얻을 수 있다.
  //   예) /webrtc_kmj01-1.0.0/index.html → /webrtc_kmj01-1.0.0
  //   예) /webrtc_kmj01-1.0.0/           → /webrtc_kmj01-1.0.0
  //   예) / (ROOT 배포)                  → "" (빈 문자열, 그대로 동작)
  var contextPath = window.location.pathname.replace(/\/[^/]*$/, "");
  
  debugger;
  
  // type1
  // serverUrl = scheme + "://" + window.location.host + contextPath + "/ws?token=" + encodeURIComponent(accessToken);
  // type2
  serverUrl = scheme + "://" + window.location.host + contextPath + "/ws"
  
  debugger;

  connection = new WebSocket(serverUrl);

  connection.onopen = function(evt) {
    log("1) WebSocket Connection opened (Signalling Server Connection Established)");
    log(`Connecting to server: ${serverUrl}`);
    // document.getElementById("text").disabled = false;
    //document.getElementById("send").disabled = false;
  };

  connection.onerror = function(evt) {
    console.dir(evt);
  }

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

  connection.onmessage = function(evt) {
    // var chatBox = document.querySelector(".chatbox");
    var text = "";
    var msg = JSON.parse(evt.data);
    log("Message received: ");
    console.dir(msg);
    // var time = new Date(msg.date);
    // var timeStr = time.toLocaleTimeString();

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

    // If there's text to insert into the chat buffer, do so now, then
    // scroll the chat panel so that the new text is visible.

    /* if (text.length) {
      chatBox.innerHTML += text;
      chatBox.scrollTop = chatBox.scrollHeight - chatBox.clientHeight;
    } */
  };
}

/* // Handles a click on the Send button (or pressing return/enter) by
// building a "message" object and sending it to the server.
function handleSendButton() {
  var msg = {
    text: document.getElementById("text").value,
    type: "message",
    id: clientID,
    date: Date.now()
  };
  sendToServer(msg);
  document.getElementById("text").value = "";
}

// Handler for keyboard events. This is used to intercept the return and
// enter keys so that we can call send() to transmit the entered text
// to the server.
function handleKey(evt) {
  if (evt.keyCode === 13 || evt.keyCode === 14) {
    if (!document.getElementById("send").disabled) {
      handleSendButton();
    }
  }
} */

// Create the RTCPeerConnection which knows how to talk to our
// selected STUN/TURN server and then uses getUserMedia() to find
// our camera and microphone and add that stream to the connection for
// use in our video call. Then we configure event handlers to get
// needed notifications on the call.

async function createPeerConnection() {
  const endEventLog = eventLog("createPeerConnection");
  // Create an RTCPeerConnection which knows to use our chosen
  // STUN server.

  log("- Fetching TURN credentials from server");
  const contextPath = window.location.pathname.replace(/\/[^/]*$/, "");
  const credResponse = await authorizedFetch(contextPath + '/api/turn-credentials');
  const credData = await credResponse.json();

  log("- Creating PeerConnection with dynamic ICE servers");
  myPeerConnection = new RTCPeerConnection({
    iceServers: [
      // { urls: "stun:stun.l.google.com:19302" },
      ...credData.iceServers
    ]
  });

  log("- myPeerConnection: " + myPeerConnection);
  
  // Set up event handlers for the ICE negotiation process.
  // when new icecandidate is found
  myPeerConnection.onicecandidate = handleICECandidateEvent;
  // when the actual connection between peers changes
  myPeerConnection.oniceconnectionstatechange = handleICEConnectionStateChangeEvent;
  // when ice gathering state changes
  myPeerConnection.onicegatheringstatechange = handleICEGatheringStateChangeEvent;
  // when signaling state changes (offer, answer, etc.) == during webrtc negotiation
  myPeerConnection.onsignalingstatechange = handleSignalingStateChangeEvent;
  // when remote peer changes sdp description (change configuration of peer connection), add/remove track 
  myPeerConnection.onnegotiationneeded = handleNegotiationNeededEvent;
  // when remote peer added a track
  myPeerConnection.ontrack = handleTrackEvent;

  endEventLog();
}

// Called by the WebRTC layer to let us know when it's time to
// begin, resume, or restart ICE negotiation.

async function handleNegotiationNeededEvent() {
  const endEventLog = eventLog("handleNegotiationNeededEvent");
  try {
    const offer = await myPeerConnection.createOffer();
    log("- creating SDP offer");
    log("- offer: " + offer);

    // callee가 answer 만드는 중이면 offer 재전송 금지
    if (makingAnswer) {
      log("- skip negotiationneeded while making answer");
      endEventLog();
      return;
    }

    // If the connection hasn't yet achieved the "stable" state,
    // return to the caller. Another negotiationneeded event
    // will be fired when the state stabilizes.
    if (myPeerConnection.signalingState != "stable") {
      log("- callee: The connection isn't stable yet; postponing...")
      endEventLog();
      return;
    }

    // Establish the offer as the local peer's current
    // description.
    log("- caller: Setting local description to the offer");
    await myPeerConnection.setLocalDescription(offer);

    // Send the offer to the remote peer.
    sendToServer({
      name: myUsername,
      target: targetUsername,
      type: "video-offer",
      sdp: myPeerConnection.localDescription
    });
  } catch(err) {
    log("- error: The following error occurred while handling the negotiationneeded event:");
    reportError(err);
  };
  endEventLog();
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
  const endEventLog = eventLog("handleTrackEvent");
  log("- attach track to video element, and activate hangup button");
  document.getElementById("received_video").srcObject = event.streams[0];
  document.getElementById("hangup-button").disabled = false;
  document.getElementById("mute-button").disabled = false;
  document.getElementById("video-button").disabled = false;
  endEventLog();
}

// Handles |icecandidate| events by forwarding the specified
// ICE candidate (created by our local ICE agent) to the other
// peer through the signaling server.

function handleICECandidateEvent(event) {
  const endEventLog = eventLog("handleICECandidateEvent");
  localICECandidates.push(event.candidate);
  if (event.candidate) {
    sendToServer({
      type: "new-ice-candidate",
      target: targetUsername,
      candidate: event.candidate
    });
  }
  endEventLog();
}

// Handle |iceconnectionstatechange| events. This will detect
// when the ICE connection is closed, failed, or disconnected.
//
// This is called when the state of the ICE agent changes.

function handleICEConnectionStateChangeEvent(event) {
  const endEventLog = eventLog("handleICEConnectionStateChangeEvent");
  log("- ICE connection state changed to: " + myPeerConnection.iceConnectionState);

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
  endEventLog();
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
  var localVideo = document.getElementById("local_video");

  log("Closing the call");

  // Close the RTCPeerConnection

  if (myPeerConnection) {
    log("--> Closing the peer connection");

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

function toggleAudio() {
  if (!webcamStream) return;
  const audioTrack = webcamStream.getAudioTracks()[0];
  if (!audioTrack) return;

  audioTrack.enabled = !audioTrack.enabled;
  document.getElementById("mute-button").textContent = audioTrack.enabled ? "🎤 마이크 끄기" : "🔇 마이크 켜기";
}

function toggleVideo() {
  if (!webcamStream) return;
  const videoTrack = webcamStream.getVideoTracks()[0];
  if (!videoTrack) return;

  videoTrack.enabled = !videoTrack.enabled;
  document.getElementById("video-button").textContent = videoTrack.enabled ? "📷 카메라 끄기" : "🚫 카메라 켜기";
}

// Handle the "hang-up" message, which is sent if the other peer
// has hung up the call or otherwise disconnected.

function handleHangUpMsg(msg) {
  log("*** Received hang up notification from other peer");
  closeVideoCall();
}

// Hang up the call by closing our end of the connection, then
// sending a "hang-up" message to the other peer (keep in mind that
// the signaling is done on a different connection). This notifies
// the other peer that the connection should be terminated and the UI
// returned to the "no call in progress" state.

function hangUpCall() {
  closeVideoCall();

  sendToServer({
    name: myUsername,
    target: targetUsername,
    type: "hang-up"
  });
}

// Handle a click on an item in the user list by inviting the clicked
// user to video chat. Note that we don't actually send a message to
// the callee here -- calling RTCPeerConnection.addTrack() issues
// a |notificationneeded| event, so we'll let our handler for that
// make the offer.

async function invite(evt) {
  console.log("=========> invite");
  // log("=== WEBRTC CLIENT: Starting video call invitation ===");
  // log("Starting to prepare an invitation");
  if (myPeerConnection) {
    alert("You can't start a call because you already have one open!");
  } else {
    var clickedUsername = evt.target.textContent;

    // Don't allow users to call themselves, because weird.

    if (clickedUsername === myUsername) {
      alert("I'm afraid I can't let you talk to yourself. That would be weird.");
      return;
    }

    // Record the username being called for future reference

    targetUsername = clickedUsername;
    // log("Inviting user " + targetUsername);

    // Call createPeerConnection() to create the RTCPeerConnection.
    // When this returns, myPeerConnection is our RTCPeerConnection
    // and webcamStream is a stream coming from the camera. They are
    // not linked together in any way yet.

    // log("Setting up connection to invite user: " + targetUsername);
    await createPeerConnection();

    // Get access to the webcam stream and attach it to the
    // "preview" box (id "local_video").

    try {
      webcamStream = await navigator.mediaDevices.getUserMedia(mediaConstraints);
      document.getElementById("local_video").srcObject = webcamStream;
    } catch(err) {
      handleGetUserMediaError(err);
	  return;
    }

    // Add the tracks from the stream to the RTCPeerConnection

    try {
      webcamStream.getTracks().forEach(track => {
        myPeerConnection.addTransceiver(track, {streams: [webcamStream]});
      });
    } catch(err) {
      handleGetUserMediaError(err);
    }
  }
}

// Accept an offer to video chat. We configure our local settings,
// create our RTCPeerConnection, get and attach our local camera
// stream, then create and send an answer to the caller.

async function handleVideoOfferMsg(msg) {
  const endEventLog = eventLog("handleVideoOfferMsg");
  targetUsername = msg.name;

  // If we're not already connected, create an RTCPeerConnection
  // to be linked to the caller.
  if (!myPeerConnection) {
    log("- createPeerConnection");
    await createPeerConnection();
  }

  // We need to set the remote description to the received SDP offer
  // so that our local WebRTC layer knows how to talk to the caller.
  
  log("- create new RTCSessionDescription");
  var desc = new RTCSessionDescription(msg.sdp);

  // If the connection isn't stable yet, wait for it...

  if (myPeerConnection.signalingState != "stable") {
    log("- signaling state isn't stable, so triggering rollback");

    // Set the local and remote descriptions for rollback; don't proceed
    // until both return.
    await Promise.all([
      myPeerConnection.setLocalDescription({type: "rollback"}),
      myPeerConnection.setRemoteDescription(desc)
    ]);
	endEventLog();
	return;
  } 
  else {
    log("- set remote description");
    await myPeerConnection.setRemoteDescription(desc);
  }

  // Get the webcam stream if we don't already have it

  if (!webcamStream) {
    try {
		log("- getUserMedia");
		webcamStream = await navigator.mediaDevices.getUserMedia(mediaConstraints);
    } catch(err) {
      handleGetUserMediaError(err);
	  endEventLog();
      return;
    }

    document.getElementById("local_video").srcObject = webcamStream;

    // Add the camera stream to the RTCPeerConnection

    try {
	      log("- add transceiver");
	      /* webcamStream.getTracks().forEach(
	        transceiver = track => myPeerConnection.addTransceiver(track, {streams: [webcamStream]})
	      ); */
	      webcamStream.getTracks().forEach(track => {
			  myPeerConnection.addTrack(track, webcamStream);
			}); 
    } catch(err) {
      handleGetUserMediaError(err);
    }
  }

  log("- create answer and set local description");
  makingAnswer = true;
  await myPeerConnection.setLocalDescription(await myPeerConnection.createAnswer());

  sendToServer({
    name: myUsername,
    target: targetUsername,
    type: "video-answer",
    sdp: myPeerConnection.localDescription
  });
  makingAnswer = false;

  endEventLog();
}

// Responds to the "video-answer" message sent to the caller
// once the callee has decided to accept our request to talk.

async function handleVideoAnswerMsg(msg) {
  const endEventLog = eventLog("handleVideoAnswerMsg");

  // Configure the remote description, which is the SDP payload
  // in our "video-answer" message.
  
  log("- set remote description");
  var desc = new RTCSessionDescription(msg.sdp);
  await myPeerConnection.setRemoteDescription(desc).catch(reportError);
  endEventLog();
}

// A new ICE candidate has been received from the other peer. Call
// RTCPeerConnection.addIceCandidate() to send it along to the
// local ICE framework.

async function handleNewICECandidateMsg(msg) {
  const endEventLog = eventLog("handleNewICECandidateMsg");
  var candidate = new RTCIceCandidate(msg.candidate);
  try {
	log("- add received ICE candidate: " + JSON.stringify(candidate));
	remoteICECandidates.push(candidate);
    await myPeerConnection.addIceCandidate(candidate)
  } catch(err) {
    reportError(err);
    log("- Failed to add ICE candidate to peer connection");
  }
  endEventLog();
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
