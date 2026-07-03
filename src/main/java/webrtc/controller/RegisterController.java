package webrtc.controller;

import java.util.HashMap;

import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.ResponseBody;

import webrtc.domain.User;
import webrtc.service.UserService;

@Controller
public class RegisterController {
	
	private final UserService userService;
	
	public RegisterController(UserService userService) {
		this.userService = userService;
	}
	
	/* 사용자 등록 */
	@ResponseBody
	@RequestMapping(
	    value = "/api/register",
	    method = RequestMethod.POST,
	    consumes = "application/json"
	)
	public ResponseEntity<ApiResponse> register(@RequestBody RegisterRequest registerRequest ) throws Exception {
		// 결과 변수
		int resultCnt = 0;
		
		// 사용자명 중복 확인
		User user = userService.selectUserByUsername(registerRequest.getUsername());
		if(user != null) {
			throw new Exception("username is already taken."); // TODO: Exception 공통 모듈 구성후 교체하기
		}
		
		// 사용자 비밀번호 암호화
		String encryptedPw = registerRequest.getPassword() + "103249fnkav@@@@@nvaliri2io50234"; // TODO:암호화 모듈로 교체하기
		
		// 사용자 등록 정보 구성
		User newUser = new User();
		newUser.setUsername(registerRequest.getUsername());
		newUser.setPassword(encryptedPw);
		
		// 사용자 정보 등록
		resultCnt = userService.insertUser(newUser);
		if(resultCnt <= 0) {
			throw new Exception("user registering failed"); // TODO: Exception 공통 모듈 구성 후 교체하기
		}
				
		// apiResponse 생성
		ApiResponse<Void> apiResponse = new ApiResponse<>(true, "user registering succeed", null);
		
		// 응답
		return ResponseEntity.ok(apiResponse);
	}
}
