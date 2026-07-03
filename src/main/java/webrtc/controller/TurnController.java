package webrtc.controller;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import javax.servlet.http.HttpServletRequest;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Arrays;
import java.util.Base64;

/**
 * Time-Limited TURN Credential 발급 엔드포인트 (RFC 8489 기반)
 *
 * username  = "{만료 unix timestamp}:{사용자명}"
 * credential = base64( HMAC-SHA1(shared_secret, username) )
 *
 * coturn 실행 옵션:
 *   --use-auth-secret --static-auth-secret=${turn.secret}
 *
 * JVM 시스템 프로퍼티로 주입 (-D 옵션):
 *   -Dturn.secret=<shared_secret>
 *   -Dturn.url.internal=turn:<내부IP>:53478
 *   -Dturn.url.external=turn:<외부IP>:53478
 */
@RestController
@RequestMapping("/api")
public class TurnController {

    private static final Logger log = LoggerFactory.getLogger(TurnController.class);

    private static final String SHARED_SECRET   = System.getProperty("turn.secret",       "change_this_secret");
    private static final String URL_INTERNAL    = System.getProperty("turn.url.internal", "turn:192.168.0.90:53478");
    private static final String URL_EXTERNAL    = System.getProperty("turn.url.external", "turn:61.73.25.18:53478");
    private static final long   TTL_SECONDS     = 86400; // 24시간

    @GetMapping("/turn-credentials")
    public ResponseEntity<?> getTurnCredentials(HttpServletRequest request) {
        String jwtUsername = (String) request.getAttribute("jwtUsername");
        if (jwtUsername == null || jwtUsername.isBlank()) {
            jwtUsername = "anonymous";
        }

        try {
            long expiry = Instant.now().getEpochSecond() + TTL_SECONDS;
            String username   = expiry + ":" + jwtUsername;
            String credential = hmacSha1(SHARED_SECRET, username);

            log.debug("TURN credential issued for user={}, expiry={}", jwtUsername, expiry);

            return ResponseEntity.ok(new TurnCredentialResponse(Arrays.asList(
                new TurnCredentialResponse.IceServer(URL_INTERNAL, username, credential),
                new TurnCredentialResponse.IceServer(URL_EXTERNAL, username, credential)
            )));

        } catch (Exception e) {
            log.error("TURN credential 생성 실패", e);
            return ResponseEntity.internalServerError().body("TURN credential 생성 실패");
        }
    }

    private String hmacSha1(String secret, String data) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA1");
        mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA1"));
        return Base64.getEncoder().encodeToString(mac.doFinal(data.getBytes(StandardCharsets.UTF_8)));
    }
}
