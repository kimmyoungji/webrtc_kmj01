---

# KBCSTD MEET

WebRTC 학습 및 실습을 위한 프로젝트 (KBC 스터디용)

---

## 📚 목차
* [1. 프로젝트 스펙](#1-프로젝트-스펙)
* [2. 인증서 설정 (mkcert)](#2-인증서-설정-mkcert)
  * [2.1 Mac OS](#21-mac-os)
  * [2.2 Windows](#22-windows)
* [3. TURN 서버 설치 및 실행 (coturn)](#3-turn-서버-설치-및-실행-coturn)
  * [3.1 Mac OS](#31-mac-os)
  * [3.2 Windows (WSL2)](#32-windows-wsl2)   
* [4. 네트워크 설정](#4-네트워크-설정)    
* [5. 프로젝트 실행](#5-프로젝트-실행)    

---

## 1. 프로젝트 스펙

* Framework: eGovFramework 4.3
* JDK: 17
* DB : MySQL
* WAS: Apache Tomcat 9.0

---

## 2. 인증서 설정 (mkcert)

### 2.1 Mac OS

```bash
brew install mkcert # mkcert 설치
mkcert -install     # 로컬호스트에 RootCA 설치
mkcert -CAROOT		# RootCA 설치 경로 확인

cd {projectBaseDir}/cert/           # 인증서 디렉토리로 이동
mkcert -pkcs12 localhost {외부공인IP} # 인증서 발급
```

---

### 2.2 Windows

```bash
choco install mkcert # mkcert 설치
mkcert -install      # 로컬호스트에 RootCA 설치
mkcert -CAROOT       # RootCA 설치 경로 확인
 
cd {projectBaseDir}/cert/           # 인증서 디렉토리로 이동
mkcert -pkcs12 localhost {외부공인IP} # 인증서 발급
```

---

## 3. TURN 서버 설치 및 실행 (coturn)

### 3.1 MAC OS

```bash
brew install coturn
turnserver \
  -p 53478 \
  -r webrtc \
  -u webrtc:turnserver \
  --lt-cred-mech \
  --no-tls \
  --no-dtls \
  -X {외부공인IP}/{내부IP}
```

---

### 3.2 WINDOW (WSL2)

```bash
wsl --install              # wsl 설치 후 재부팅 필요..ㅜㅜ
wsl -l -v                  # 설치 버전 확인
wsl --set-version Ubuntu 2 # 만약 ubuntu 버전 1일 경우 2로 세팅
wsl --update               # wsl 최신 버전으로 동기화
wsl --shutdown             # wsl 재시작
wsl -d Ubuntu              # Ubuntu 실행
sudo apt update            # Ubuntu 패키지 인텍스 맞추기
sudo apt install coturn -y # 드디어.. coturn 설치
turnserver --version       # 설치 확인
turnserver \ 
  -p 53478 \
  -r webrtc \
  -u webrtc:turnserver \
  --lt-cred-mech \
  --no-tls \
  --no-dtls \
  -X {외부공인IP}/{내부IP}    # turn 서버 실행!
```

---

## 4. 네트워크 설정

### 포트포워딩

* Tomcat 포트 (8080, 8443)
* TURN 서버 포트 (53478)
* 포트 오픈 확인 사이트:
  [https://www.yougetsignal.com/tools/open-ports/](https://www.yougetsignal.com/tools/open-ports/)

---

## 5. 프로젝트 실행

* 1. 프로젝트 Import
* 2. Tomcat 배포
* 3. server.xml HTTPS 설정

```xml
<Connector
    port="8443"
    protocol="org.apache.coyote.http11.Http11NioProtocol"
    SSLEnabled="true">

    <SSLHostConfig>
        <Certificate
            certificateKeystoreFile="cert/keystore.p12"
            certificateKeystorePassword="your-password"
            type="PKCS12" />
    </SSLHostConfig>
</Connector>
```

* 4. 서버 실행
* 5. 브라우저 테스트    
	* 이름 입력 > 로그인 클릭 > 본인 이름 제외 다른 유저명 클릭 > 미트 연결 시작

### 테스트 도구

* TURN 서버 테스트 (Trickle ICE):
  [https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/](https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/)    
      
      
* WebRTC 내부 상태 확인:    
  [chrome://webrtc-internals/](chrome://webrtc-internals/)
