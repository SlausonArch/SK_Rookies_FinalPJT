import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import axios from 'axios'
import './index.css'
import App from './App.tsx'

// CSRF: Spring CookieCsrfTokenRepository가 발급하는 XSRF-TOKEN 쿠키를
// 모든 상태 변경 요청(POST/PUT/PATCH/DELETE)의 X-XSRF-TOKEN 헤더로 자동 첨부
axios.defaults.withCredentials = true;
axios.defaults.xsrfCookieName = 'XSRF-TOKEN';
axios.defaults.xsrfHeaderName = 'X-XSRF-TOKEN';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
