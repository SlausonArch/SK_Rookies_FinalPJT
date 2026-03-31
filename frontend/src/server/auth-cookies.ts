import { cookies } from 'next/headers'

import { USER_TOKEN_COOKIE } from '@/utils/auth-constants'

const COOKIE_OPTIONS = {
  maxAge: 60 * 60 * 24,
  path: '/',
  sameSite: 'lax' as const,
}

export async function setUserAccessTokenCookie(token: string) {
  const cookieStore = await cookies()
  cookieStore.set(USER_TOKEN_COOKIE, token, COOKIE_OPTIONS)
}
