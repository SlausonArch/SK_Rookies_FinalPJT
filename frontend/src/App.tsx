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
import { syncAuthState } from './utils/auth';

const mode = import.meta.env.VITE_APP_MODE || 'exchange'; // 'bank' or 'exchange'

syncAuthState();

function App() {
  useEffect(() => {
    syncAuthState();
    // Keep checking periodically to share state across open tabs (ports) instantly
    const interval = setInterval(syncAuthState, 1000);
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
