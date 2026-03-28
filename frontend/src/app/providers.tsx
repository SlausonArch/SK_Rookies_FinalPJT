'use client'

import { useEffect, useRef } from 'react'
import axios from 'axios'
import { syncAuthState, setUserSession, getUserRefreshToken } from '@/utils/auth'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:18080'

export function Providers({ children }: { children: React.ReactNode }) {
  const lastActivityRef = useRef<number>(Date.now())

  useEffect(() => {
    syncAuthState()
    const interval = setInterval(syncAuthState, 5000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const updateActivity = () => { lastActivityRef.current = Date.now() }
    window.addEventListener('click', updateActivity)
    window.addEventListener('keydown', updateActivity)
    window.addEventListener('mousemove', updateActivity)
    window.addEventListener('scroll', updateActivity)

    const refreshInterval = setInterval(async () => {
      const accessToken = localStorage.getItem('accessToken')
      const refreshToken = getUserRefreshToken()
      if (!accessToken || !refreshToken) return

      if (Date.now() - lastActivityRef.current > 30 * 60 * 1000) return

      try {
        const payload = JSON.parse(atob(accessToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
        const expiresAt = (payload.exp as number) * 1000
        if (expiresAt - Date.now() < 5 * 60 * 1000) {
          const res = await axios.post(`${API_BASE}/api/auth/refresh`, { refreshToken })
          if (res.data?.accessToken) {
            setUserSession(res.data.accessToken)
          }
        }
      } catch {
        // 갱신 실패 시 다음 주기에 재시도
      }
    }, 60 * 1000)

    return () => {
      clearInterval(refreshInterval)
      window.removeEventListener('click', updateActivity)
      window.removeEventListener('keydown', updateActivity)
      window.removeEventListener('mousemove', updateActivity)
      window.removeEventListener('scroll', updateActivity)
    }
  }, [])

  return <>{children}</>
}
