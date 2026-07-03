package webrtc.handler;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;
import webrtc.security.JwtUtil;

/**
 * WebRTC 시그널링 서버 (Spring WebSocket)
 *
 * 원본: mozilla_webrtc_ex/s/webrtc-from-chat/chatserver.js (Node.js)
 *
 * 주요 메시지 흐름:
 *   연결 시 → 클라이언트에 {"type":"id", "id":...} 전송
 *   username → 고유성 확인 후 userlist 브로드캐스트
 *   video-offer / video-answer / new-ice-candidate / hang-up
 *             → msg.target 사용자에게 1:1 라우팅
 */
public class SignalingHandler extends TextWebSocketHandler {

    private static final Logger log = LoggerFactory.getLogger(SignalingHandler.class);
    private static final ObjectMapper mapper = new ObjectMapper();

    /** 세션 ID → WebSocketSession */
    private final Map<String, WebSocketSession> sessions = new ConcurrentHashMap<>();

    /** 세션 ID → 사용자 이름 */
    private final Map<String, String> usernames = new ConcurrentHashMap<>();

    /** 원본 JS의 nextID = Date.now() 와 동일한 방식으로 초기화 */
    private final AtomicLong nextId = new AtomicLong(System.currentTimeMillis());

    // ──────────────────────────────────────────────────────────────────────────
    // 연결 수립
    // ──────────────────────────────────────────────────────────────────────────

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        log.info(session.getUri().toString());

        String token = extractToken(session);
        if (token == null || token.isEmpty() || !JwtUtil.validateToken(token)) {
            log.warn("Connection rejected: invalid or missing JWT token");
            session.close(CloseStatus.NOT_ACCEPTABLE.withReason("Invalid token"));
            return;
        }

        String username = JwtUtil.getUsernameFromToken(token);
        if (username == null || username.isEmpty()) {
            log.warn("Connection rejected: JWT token does not contain username");
            session.close(CloseStatus.NOT_ACCEPTABLE.withReason("Invalid token"));
            return;
        }

        if (isUsernameTaken(username)) {
            log.warn("Connection rejected: username already in use - {}", username);
            session.close(CloseStatus.POLICY_VIOLATION.withReason("Username already in use"));
            return;
        }

        sessions.put(session.getId(), session);
        usernames.put(session.getId(), username);
        session.getAttributes().put("jwtUsername", username);

        log.info("server-1) Connection accepted: {} (total={})", session.getRemoteAddress(), sessions.size());

        long clientId = nextId.getAndIncrement();
        ObjectNode idMsg = mapper.createObjectNode();
        idMsg.put("type", "id");
        idMsg.put("id", clientId);
        session.sendMessage(new TextMessage(mapper.writeValueAsString(idMsg)));
        log.info("server-2) Sent ID {} to new client", clientId);

        sendUserListToAll();
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 메시지 수신
    // ──────────────────────────────────────────────────────────────────────────

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        log.debug("--- msg received ---");
        ObjectNode msg = (ObjectNode) mapper.readTree(message.getPayload());
        String type = msg.has("type") ? msg.get("type").asText() : "";

        switch (type) {

            // 사용자 이름 등록 (원본 server-3, server-4 단계)
            case "username":
                handleUsername(session, msg);
                break;

            // 그 외 메시지(video-offer, video-answer, new-ice-candidate, hang-up)
            // → target 이 지정된 경우에만 해당 사용자에게 1:1 라우팅
            default:
                String target = msg.has("target") ? msg.get("target").asText() : "";
                if (!target.isEmpty()) {
                    log.info("server-5) Routing '{}' to target: {}", type, target);
                    log.info(message.getPayload());
                    sendToUser(target, message.getPayload());
                }
                break;
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 연결 종료
    // ──────────────────────────────────────────────────────────────────────────

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        sessions.remove(session.getId());
        usernames.remove(session.getId());
        log.info("Connection closed: {} ({})", session.getRemoteAddress(), status);

        try {
            sendUserListToAll();
        } catch (Exception e) {
            log.error("Error broadcasting userlist after disconnect", e);
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 내부 헬퍼
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * 사용자 이름 등록 처리.
     * 중복이면 숫자를 붙여 고유하게 만든 뒤 rejectusername 메시지로 알린다.
     */
    private void handleUsername(WebSocketSession session, ObjectNode msg) throws Exception {
        log.info("server-3) Processing username change");
        String requested = msg.has("name") ? msg.get("name").asText() : "";
        String jwtUsername = (String) session.getAttributes().get("jwtUsername");

        if (jwtUsername != null && !jwtUsername.isEmpty()) {
            if (!jwtUsername.equals(requested)) {
                ObjectNode rejectMsg = mapper.createObjectNode();
                rejectMsg.put("id", msg.has("id") ? msg.get("id").asLong() : 0);
                rejectMsg.put("type", "rejectusername");
                rejectMsg.put("name", jwtUsername);
                session.sendMessage(new TextMessage(mapper.writeValueAsString(rejectMsg)));
            }
            usernames.put(session.getId(), jwtUsername);
            log.info("server-4) Username registered from JWT: {} → {}", session.getId(), jwtUsername);
            sendUserListToAll();
            return;
        }

        String finalName = requested;
        int suffix = 1;

        while (isUsernameTaken(finalName)) {
            finalName = requested + suffix++;
        }

        if (!finalName.equals(requested)) {
            ObjectNode rejectMsg = mapper.createObjectNode();
            rejectMsg.put("id", msg.has("id") ? msg.get("id").asLong() : 0);
            rejectMsg.put("type", "rejectusername");
            rejectMsg.put("name", finalName);
            session.sendMessage(new TextMessage(mapper.writeValueAsString(rejectMsg)));
        }

        usernames.put(session.getId(), finalName);
        log.info("server-4) Username registered: {} → {}", session.getId(), finalName);
        sendUserListToAll();
    }

    /** 해당 이름이 이미 등록되어 있는지 확인 */
    private boolean isUsernameTaken(String name) {
        return usernames.containsValue(name);
    }

    private String extractToken(WebSocketSession session) {
        if (session.getUri() == null || session.getUri().getQuery() == null) {
            return null;
        }

        String query = session.getUri().getQuery();
        for (String param : query.split("&")) {
            if (param.startsWith("token=")) {
                return URLDecoder.decode(param.substring("token=".length()), StandardCharsets.UTF_8);
            }
        }
        return null;
    }

    /**
     * 특정 사용자에게 메시지를 전송.
     * 원본의 sendToOneUser() 와 동일.
     */
    private void sendToUser(String username, String msgString) throws Exception {
        for (Map.Entry<String, String> entry : usernames.entrySet()) {
            if (entry.getValue().equals(username)) {
                WebSocketSession target = sessions.get(entry.getKey());
                if (target != null && target.isOpen()) {
                    target.sendMessage(new TextMessage(msgString));
                }
                return;
            }
        }
        log.warn("sendToUser: user '{}' not found", username);
    }

    /**
     * 전체 사용자에게 userlist 브로드캐스트.
     * 원본의 sendUserListToAll() 과 동일.
     */
    private void sendUserListToAll() throws Exception {
        ArrayNode users = mapper.createArrayNode();
        usernames.values().forEach(users::add);

        ObjectNode listMsg = mapper.createObjectNode();
        listMsg.put("type", "userlist");
        listMsg.set("users", users);
        String msgStr = mapper.writeValueAsString(listMsg);

        for (WebSocketSession s : sessions.values()) {
            if (s.isOpen()) {
                s.sendMessage(new TextMessage(msgStr));
            }
        }
    }

}
