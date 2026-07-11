/**
 * auth.js
 * 공통 인증 모듈
 * 역할: 모든 페이지에서 토큰 유효성 확인 및 재인증 처리
 */

/**
 * 현재 토큰이 유효한지 확인 (로컬 스토리지만 확인, 서버 검증 없음)
 * 주의: 이것은 로컬 확인일 뿐이며, 실제 검증은 서버 필터에서 수행
 */
function hasValidToken() {
  const token = localStorage.getItem('jwtToken');
  return token && token.trim().length > 0;
}

/**
 * 로그아웃 처리 — 서버에 POST /api/logout 요청으로 HttpOnly 쿠키 제거
 * @param {boolean} skipConfirm - true면 confirm 다이얼로그 생략 (401 자동 로그아웃 등)
 */
async function performLogout(skipConfirm = false) {
  if (!skipConfirm && !confirm('로그아웃하시겠습니까?')) return;

  /* type1: localStorage 방식
  localStorage.removeItem('jwtToken');
  localStorage.removeItem('username');
  window.location.href = 'login.html';
  */

  /* type2: HttpOnly 쿠키 방식 */
  const contextPath = window.location.pathname.replace(/\/[^/]*$/, "");
  try {
    await fetch(contextPath + '/api/logout', {
      method: 'POST',
      credentials: 'include'
    });
  } catch (e) {
    console.warn('[auth.js] 로그아웃 요청 실패 (서버 응답 없음):', e);
  }

  sessionStorage.removeItem('username');
  window.location.href = 'login.html';
}

/**
 * HTTP 요청 시 토큰을 Authorization 헤더에 자동 추가
 * 모든 fetch 요청에 사용 가능
 */
/* function getAuthHeaders() {
  const token = localStorage.getItem('jwtToken');
  return {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : ''
  }; 
} */

/**
 * fetch 래퍼: 토큰을 자동으로 포함하고, 401 에러 시 로그인 페이지로 리다이렉트
 * @param {string} url - 요청 URL
 * @param {object} options - fetch 옵션
 * @returns {Promise} fetch 응답
 */
async function authorizedFetch(url, options = {}) {
  
  /* type1
  const headers = getAuthHeaders();
  const mergedOptions = {
    ...options,
    headers: {
      ...headers,
      ...(options.headers || {})
    },
  };
  */
 
   /* type2 */
   const mergedOptions = {
	  ...options,
	  credentials: 'include',
	  headers: {
		...(options.headers || {})
	  }
   }

  const response = await fetch(url, mergedOptions);

  // 401 Unauthorized: 토큰 만료 또는 무효
  if (response.status === 401) {
    console.warn('[auth.js] 401 Unauthorized - 토큰 검증 실패. 로그인 페이지로 이동합니다.');
    performLogout(true);
    throw new Error('인증 토큰이 유효하지 않습니다. 다시 로그인해주세요.');
  }

  return response;
}

console.log('[auth.js] 인증 모듈 로드됨');
