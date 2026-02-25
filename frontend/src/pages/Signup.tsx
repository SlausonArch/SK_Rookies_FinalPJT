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
  margin-bottom: 10px;
  font-size: 20px;
  color: #333;
  font-weight: 600;
`;

const SubText = styled.p`
  margin-bottom: 30px;
  font-size: 14px;
  color: #888;
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
    content: "이미 계정이 있으신가요?";
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

const Signup: React.FC = () => {
  return (
    <Container>
      <LoginBox>
        <LogoArea>VCE</LogoArea>
        <Title>회원가입</Title>
        <SubText>VCE 거래소를 이용하기 위해 가입해주세요.</SubText>

        <SocialButton
          provider="kakao"
          href={`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'}/oauth2/authorization/kakao`}
        >
          카카오로 3초만에 가입하기
        </SocialButton>
        <SocialButton
          provider="naver"
          href={`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'}/oauth2/authorization/naver`}
        >
          네이버로 가입하기
        </SocialButton>

        <Divider />

        <FooterLink>
          <Link to="/login">로그인 화면으로 돌아가기</Link>
        </FooterLink>
      </LoginBox>
    </Container>
  );
};

export default Signup;
