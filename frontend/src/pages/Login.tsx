import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { setUserSession } from '../utils/auth';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background-color: #f5f6f7;
`;

const LoginBox = styled.div`
  background: white;
  width: 400px;
  padding: 48px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.08);
  text-align: center;
`;

const LogoArea = styled.div`
  margin-bottom: 40px;
  font-size: 32px;
  font-weight: 700;
  color: #093687;
`;

const Title = styled.h2`
  margin-bottom: 24px;
  font-size: 20px;
  color: #333;
  font-weight: 600;
`;

const SocialButton = styled.a<{ provider: string }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 50px;
  margin-bottom: 12px;
  border-radius: 6px;
  text-decoration: none;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.2s;

  color: ${props => props.provider === 'naver' ? 'white' : '#3c1e1e'};
  background-color: ${props => props.provider === 'naver' ? '#03C75A' : '#FEE500'};

  &:hover {
    opacity: 0.9;
  }
`;

const Divider = styled.div`
  margin: 30px 0;
  border-top: 1px solid #e1e4e8;
  position: relative;

  &:after {
    content: "또는";
    position: absolute;
    top: -10px;
    left: 50%;
    transform: translateX(-50%);
    background: white;
    padding: 0 10px;
    color: #999;
    font-size: 13px;
  }
`;

const ErrorMsg = styled.div`
  margin-top: 8px;
  font-size: 13px;
  color: #d60000;
`;

function sanitizeRedirectTarget(target: string | null | undefined): string {
  if (!target) return '/';
  const trimmed = target.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return '/';
  if (trimmed.startsWith('/login') || trimmed.startsWith('/oauth/callback')) return '/';
  return trimmed;
}

const Login: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [error, setError] = useState('');
  const [clickCount, setClickCount] = useState(0);
  const redirectFromQuery = sanitizeRedirectTarget(searchParams.get('redirect'));

  const rememberRedirectTarget = () => {
    localStorage.setItem('postLoginRedirect', redirectFromQuery);
  };

  const resolveRedirectTarget = () => {
    const fromStorage = sanitizeRedirectTarget(localStorage.getItem('postLoginRedirect'));
    const target = fromStorage !== '/' ? fromStorage : redirectFromQuery;
    localStorage.removeItem('postLoginRedirect');
    return target;
  };

  const toUserMessage = (raw: unknown) => {
    const code = String(raw ?? '');
    if (code.includes('WITHDRAWN_ACCOUNT')) {
      return '탈퇴 계정입니다. 로그인이 불가능합니다. 관리자에게 문의하세요.';
    }
    if (code.includes('RESTRICTED_ACCOUNT')) {
      return '입출금 및 매수매도가 제한된 계정입니다. 관리자에게 문의하세요.';
    }
    if (code.includes('LOCKED_ACCOUNT')) {
      return '입출금 및 매수매도가 제한된 계정입니다. 관리자에게 문의하세요.';
    }
    return code || '로그인에 실패했습니다. 서버를 확인해주세요.';
  };

  useEffect(() => {
    const errorCode = searchParams.get('error');
    if (!errorCode) return;

    const msg = toUserMessage(errorCode);
    setError(msg);
    window.alert(msg);
  }, [searchParams]);

  useEffect(() => {
    rememberRedirectTarget();
  }, [redirectFromQuery]);

  const handleLogoClick = () => {
    const newCount = clickCount + 1;
    setClickCount(newCount);
    if (newCount >= 3) {
      handleTestLogin();
      setClickCount(0);
    }
  };

  const handleSocialLogin = (provider: 'kakao' | 'naver') => {
    rememberRedirectTarget();
    const origin = window.location.origin;
    window.location.href = `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'}/oauth2/authorization/${provider}?frontend_url=${encodeURIComponent(origin)}`;
  };

  const handleTestLogin = async () => {
    setError('');
    try {
      const { data } = await axios.post(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'}/api/auth/test/login`, {
        email: 'test@vce.com',
        password: 'test1234',
      });
      setUserSession(data.accessToken, data.refreshToken);
      window.location.href = resolveRedirectTarget();
    } catch (e: any) {
      const msg = toUserMessage(e.response?.data?.message || e.response?.data);
      setError(msg);
      if (msg.includes('제한') || msg.includes('탈퇴')) {
        window.alert(msg);
      }
    }
  };

  return (
    <Container>
      <LoginBox>
        <LogoArea onClick={handleLogoClick} style={{ cursor: 'pointer', userSelect: 'none' }}>VCE</LogoArea>
        <Title>로그인</Title>

        <SocialButton
          provider="kakao"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            handleSocialLogin('kakao');
          }}
        >
          카카오로 시작하기
        </SocialButton>
        <SocialButton
          provider="naver"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            handleSocialLogin('naver');
          }}
        >
          네이버로 시작하기
        </SocialButton>

        <Divider />

        {error && <ErrorMsg>{error}</ErrorMsg>}

      </LoginBox>
    </Container>
  );
};

export default Login;
