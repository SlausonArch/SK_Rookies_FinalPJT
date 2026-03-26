import { useEffect, useRef } from 'react';
import axios from 'axios';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Signup from './pages/Signup';
import SignupComplete from './pages/SignupComplete';
import Home from './pages/Home';
import BankDashboard from './pages/bank/BankDashboard';
import OAuthCallback from './pages/OAuthCallback';
import Community from './pages/Community';
import CommunityDetail from './pages/community/CommunityDetail';
import CommunityWrite from './pages/community/CommunityWrite';
import Exchange from './pages/Exchange';
import AdminLogin from './pages/admin/AdminLogin';
import AdminDashboard from './pages/admin/AdminDashboard';
import Balances from './pages/Balances';
import Investments from './pages/Investments';
import Trends from './pages/Trends';
import MyPage from './pages/MyPage';
import WithdrawalComplete from './pages/WithdrawalComplete';
import Events from './pages/Events';
import Support from './pages/Support';
import PrivacyPolicy from './pages/PrivacyPolicy';
import { syncUserAuthState, syncAdminAuthState, setUserSession, getUserRefreshToken } from './utils/auth';

const mode = import.meta.env.VITE_APP_MODE || 'exchange'; // 'bank' or 'exchange' or 'admin'
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:18080';

// 모드별로 해당 토큰만 초기 동기화 (관리자 토큰이 거래소/은행에 노출되지 않도록 분리)
if (mode === 'admin') {
  syncAdminAuthState();
} else {
  syncUserAuthState();
}

function App() {
  const lastActivityRef = useRef<number>(Date.now());

  useEffect(() => {
    const syncFn = mode === 'admin' ? syncAdminAuthState : syncUserAuthState;
    syncFn();
    const interval = setInterval(syncFn, 5000);
    return () => clearInterval(interval);
  }, []);

  // 사용자 활동 감지 및 세션 자동 연장
  useEffect(() => {
    const updateActivity = () => { lastActivityRef.current = Date.now(); };
    window.addEventListener('click', updateActivity);
    window.addEventListener('keydown', updateActivity);
    window.addEventListener('mousemove', updateActivity);
    window.addEventListener('scroll', updateActivity);

    const refreshInterval = setInterval(async () => {
      const accessToken = localStorage.getItem('accessToken');
      const refreshToken = getUserRefreshToken();
      if (!accessToken || !refreshToken) return;

      // 마지막 활동으로부터 30분 이상 경과 시 갱신 생략
      if (Date.now() - lastActivityRef.current > 30 * 60 * 1000) return;

      // access token 만료 5분 전부터 갱신
      try {
        const payload = JSON.parse(atob(accessToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        const expiresAt = (payload.exp as number) * 1000;
        if (expiresAt - Date.now() < 5 * 60 * 1000) {
          const res = await axios.post(`${API_BASE}/api/auth/refresh`, { refreshToken });
          if (res.data?.accessToken) {
            setUserSession(res.data.accessToken);
          }
        }
      } catch {
        // 갱신 실패 시 무시 (다음 주기에 재시도)
      }
    }, 60 * 1000); // 1분마다 체크

    return () => {
      clearInterval(refreshInterval);
      window.removeEventListener('click', updateActivity);
      window.removeEventListener('keydown', updateActivity);
      window.removeEventListener('mousemove', updateActivity);
      window.removeEventListener('scroll', updateActivity);
    };
  }, []);

  if (mode === 'bank') {
    return (
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/signup/complete" element={<SignupComplete />} />
          <Route path="/oauth/callback" element={<OAuthCallback />} />
          <Route path="/bank" element={<BankDashboard />} />
          <Route path="*" element={<Navigate to="/bank" />} />
        </Routes>
      </Router>
    );
  }

  if (mode === 'admin') {
    return (
      <Router>
        <Routes>
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="*" element={<Navigate to="/admin/login" />} />
        </Routes>
      </Router>
    );
  }

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/signup/complete" element={<SignupComplete />} />
        <Route path="/oauth/callback" element={<OAuthCallback />} />
        <Route path="/community" element={<Community />} />
        <Route path="/community/write" element={<CommunityWrite />} />
        <Route path="/community/:postId" element={<CommunityDetail />} />
        <Route path="/community/:postId/edit" element={<CommunityWrite />} />
        <Route path="/events" element={<Events />} />
        <Route path="/support" element={<Support />} />
        <Route path="/exchange" element={<Exchange />} />
        <Route path="/balances" element={<Balances />} />
        <Route path="/investments" element={<Investments />} />
        <Route path="/trends" element={<Trends />} />
        <Route path="/mypage" element={<MyPage />} />
        <Route path="/withdrawal-complete" element={<WithdrawalComplete />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/" element={<Navigate to="/crypto" />} />
        <Route path="/crypto" element={<Home />} />
        <Route path="*" element={<Navigate to="/crypto" />} />
      </Routes>
    </Router>
  );
}

export default App;
