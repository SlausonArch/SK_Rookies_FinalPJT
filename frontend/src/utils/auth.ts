// ─── 상수 ──────────────────────────────────────────────────────────────────
export const EXCHANGE_ACCESS_TOKEN_KEY = 'exchangeAccessToken';
export const BANK_ACCESS_TOKEN_KEY = 'bankAccessToken';
export const ADMIN_ACCESS_TOKEN_KEY = 'token';

const APP_MODE = (import.meta as Record<string, any>).env?.VITE_APP_MODE || 'exchange';

/** 현재 앱 모드(exchange/bank)에 맞는 sessionStorage 키 */
const CURRENT_ACCESS_TOKEN_KEY =
  APP_MODE === 'bank' ? BANK_ACCESS_TOKEN_KEY : EXCHANGE_ACCESS_TOKEN_KEY;

// exchange/bank 구분 전 레거시 키 — 마이그레이션에서만 사용
const LEGACY_USER_KEY = 'accessToken';

// 크로스탭 로그아웃 신호용 (실제 토큰은 아님)
const USER_LOGOUT_SIGNAL_KEY = 'userLogoutSignal';
const ADMIN_LOGOUT_SIGNAL_KEY = 'adminLogoutSignal';

// ─── 내부 유틸 ─────────────────────────────────────────────────────────────
function dispatchAuthChange() {
  window.dispatchEvent(new Event('storage'));
}

function getJwtPayload(token: string | null): Record<string, unknown> | null {
  if (!token || token.length < 20) return null;
  try {
    const payload = token.split('.')[1];
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(normalized);
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    return JSON.parse(new TextDecoder('utf-8').decode(bytes));
  } catch {
    return null;
  }
}

// ─── 레거시 마이그레이션 ────────────────────────────────────────────────────
/**
 * 이전 버전에서 localStorage / 구 키에 저장된 토큰을 현재 키로 이전 후 삭제.
 * 앱 초기화 시 한 번만 호출된다.
 */
function migrateLegacyStorage() {
  const LEGACY_KEYS = [
    LEGACY_USER_KEY, 'refreshToken',
    ADMIN_ACCESS_TOKEN_KEY,
    'adminAccessToken', 'role', 'email', 'name', 'adminRole', 'adminEmail', 'adminName',
  ];

  // 구 'accessToken' 키 → 현재 모드 키로 이전
  const legacyAccess = localStorage.getItem(LEGACY_USER_KEY)
    || sessionStorage.getItem(LEGACY_USER_KEY);
  if (legacyAccess && !sessionStorage.getItem(CURRENT_ACCESS_TOKEN_KEY)) {
    sessionStorage.setItem(CURRENT_ACCESS_TOKEN_KEY, legacyAccess);
  }
  sessionStorage.removeItem(LEGACY_USER_KEY);

  // 관리자 토큰 마이그레이션
  const legacyAdmin = localStorage.getItem(ADMIN_ACCESS_TOKEN_KEY)
    || localStorage.getItem('adminAccessToken');
  if (legacyAdmin && !sessionStorage.getItem(ADMIN_ACCESS_TOKEN_KEY)) {
    sessionStorage.setItem(ADMIN_ACCESS_TOKEN_KEY, legacyAdmin);
  }

  LEGACY_KEYS.forEach(key => localStorage.removeItem(key));
}

// ─── 초기화 (모듈 로드 시 1회) ─────────────────────────────────────────────
migrateLegacyStorage();

// ─── 사용자 세션 ────────────────────────────────────────────────────────────
/**
 * 로그인 성공 후 호출.
 * 액세스 토큰은 현재 모드(exchange/bank)별 sessionStorage 키에 저장.
 * 리프레시 토큰은 서버가 HttpOnly 쿠키로 설정하므로 JS에서 저장하지 않는다.
 */
export function setUserSession(accessToken: string, _refreshToken?: string | null) {
  sessionStorage.setItem(CURRENT_ACCESS_TOKEN_KEY, accessToken);
  dispatchAuthChange();
}

export function getUserAccessToken(): string | null {
  return sessionStorage.getItem(CURRENT_ACCESS_TOKEN_KEY);
}

export function clearUserSession(_shareAcrossOrigins = true) {
  sessionStorage.removeItem(CURRENT_ACCESS_TOKEN_KEY);
  // 크로스탭 로그아웃 신호
  localStorage.setItem(USER_LOGOUT_SIGNAL_KEY, Date.now().toString());
  dispatchAuthChange();
}

// ─── 관리자 세션 ────────────────────────────────────────────────────────────
/**
 * 관리자 로그인 성공 후 호출.
 * 서버가 HttpOnly 쿠키도 설정하지만, 관리자 역할/이름 파싱을 위해
 * sessionStorage에도 저장한다 (탭 닫으면 삭제).
 */
export function setAdminSession(accessToken: string) {
  sessionStorage.setItem(ADMIN_ACCESS_TOKEN_KEY, accessToken);
  dispatchAuthChange();
}

export function getAdminAccessToken(): string | null {
  return sessionStorage.getItem(ADMIN_ACCESS_TOKEN_KEY);
}

export function getAdminRole(): string | null {
  const payload = getJwtPayload(sessionStorage.getItem(ADMIN_ACCESS_TOKEN_KEY));
  return (payload?.role as string) ?? null;
}

export function getAdminName(): string | null {
  const payload = getJwtPayload(sessionStorage.getItem(ADMIN_ACCESS_TOKEN_KEY));
  return (payload?.name as string) ?? null;
}

export function clearAdminSession(_shareAcrossOrigins = false) {
  sessionStorage.removeItem(ADMIN_ACCESS_TOKEN_KEY);
  localStorage.setItem(ADMIN_LOGOUT_SIGNAL_KEY, Date.now().toString());
  dispatchAuthChange();
}

// ─── 모드별 초기 동기화 (App.tsx에서 호출) ──────────────────────────────────
/**
 * 거래소/은행 모드: 관리자 sessionStorage를 비운다.
 * 또한 다른 사용자 모드(bank↔exchange) 토큰은 건드리지 않는다 — 별도 키이므로 격리됨.
 */
export function syncUserAuthState() {
  sessionStorage.removeItem(ADMIN_ACCESS_TOKEN_KEY);
  localStorage.removeItem(ADMIN_ACCESS_TOKEN_KEY);
}

/**
 * 관리자 모드: 사용자 sessionStorage를 비운다.
 */
export function syncAdminAuthState() {
  sessionStorage.removeItem(EXCHANGE_ACCESS_TOKEN_KEY);
  sessionStorage.removeItem(BANK_ACCESS_TOKEN_KEY);
  localStorage.removeItem(EXCHANGE_ACCESS_TOKEN_KEY);
  localStorage.removeItem(BANK_ACCESS_TOKEN_KEY);
}
