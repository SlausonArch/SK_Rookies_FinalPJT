import { cookies } from 'next/headers'

import { API_BASE_URL } from '@/config/publicEnv'
import {
  ADMIN_LOGGED_OUT_SENTINEL,
  ADMIN_TOKEN_COOKIE,
  USER_LOGGED_OUT_SENTINEL,
  USER_TOKEN_COOKIE,
} from '@/utils/auth-constants'

type AuthScope = 'admin' | 'none' | 'user'

type BackendRequestInit = Omit<RequestInit, 'headers'> & {
  auth?: AuthScope
  headers?: HeadersInit
}

export class BackendRequestError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'BackendRequestError'
    this.status = status
  }
}

async function getAuthToken(scope: AuthScope): Promise<string | null> {
  if (scope === 'none') {
    return null
  }

  const cookieStore = await cookies()
  const cookieName = scope === 'admin' ? ADMIN_TOKEN_COOKIE : USER_TOKEN_COOKIE
  const sentinel = scope === 'admin' ? ADMIN_LOGGED_OUT_SENTINEL : USER_LOGGED_OUT_SENTINEL
  const value = cookieStore.get(cookieName)?.value

  if (!value || value === sentinel) {
    return null
  }

  return value
}

async function readResponseBody(response: Response): Promise<unknown> {
  if (response.status === 204) {
    return null
  }

  const text = await response.text()
  if (!text) {
    return null
  }

  const contentType = response.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(text)
    } catch {
      return text
    }
  }

  return text
}

function toErrorMessage(body: unknown, status: number): string {
  if (typeof body === 'string' && body.trim()) {
    return body.trim()
  }

  if (body && typeof body === 'object') {
    const message = (body as Record<string, unknown>).message
    if (typeof message === 'string' && message.trim()) {
      return message.trim()
    }
  }

  if (status === 401) {
    return '로그인이 필요합니다.'
  }

  if (status === 403) {
    return '요청을 처리할 권한이 없습니다.'
  }

  return '요청 처리 중 오류가 발생했습니다.'
}

export async function requestBackend<T>(
  path: string,
  init: BackendRequestInit = {},
): Promise<T> {
  const { auth = 'none', headers: inputHeaders, ...rest } = init
  const headers = new Headers(inputHeaders)
  const token = await getAuthToken(auth)

  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers,
    cache: 'no-store',
  })

  const body = await readResponseBody(response)

  if (!response.ok) {
    throw new BackendRequestError(toErrorMessage(body, response.status), response.status)
  }

  return body as T
}
