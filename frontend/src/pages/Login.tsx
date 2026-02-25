import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { Link, useSearchParams } from 'react-router-dom';
import axios from 'axios';

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

const TestLoginButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 50px;
  margin-bottom: 12px;
  border-radius: 6px;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.2s;
  border: 2px solid #093687;
  background: white;
  color: #093687;

  &:hover {
    background: #f0f4ff;
  }
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const TestInfo = styled.div`
  margin-top: 8px;
  font-size: 12px;
  color: #999;
  line-height: 1.5;
`;

const ErrorMsg = styled.div`
  margin-top: 8px;
  font-size: 13px;
  color: #d60000;
`;

const FooterLink = styled.div`
  margin-top: 20px;
  font-size: 14px;
  color: #666;

  a {
    color: #093687;
    text-decoration: none;
    font-weight: 600;
    margin-left: 5px;

    &:hover {
      text-decoration: underline;
    }
  }
`;

const Login: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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

  const handleTestLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await axios.post(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'}/api/auth/test/login`, {
        email: 'test@vce.com',
        password: 'test1234',
      });
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      window.location.href = '/';
    } catch (e: any) {
      const msg = toUserMessage(e.response?.data?.message || e.response?.data);
      setError(msg);
      if (msg.includes('제한') || msg.includes('탈퇴')) {
        window.alert(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container>
      <LoginBox>
        <LogoArea>VCE</LogoArea>
        <Title>로그인</Title>

        <SocialButton
          provider="kakao"
          href={`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'}/oauth2/authorization/kakao`}
        >
          카카오로 시작하기
        </SocialButton>
        <SocialButton
          provider="naver"
          href={`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'}/oauth2/authorization/naver`}
        >
          네이버로 시작하기
        </SocialButton>

        <Divider />

        <TestLoginButton onClick={handleTestLogin} disabled={loading}>
          {loading ? '로그인 중...' : '테스트 계정으로 로그인'}
        </TestLoginButton>
        <TestInfo>
          test@vce.com / test1234 (KRW 1,000만원)
        </TestInfo>
        {error && <ErrorMsg>{error}</ErrorMsg>}

        <FooterLink style={{ marginTop: '16px' }}>
          <Link to="/admin/login">관리자 로그인</Link>
        </FooterLink>
      </LoginBox>
    </Container>
  );
};

export default Login;
