package webrtc.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import webrtc.security.JwtUtil;
import webrtc.service.AuthService;

import java.util.Map;

@RestController
@RequestMapping("/api")
public class LoginController {

    @Autowired
    private AuthService loginService;

    /**
     * 로그인 엔드포인트
     * 사용자 이름과 비밀번호를 받아 인증하고, JWT 토큰을 반환합니다.
     * 이 요청은 JwtAuthenticationFilter에서 검증 대상에서 제외됩니다.
     */
    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest request) {
        if (request == null || !loginService.authenticate(request.getUsername(), request.getPassword())) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "로그인에 실패했습니다. 사용자 이름과 비밀번호를 확인하세요."));
        }

        String username = request.getUsername().trim();
        String token = JwtUtil.generateToken(username);
        return ResponseEntity.ok(new LoginResponse(username, token));
    }
}
