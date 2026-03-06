import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { setUserSession } from '../utils/auth';

function sanitizeRedirectTarget(target: string | null | undefined): string {
  if (!target) return '/';
  const trimmed = target.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return '/';
  if (trimmed.startsWith('/login') || trimmed.startsWith('/oauth/callback')) return '/';
  return trimmed;
}

const OAuthCallback: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const accessToken = searchParams.get('accessToken');
    const refreshToken = searchParams.get('refreshToken');

    if (accessToken && refreshToken) {
      setUserSession(accessToken, refreshToken);
      const target = sanitizeRedirectTarget(localStorage.getItem('postLoginRedirect'));
      localStorage.removeItem('postLoginRedirect');
      window.location.href = target;
      return;
    }

    alert('로그인 정보가 올바르지 않습니다.');
    const redirect = sanitizeRedirectTarget(localStorage.getItem('postLoginRedirect'));
    navigate(`/login?redirect=${encodeURIComponent(redirect)}`);
  }, [searchParams, navigate]);

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <p>로그인 처리 중입니다. 잠시만 기다려주세요...</p>
    </div>
  );
};

export default OAuthCallback;
