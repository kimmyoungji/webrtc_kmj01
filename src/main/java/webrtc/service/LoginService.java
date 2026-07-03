package webrtc.service;

import org.springframework.stereotype.Service;

@Service
public class LoginService {

    public boolean authenticate(String username, String password) {
        if (username == null || username.isBlank() || password == null) {
            return false;
        }
        // 데모용 간단 인증: 비밀번호가 1234일 때 허용
        return "1234".equals(password.trim());
    }
}
