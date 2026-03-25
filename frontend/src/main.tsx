import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import axios from 'axios'
import './index.css'
import App from './App.tsx'

// JWT는 localStorage에 저장 후 Authorization 헤더로 전송하므로 CSRF 불필요
// 쿠키 기반 인증(세션)이 아니기 때문에 CSRF 공격 벡터 자체가 존재하지 않음
axios.defaults.withCredentials = true;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
