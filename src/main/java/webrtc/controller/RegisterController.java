package webrtc.controller;

import org.mindrot.jbcrypt.BCrypt;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.ResponseBody;

import webrtc.domain.User;
import webrtc.service.AuthService;
import webrtc.service.UserService;

@Controller
public class RegisterController {
	
	private final AuthService authService;
	
	public RegisterController(AuthService authService) {
		this.authService = authService;
	}
	
	/* 사용자 등록 */
	@ResponseBody
	@RequestMapping(
	    value = "/api/register",
	    method = RequestMethod.POST,
	    consumes = "application/json"
	)
	public ResponseEntity<ApiResponse> register(@RequestBody RegisterRequest registerRequest ) throws Exception {
		
		// 사용자 정보 등록
		authService.register(registerRequest.getUsername(), registerRequest.getPassword());
				
		// apiResponse 생성
		ApiResponse<Void> apiResponse = new ApiResponse<>(true, "user registering succeed", null);
		
		// 응답
		return ResponseEntity.ok(apiResponse);
	}
}
