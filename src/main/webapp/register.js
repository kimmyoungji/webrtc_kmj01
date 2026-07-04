/**
 * 회원가입 페이지 전용 JavaScript
 * 역할: 사용자 입력 검증 → 서버에 회원가입 요청 → login.html로 리다이렉트
 */

async function handleRegister(event) {
  event.preventDefault();

  const username    = document.getElementById('username').value.trim();
  const password    = document.getElementById('password').value;
  const passwordCfm = document.getElementById('password-confirm').value;
  const errorMsg    = document.getElementById('error-message');
  const successMsg  = document.getElementById('success-message');
  const submitBtn   = document.getElementById('register-btn');

  errorMsg.textContent   = '';
  successMsg.textContent = '';

  // 입력값 검증
  if (!username || !password) {
    errorMsg.textContent = '사용자 이름과 비밀번호를 입력하세요.';
    return;
  }
  if (username.length < 2) {
    errorMsg.textContent = '사용자 이름은 2자 이상이어야 합니다.';
    return;
  }
  if (password.length < 4) {
    errorMsg.textContent = '비밀번호는 4자 이상이어야 합니다.';
    return;
  }
  if (password !== passwordCfm) {
    errorMsg.textContent = '비밀번호가 일치하지 않습니다.';
    return;
  }

  submitBtn.disabled    = true;
  submitBtn.textContent = '처리 중...';

  try {
    const contextPath = window.location.pathname.replace(/\/[^/]*$/, "");

    const response = await fetch(contextPath + '/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();

    if (response.ok) {
      successMsg.textContent = '회원가입이 완료되었습니다. 로그인 페이지로 이동합니다.';
      setTimeout(() => {
        window.location.href = 'login.html';
      }, 1500);
    } else {
      errorMsg.textContent = data.message || '회원가입에 실패했습니다.';
      submitBtn.disabled    = false;
      submitBtn.textContent = '✅ 가입하기';
    }
  } catch (error) {
    console.error('[register.js] 요청 오류:', error);
    errorMsg.textContent  = '서버에 연결할 수 없습니다. 다시 시도해주세요.';
    submitBtn.disabled    = false;
    submitBtn.textContent = '✅ 가입하기';
  }
}

// 이미 로그인 상태면 chat.html로 이동
window.addEventListener('DOMContentLoaded', () => {
  if (localStorage.getItem('jwtToken')) {
    window.location.href = 'chat.html';
  }
});
