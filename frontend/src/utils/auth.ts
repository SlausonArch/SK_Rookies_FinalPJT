const COOKIE_PATH = 'path=/';
const COOKIE_MAX_AGE = 'max-age=86400';

export const USER_ACCESS_TOKEN_KEY = 'accessToken';
export const USER_REFRESH_TOKEN_KEY = 'refreshToken';
export const USER_TOKEN_COOKIE = 'vce_token';
export const USER_LOGGED_OUT_SENTINEL = 'LOGGED_OUT';

export const ADMIN_ACCESS_TOKEN_KEY = 'adminAccessToken';
export const ADMIN_ROLE_KEY = 'adminRole';
export const ADMIN_EMAIL_KEY = 'adminEmail';
export const ADMIN_NAME_KEY = 'adminName';
export const ADMIN_TOKEN_COOKIE = 'vce_admin_token';
export const ADMIN_LOGGED_OUT_SENTINEL = 'ADMIN_LOGGED_OUT';

const LEGACY_ADMIN_TOKEN_KEY = 'token';
const LEGACY_ADMIN_ROLE_KEY = 'role';
const LEGACY_ADMIN_EMAIL_KEY = 'email';
const LEGACY_ADMIN_NAME_KEY = 'name';

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

function migrateLegacyAdminSession() {
  const legacyToken = localStorage.getItem(LEGACY_ADMIN_TOKEN_KEY);
  const legacyRole = localStorage.getItem(LEGACY_ADMIN_ROLE_KEY);

  if (legacyToken && legacyRole === 'ADMIN' && !localStorage.getItem(ADMIN_ACCESS_TOKEN_KEY)) {
    localStorage.setItem(ADMIN_ACCESS_TOKEN_KEY, legacyToken);
    localStorage.setItem(ADMIN_ROLE_KEY, legacyRole);

    const legacyEmail = localStorage.getItem(LEGACY_ADMIN_EMAIL_KEY);
    const legacyName = localStorage.getItem(LEGACY_ADMIN_NAME_KEY);
    if (legacyEmail) {
      localStorage.setItem(ADMIN_EMAIL_KEY, legacyEmail);
    }
    if (legacyName) {
      localStorage.setItem(ADMIN_NAME_KEY, legacyName);
    }

    setCookie(ADMIN_TOKEN_COOKIE, legacyToken);
  }

  clearStorageKeys([
    LEGACY_ADMIN_TOKEN_KEY,
    LEGACY_ADMIN_ROLE_KEY,
    LEGACY_ADMIN_EMAIL_KEY,
    LEGACY_ADMIN_NAME_KEY,
  ]);
}

export function syncAuthState() {
  migrateLegacyAdminSession();
  syncTokenPair(USER_TOKEN_COOKIE, USER_ACCESS_TOKEN_KEY, USER_LOGGED_OUT_SENTINEL, [USER_REFRESH_TOKEN_KEY]);
  syncTokenPair(
    ADMIN_TOKEN_COOKIE,
    ADMIN_ACCESS_TOKEN_KEY,
    ADMIN_LOGGED_OUT_SENTINEL,
    [ADMIN_ROLE_KEY, ADMIN_EMAIL_KEY, ADMIN_NAME_KEY],
  );
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
  return localStorage.getItem(ADMIN_ROLE_KEY);
}

export function getAdminName(): string | null {
  return localStorage.getItem(ADMIN_NAME_KEY);
}

export function setAdminSession(accessToken: string, role: string, email: string, name: string) {
  localStorage.setItem(ADMIN_ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(ADMIN_ROLE_KEY, role);
  localStorage.setItem(ADMIN_EMAIL_KEY, email);
  localStorage.setItem(ADMIN_NAME_KEY, name);
  setCookie(ADMIN_TOKEN_COOKIE, accessToken);
  dispatchAuthChange();
}

export function clearAdminSession(shareAcrossOrigins = false) {
  clearStorageKeys([ADMIN_ACCESS_TOKEN_KEY, ADMIN_ROLE_KEY, ADMIN_EMAIL_KEY, ADMIN_NAME_KEY]);
  if (shareAcrossOrigins) {
    setCookie(ADMIN_TOKEN_COOKIE, ADMIN_LOGGED_OUT_SENTINEL);
  } else {
    clearCookie(ADMIN_TOKEN_COOKIE);
  }
  dispatchAuthChange();
}
