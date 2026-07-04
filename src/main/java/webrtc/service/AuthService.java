package webrtc.service;

import org.mindrot.jbcrypt.BCrypt;
import org.springframework.stereotype.Service;

import webrtc.controller.RegisterRequest;
import webrtc.domain.User;
import webrtc.mapper.UserMapper;

@Service
public class AuthService {
	
	public final UserMapper userMapper;
	
	public AuthService(UserMapper userMapper) {
		this.userMapper = userMapper;
	}
	
	/* 등록 */
	public void register(String username, String plainPassword) throws Exception {
		// 결과 변수
		int resultCnt = 0;
		
		// 사용자명 중복 확인
		User user = userMapper.selectUserByUsername(username);
		if(user != null) {
			throw new Exception("username is already taken."); // TODO: Exception 공통 모듈 구성후 교체하기
		}
		
		// 사용자 비밀번호 암호화
		String hashed = BCrypt.hashpw(plainPassword, BCrypt.gensalt());
		
		// 사용자 등록 정보 구성
		User newUser = new User();
		newUser.setUsername(username);
		newUser.setPassword(hashed);
		
		// 사용자 정보 등록
		resultCnt = userMapper.insertUser(newUser);
		if(resultCnt <= 0) {
			throw new Exception("user registering failed"); // TODO: Exception 공통 모듈 구성 후 교체하기
		}
	}
	
	/* 인증 */
    public boolean authenticate(String username, String password) {
        if (username == null || username.isBlank() || password == null) {
            return false;
        }
        
        // 사용자 조회
        User user = userMapper.selectUserByUsername(username);
        
        // 비밀번호 검증
        return BCrypt.checkpw(password, user.getPassword());
    }
}
