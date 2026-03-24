const COOKIE_PATH = 'path=/';
const COOKIE_MAX_AGE = 'max-age=86400';

export const USER_ACCESS_TOKEN_KEY = 'accessToken';
export const USER_REFRESH_TOKEN_KEY = 'refreshToken';
export const USER_TOKEN_COOKIE = 'vce_token';
export const USER_LOGGED_OUT_SENTINEL = 'LOGGED_OUT';

export const ADMIN_ACCESS_TOKEN_KEY = 'adminAccessToken';
export const ADMIN_TOKEN_COOKIE = 'vce_admin_token';
export const ADMIN_LOGGED_OUT_SENTINEL = 'ADMIN_LOGGED_OUT';

function dispatchAuthChange() {
  window.dispatchEvent(new Event('storage'));
}

export function getCookie(name: string): string | null {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length !== 2) {
    return null;
  }

  const token = parts.pop()?.split(';').shift();
  if (!token || token === 'null' || token === 'undefined') {
    return null;
  }

  return token;
}

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${value}; ${COOKIE_PATH}; ${COOKIE_MAX_AGE}`;
}

function clearCookie(name: string) {
  document.cookie = `${name}=; ${COOKIE_PATH}; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

function getJwtIat(token: string | null): number {
  if (!token || token.length < 20) {
    return 0;
  }

  try {
    const payload = token.split('.')[1];
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = JSON.parse(atob(normalized));
    return Number(decoded.iat) || 0;
  } catch {
    return 0;
  }
}

function getJwtPayload(token: string | null): Record<string, unknown> | null {
  if (!token || token.length < 20) return null;
  try {
    const payload = token.split('.')[1];
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(normalized));
  } catch {
    return null;
  }
}

function clearStorageKeys(keys: string[]) {
  keys.forEach(key => localStorage.removeItem(key));
}

function syncTokenPair(
  cookieName: string,
  storageKey: string,
  logoutSentinel: string,
  extraKeysToClear: string[] = [],
) {
  const cookieToken = getCookie(cookieName);
  const localToken = localStorage.getItem(storageKey);

  if (cookieToken === logoutSentinel) {
    clearStorageKeys([storageKey, ...extraKeysToClear]);
    dispatchAuthChange();
    return;
  }

  if (cookieToken && localToken && cookieToken !== localToken) {
    const cookieIat = getJwtIat(cookieToken);
    const localIat = getJwtIat(localToken);

    if (localIat > cookieIat) {
      setCookie(cookieName, localToken);
    } else {
      localStorage.setItem(storageKey, cookieToken);
      dispatchAuthChange();
    }
    return;
  }

  if (cookieToken && !localToken && cookieToken.length > 20) {
    localStorage.setItem(storageKey, cookieToken);
    dispatchAuthChange();
    return;
  }

  if (!cookieToken && localToken && localToken.length > 20) {
    setCookie(cookieName, localToken);
  }
}

// 레거시 키 정리 (이전 버전 호환)
function migrateLegacyAdminSession() {
  const LEGACY_KEYS = ['token', 'role', 'email', 'name', 'adminRole', 'adminEmail', 'adminName'];
  const legacyToken = localStorage.getItem('token');

  // 구버전 token 키가 있고 adminAccessToken이 없으면 마이그레이션
  if (legacyToken && !localStorage.getItem(ADMIN_ACCESS_TOKEN_KEY)) {
    localStorage.setItem(ADMIN_ACCESS_TOKEN_KEY, legacyToken);
    setCookie(ADMIN_TOKEN_COOKIE, legacyToken);
  }

  clearStorageKeys(LEGACY_KEYS);
}

export function syncAuthState() {
  migrateLegacyAdminSession();
  syncTokenPair(USER_TOKEN_COOKIE, USER_ACCESS_TOKEN_KEY, USER_LOGGED_OUT_SENTINEL, [USER_REFRESH_TOKEN_KEY]);
  syncTokenPair(ADMIN_TOKEN_COOKIE, ADMIN_ACCESS_TOKEN_KEY, ADMIN_LOGGED_OUT_SENTINEL);
}

export function getUserAccessToken(): string | null {
  return localStorage.getItem(USER_ACCESS_TOKEN_KEY);
}

export function getUserRefreshToken(): string | null {
  return localStorage.getItem(USER_REFRESH_TOKEN_KEY);
}

export function setUserSession(accessToken: string, refreshToken?: string | null) {
  localStorage.setItem(USER_ACCESS_TOKEN_KEY, accessToken);
  if (refreshToken) {
    localStorage.setItem(USER_REFRESH_TOKEN_KEY, refreshToken);
  } else {
    localStorage.removeItem(USER_REFRESH_TOKEN_KEY);
  }
  setCookie(USER_TOKEN_COOKIE, accessToken);
  dispatchAuthChange();
}

export function clearUserSession(shareAcrossOrigins = true) {
  clearStorageKeys([USER_ACCESS_TOKEN_KEY, USER_REFRESH_TOKEN_KEY]);
  if (shareAcrossOrigins) {
    setCookie(USER_TOKEN_COOKIE, USER_LOGGED_OUT_SENTINEL);
  } else {
    clearCookie(USER_TOKEN_COOKIE);
  }
  dispatchAuthChange();
}

export function getAdminAccessToken(): string | null {
  return localStorage.getItem(ADMIN_ACCESS_TOKEN_KEY);
}

export function getAdminRole(): string | null {
  const token = localStorage.getItem(ADMIN_ACCESS_TOKEN_KEY);
  const payload = getJwtPayload(token);
  return (payload?.role as string) ?? null;
}

export function getAdminEmail(): string | null {
  const token = localStorage.getItem(ADMIN_ACCESS_TOKEN_KEY);
  const payload = getJwtPayload(token);
  return (payload?.sub as string) ?? null;
}

export function getAdminName(): string | null {
  const token = localStorage.getItem(ADMIN_ACCESS_TOKEN_KEY);
  const payload = getJwtPayload(token);
  return (payload?.name as string) ?? null;
}

export function setAdminSession(accessToken: string) {
  localStorage.setItem(ADMIN_ACCESS_TOKEN_KEY, accessToken);
  setCookie(ADMIN_TOKEN_COOKIE, accessToken);
  dispatchAuthChange();
}

export function clearAdminSession(shareAcrossOrigins = false) {
  localStorage.removeItem(ADMIN_ACCESS_TOKEN_KEY);
  if (shareAcrossOrigins) {
    setCookie(ADMIN_TOKEN_COOKIE, ADMIN_LOGGED_OUT_SENTINEL);
  } else {
    clearCookie(ADMIN_TOKEN_COOKIE);
  }
  dispatchAuthChange();
}
