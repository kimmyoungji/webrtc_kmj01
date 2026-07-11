package webrtc.interceptor;

import java.util.Map;

import javax.servlet.http.Cookie;
import javax.servlet.http.HttpServletRequest;

import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.lang.Nullable;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

public class CookieHandShakeInterceptor implements HandshakeInterceptor{
	
	/**
	 * Invoked before the handshake is processed.
	 * @param request the current request
	 * @param response the current response
	 * @param wsHandler the target WebSocket handler
	 * @param attributes the attributes from the HTTP handshake to associate with the WebSocket
	 * session; the provided attributes are copied, the original map is not used.
	 * @return whether to proceed with the handshake ({@code true}) or abort ({@code false})
	 */
	@Override
	public boolean beforeHandshake(
			ServerHttpRequest request, ServerHttpResponse response,
			WebSocketHandler wsHandler,Map<String, Object> attributes) throws Exception 
	{
		if(request instanceof ServletServerHttpRequest servletRequest) {
			HttpServletRequest httpRequest = servletRequest.getServletRequest();
			
			Cookie[] cookies = httpRequest.getCookies();
			
			if(cookies != null) {
				for(Cookie cookie : cookies) {
					if("ACCESS_TOKEN".equals(cookie.getName())) {
						attributes.put("ACCESS_TOKEN", cookie.getValue());
					}
				}
			}
		}
		
		return true;
	}

	/**
	 * Invoked after the handshake is done. The response status and headers indicate
	 * the results of the handshake, i.e. whether it was successful or not.
	 * @param request the current request
	 * @param response the current response
	 * @param wsHandler the target WebSocket handler
	 * @param exception an exception raised during the handshake, or {@code null} if none
	 */
	@Override
	public void afterHandshake(
			ServerHttpRequest request, ServerHttpResponse response,
			WebSocketHandler  wsHandler, @Nullable Exception exception
	){
			
	}
}
