import React, { useEffect } from 'react';
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
import ApiDocs from './pages/ApiDocs';

const mode = import.meta.env.VITE_APP_MODE || 'exchange'; // 'bank' or 'exchange'

// --- SSO Sync Logic ---
const syncAuthToken = () => {
  const getCookie = (name: string) => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) {
      const val = parts.pop()?.split(';').shift();
      return val === "null" || val === "undefined" || !val ? null : val;
    }
    return null;
  };

  const cookieToken = getCookie('vce_token');
  const localToken = localStorage.getItem('accessToken');

  // Case 1: Cookie has a valid token, Local has a different valid token or no token.
  if (cookieToken && cookieToken !== localToken) {
    localStorage.setItem('accessToken', cookieToken);
    localStorage.setItem('token', cookieToken);
    if (!localToken) {
      window.dispatchEvent(new Event('storage'));
    }
  }
  // Case 2: Local has a valid token, Cookie is missing or different.
  else if (localToken && localToken.length > 20 && localToken !== cookieToken) {
    document.cookie = `vce_token=${localToken}; path=/; max-age=86400`;
  }
  // Case 3: Both are missing or invalid, ensure cleanup.
  else if (!localToken && cookieToken) {
    document.cookie = 'vce_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  }
};
// ----------------------
syncAuthToken();

function App() {
  useEffect(() => {
    syncAuthToken();
    // Keep checking periodically to share state across open tabs (ports) instantly
    const interval = setInterval(syncAuthToken, 1000);
    return () => clearInterval(interval);
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
        <Route path="/api-docs" element={<ApiDocs />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="/" element={<Navigate to="/crypto" />} />
        <Route path="/crypto" element={<Home />} />
        <Route path="*" element={<Navigate to="/crypto" />} />
      </Routes>
    </Router>
  );
}

export default App;
