package webrtc.service;

import org.springframework.stereotype.Service;

import webrtc.domain.User;
import webrtc.mapper.UserMapper;

@Service
public class UserService {
	
	public final UserMapper userMapper;
	
	/* 생성자 */
	public UserService(UserMapper userMapper) {
		this.userMapper = userMapper;
	}
	
	/* 사용자이름으로 사용자 조회 */
	public User selectUserByUsername(String username) {
		return userMapper.selectUserByUsername(username);
	}
	
	/* 사용자 등록 */
	public int insertUser(User user) {
		return userMapper.insertUser(user);
	}
	
}
