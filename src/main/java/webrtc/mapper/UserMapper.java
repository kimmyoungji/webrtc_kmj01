package webrtc.mapper;

import org.apache.ibatis.annotations.Mapper;

import webrtc.domain.User;

@Mapper
public interface UserMapper {
	
	/* 사용자 등록 */
	public int insertUser(User user);
	
	/* 사용자이름으로 사용자 조회 */
	public User selectUserByUsername(String username);
	
}
