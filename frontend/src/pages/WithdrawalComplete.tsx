import React from 'react';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';

const Container = styled.div`
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f5f6f7;
`;

const Content = styled.main`
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
`;

const Box = styled.div`
  background: white;
  width: 480px;
  max-width: 90%;
  padding: 48px 32px;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  text-align: center;
`;

const Title = styled.h1`
  font-size: 24px;
  color: #1a2e57;
  margin-bottom: 16px;
  font-weight: 700;
`;

const Desc = styled.p`
  font-size: 15px;
  color: #666;
  line-height: 1.6;
  margin-bottom: 40px;
  
  strong {
    color: #333;
    display: block;
    margin-bottom: 8px;
  }
`;

const ReturnButton = styled.button`
  width: 100%;
  padding: 16px;
  background: #093687;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: #0a4099;
  }
`;

const WithdrawalComplete: React.FC = () => {
    const navigate = useNavigate();

    return (
        <Container>
            <Header />
            <Content>
                <Box>
                    <Title>회원 탈퇴 완료</Title>
                    <Desc>
                        <strong>그동안 서비스를 이용해 주셔서 감사합니다.</strong>
                        회원님의 탈퇴 처리가 정상적으로 완료되었습니다.<br />
                        개인정보 및 거래 내역은 안전하게 익명화 처리되거나 파기되었습니다.
                    </Desc>
                    <ReturnButton onClick={() => navigate('/')}>
                        메인 화면으로 돌아가기
                    </ReturnButton>
                </Box>
            </Content>
            <Footer />
        </Container>
    );
};

export default WithdrawalComplete;
