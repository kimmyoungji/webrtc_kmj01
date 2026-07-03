/**
 * 로그인 페이지 전용 JavaScript
 * 역할: 사용자 입력 → 서버에 로그인 요청 → JWT 토큰 저장 → chat.html로 리다이렉트
 */

async function handleLogin(event) {
  event.preventDefault();

  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value.trim();
  const errorMsg = document.getElementById('error-message');
  const loginBtn = document.getElementById('login-btn');

  // 입력값 검증
  if (!username || !password) {
    errorMsg.textContent = '사용자 이름과 비밀번호를 입력하세요.';
    return;
  }

  // 로그인 중 상태
  loginBtn.disabled = true;
  loginBtn.textContent = '로그인 중...';
  errorMsg.textContent = '';

  try {
    // 컨텍스트 패스 추출
    const contextPath = window.location.pathname.replace(/\/[^/]*$/, "");

    // 1. 서버에 로그인 요청
    const response = await fetch(contextPath + '/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: username,
        password: password,
      }),
    });

    // 2. 응답 처리
    const data = await response.json();

    if (response.ok && data.token) {
      // 성공: JWT 토큰을 로컬 스토리지에 저장
      localStorage.setItem('jwtToken', data.token);
      localStorage.setItem('username', data.username);

      console.log('[login.js] 로그인 성공:', data.username);

      // chat.html로 리다이렉트 (약간의 딜레이 후)
      setTimeout(() => {
        window.location.href = 'chat.html';
      }, 300);
    } else {
      // 실패: 오류 메시지 표시
      errorMsg.textContent = data.message || '로그인에 실패했습니다.';
      loginBtn.disabled = false;
      loginBtn.textContent = '🔐 로그인';
      console.error('[login.js] 로그인 실패:', data.message);
    }
  } catch (error) {
    // 네트워크 오류
    console.error('[login.js] 요청 오류:', error);
    errorMsg.textContent = '서버에 연결할 수 없습니다. 다시 시도해주세요.';
    loginBtn.disabled = false;
    loginBtn.textContent = '🔐 로그인';
  }
}

// 페이지 로드 시: 이미 로그인되어 있으면 chat.html로 리다이렉트
window.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('jwtToken');
  if (token) {
    console.log('[login.js] 이미 로그인 상태이므로 chat.html로 리다이렉트합니다.');
    window.location.href = 'chat.html';
  }
});
