import React from 'react';
import styled from 'styled-components';
import { Link } from 'react-router-dom';

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
  color: #093687; /* Upbit Blue-ish */
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
  return (
    <Container>
      <LoginBox>
        <LogoArea>VCE</LogoArea>
        <Title>로그인</Title>

        <SocialButton
          provider="kakao"
          href="http://localhost:8080/oauth2/authorization/kakao"
        >
          카카오로 시작하기
        </SocialButton>
        <SocialButton
          provider="naver"
          href="http://localhost:8080/oauth2/authorization/naver"
        >
          네이버로 시작하기
        </SocialButton>

        <Divider />

        <FooterLink>
          계정이 없으신가요?
          <Link to="/signup">회원가입</Link>
        </FooterLink>
        <FooterLink style={{ marginTop: '10px' }}>
          <Link to="/admin/login">관리자 로그인</Link>
        </FooterLink>
      </LoginBox>
    </Container>
  );
};

export default Login;
