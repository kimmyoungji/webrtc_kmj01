package webrtc.controller;

import java.util.List;

public class TurnCredentialResponse {

    private List<IceServer> iceServers;

    public TurnCredentialResponse(List<IceServer> iceServers) {
        this.iceServers = iceServers;
    }

    public List<IceServer> getIceServers() {
        return iceServers;
    }

    public static class IceServer {
        private String urls;
        private String username;
        private String credential;

        public IceServer(String urls, String username, String credential) {
            this.urls = urls;
            this.username = username;
            this.credential = credential;
        }

        public String getUrls()       { return urls; }
        public String getUsername()   { return username; }
        public String getCredential() { return credential; }
    }
}
