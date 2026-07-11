package webrtc.security;

import java.io.IOException;

import javax.servlet.FilterChain;
import javax.servlet.ServletException;
import javax.servlet.http.Cookie;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * JWT 인증 필터
 * 모든 HTTP 요청에 대해 JWT 토큰 검증을 수행합니다.
 * /api/login 요청은 검증 대상에서 제외합니다.
 */
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(JwtAuthenticationFilter.class);

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        
        String requestPath = request.getRequestURI();
        String method = request.getMethod();

        // 인증 불필요 요청은 검증 제외
        if ("POST".equals(method) && (requestPath.contains("/api/login")
                || requestPath.contains("/api/register")
                || requestPath.contains("/api/logout"))) {
            log.debug("인증 불필요 요청이므로 필터 스킵: {}", requestPath);
            filterChain.doFilter(request, response);
            return;
        }

        // WebSocket 엔드포인트는 필터 제외 (SignalingHandler에서 검증)
        if (requestPath.contains("/ws")) {
            log.debug("WebSocket 요청이므로 필터 스킵: {}", requestPath);
            filterChain.doFilter(request, response);
            return;
        }

        // /api 요청에 대해서만 JWT 검증
        if (requestPath.contains("/api")) {
        	
        	/* 1) Header Authorization 속성에 담아오는 방식
        	String authHeader = request.getHeader("Authorization");

            if (authHeader == null || !authHeader.startsWith("Bearer ")) {
                log.warn("Authorization 헤더가 없거나 형식이 잘못됨: {}", requestPath);
                response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                response.setContentType("application/json;charset=UTF-8");
                response.getWriter().write("{\"valid\": false, \"message\": \"Authorization 헤더가 없습니다.\"}");
                return;
            } 
            String token = authHeader.substring("Bearer ".length()).trim();
            */
        	
        	/* 2) Cookie에서 추출하는 방식 */
        	String token = null;
        	Cookie[] cookies = request.getCookies();
        	if (cookies != null) {
        	    for (Cookie cookie : cookies) {
        	        if ("ACCESS_TOKEN".equals(cookie.getName())) {
        	            token = cookie.getValue();
        	            break;
        	        }
        	    }
        	}
        	
        	// 빈 토큰 검증
        	if (token == null || token.isBlank()) {
        	    response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        	    response.setContentType("application/json;charset=UTF-8");
        	    response.getWriter().write("{\"valid\": false, \"message\": \"인증 쿠키가 없습니다.\"}");
        	    return;
        	}

            // JWT 검증
            if (!JwtUtil.validateToken(token)) {
                log.warn("JWT 토큰 검증 실패: {}", requestPath);
                response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                response.setContentType("application/json;charset=UTF-8");
                response.getWriter().write("{\"valid\": false, \"message\": \"토큰이 유효하지 않습니다.\"}");
                return;
            }

            // 토큰에서 사용자명 추출
            String username = JwtUtil.getUsernameFromToken(token);
            if (username == null || username.isEmpty()) {
                log.warn("JWT에서 사용자명을 찾을 수 없음: {}", requestPath);
                response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                response.setContentType("application/json;charset=UTF-8");
                response.getWriter().write("{\"valid\": false, \"message\": \"토큰에서 사용자 정보를 찾을 수 없습니다.\"}");
                return;
            }

            // 검증된 사용자명을 request 속성에 저장 (컨트롤러에서 사용 가능)
            request.setAttribute("jwtUsername", username);
            request.setAttribute("jwtToken", token);
            log.debug("JWT 검증 성공: {} (user: {})", requestPath, username);
        }

        // 다음 필터로 요청 전달
        filterChain.doFilter(request, response);
    }
}
