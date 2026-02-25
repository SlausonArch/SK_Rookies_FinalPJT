import React, { useState } from 'react';
import styled from 'styled-components';
import axios from 'axios';
import Header from '../components/Header';
import Footer from '../components/Footer';

const Container = styled.div`
  min-height: 100vh;
  background: #f5f6f7;
  display: flex;
  flex-direction: column;
`;

const Main = styled.main`
  flex: 1;
  max-width: 1200px;
  width: 100%;
  margin: 40px auto;
  padding: 0 20px;
`;

const PageHeader = styled.div`
  margin-bottom: 40px;
  text-align: center;
`;

const Title = styled.h1`
  font-size: 32px;
  color: #1a2e57;
  margin-bottom: 12px;
  font-weight: 800;
  letter-spacing: -0.5px;
`;

const Subtitle = styled.p`
  font-size: 16px;
  color: #666;
`;

const HeroEventCard = styled.div`
  background: linear-gradient(135deg, #093687 0%, #1e40af 100%);
  border-radius: 20px;
  padding: 48px;
  color: white;
  margin-bottom: 50px;
  position: relative;
  overflow: hidden;
  box-shadow: 0 20px 40px rgba(9, 54, 135, 0.2);
  display: flex;
  align-items: center;
  justify-content: space-between;
  
  &::before {
    content: '';
    position: absolute;
    top: -50%;
    right: -10%;
    width: 500px;
    height: 500px;
    background: radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%);
    border-radius: 50%;
    pointer-events: none;
  }
`;

const HeroContent = styled.div`
  position: relative;
  z-index: 1;
  max-width: 600px;
`;

const HeroBadge = styled.span`
  background: rgba(255,255,255,0.2);
  color: #fff;
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 700;
  display: inline-block;
  margin-bottom: 16px;
  border: 1px solid rgba(255,255,255,0.4);
`;

const HeroTitle = styled.h2`
  font-size: 36px;
  font-weight: 800;
  margin: 0 0 16px 0;
  line-height: 1.3;
  text-shadow: 0 2px 4px rgba(0,0,0,0.2);
`;

const HeroDesc = styled.p`
  font-size: 18px;
  color: rgba(255,255,255,0.9);
  margin: 0 0 32px 0;
  line-height: 1.6;
`;

const HeroButton = styled.button`
  background: #ffd700;
  color: #b45309;
  border: none;
  padding: 14px 32px;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 800;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);

  &:hover {
    background: #fde047;
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(0,0,0,0.15);
  }
`;

const HeroImageArea = styled.div`
  flex-shrink: 0;
  width: 280px;
  height: 280px;
  background: rgba(255,255,255,0.1);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 100px;
  position: relative;
  z-index: 1;
  border: 4px solid rgba(255,255,255,0.2);
  box-shadow: inset 0 0 40px rgba(0,0,0,0.1);
  animation: float 6s ease-in-out infinite;

  @keyframes float {
    0% { transform: translateY(0px); }
    50% { transform: translateY(-15px); }
    100% { transform: translateY(0px); }
  }

  @media (max-width: 768px) {
    display: none;
  }
`;

const SectionTitle = styled.h3`
  font-size: 24px;
  color: #1a2e57;
  margin: 0 0 24px 0;
  font-weight: 700;
`;

const EventsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
  
  @media (max-width: 992px) {
    grid-template-columns: repeat(2, 1fr);
  }
  @media (max-width: 600px) {
    grid-template-columns: 1fr;
  }
`;

const EventCard = styled.div`
  background: white;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0,0,0,0.05);
  transition: all 0.3s ease;
  cursor: pointer;
  border: 1px solid #eaeaea;
  display: flex;
  flex-direction: column;

  &:hover {
    transform: translateY(-6px);
    box-shadow: 0 12px 24px rgba(0,0,0,0.1);
    border-color: #cbd5e1;
  }
`;

const EventImagePlaceholder = styled.div<{ $bg: string }>`
  height: 180px;
  background: ${p => p.$bg};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 48px;
`;

const EventCardBody = styled.div`
  padding: 24px;
  flex: 1;
  display: flex;
  flex-direction: column;
`;

const StatusBadge = styled.span<{ $status: string }>`
  display: inline-block;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 700;
  margin-bottom: 12px;
  background: ${p => p.$status === 'ongoing' ? '#dcfce7' : p.$status === 'closing' ? '#fee2e2' : '#f1f5f9'};
  color: ${p => p.$status === 'ongoing' ? '#16a34a' : p.$status === 'closing' ? '#dc2626' : '#64748b'};
  width: fit-content;
`;

const EventCardTitle = styled.h4`
  font-size: 18px;
  color: #333;
  margin: 0 0 12px 0;
  font-weight: 700;
  line-height: 1.4;
`;

const EventCardPeriod = styled.p`
  font-size: 13px;
  color: #888;
  margin: 0;
  margin-top: auto;
  font-weight: 500;
`;

const ModalOverlay = styled.div`
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.6);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
`;

const ModalContainer = styled.div`
  background: white;
  border-radius: 12px;
  width: 400px;
  max-width: 90%;
  padding: 32px;
  text-align: center;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
`;

const ModalTitle = styled.h2`
  font-size: 20px;
  color: #333;
  margin-top: 0;
  margin-bottom: 8px;
`;

const ModalSubtitle = styled.p`
  font-size: 14px;
  color: #666;
  margin-bottom: 24px;
`;

const ModalCodeBox = styled.div`
  font-size: 28px;
  color: #093687;
  font-weight: 800;
  letter-spacing: 2px;
  margin-bottom: 24px;
  background: #f8f9fa;
  padding: 24px;
  border-radius: 8px;
  border: 2px dashed #093687;
  word-break: break-all;
`;

const ModalButton = styled.button`
  padding: 12px 24px;
  background: #093687;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
  width: 100%;
  font-size: 16px;
  &:hover { background: #0a4099; }
`;

const dummyEvents = [
  {
    id: 1,
    title: "VCE 신규 가입 웰컴팩! (최대 5만원 상당)",
    period: "2026.01.01 ~ 2026.12.31",
    status: "ongoing",
    bg: "linear-gradient(135deg, #fdfbfb 0%, #ebedee 100%)",
    icon: "🎉"
  },
  {
    id: 2,
    title: "100만 거래액 달성 시 한정판 프로필 NFT 증정",
    period: "2026.02.15 ~ 2026.03.31",
    status: "ongoing",
    bg: "linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)",
    icon: "🏆"
  },
  {
    id: 3,
    title: "보안 계정 2단계 인증 캠페인 리워드",
    period: "2026.02.20 ~ 2026.02.28",
    status: "closing",
    bg: "linear-gradient(135deg, #f6d365 0%, #fda085 100%)",
    icon: "🔒"
  },
  {
    id: 4,
    title: "VIP 랭크 승급! 첫 달 거래 수수료 페이백",
    period: "2026.03.01 ~ 상시",
    status: "ongoing",
    bg: "linear-gradient(135deg, #cfd9df 0%, #e2ebf0 100%)",
    icon: "✨"
  },
  {
    id: 5,
    title: "가입 1주년 감사제, 럭키 드로우 (아이패드 추첨)",
    period: "2026.05.01 ~ 2026.05.31",
    status: "upcoming",
    bg: "linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)",
    icon: "🎁"
  },
  {
    id: 6,
    title: "지정 코인 릴레이 에어드랍 3탄 (진행 완료)",
    period: "2026.01.10 ~ 2026.01.20",
    status: "ended",
    bg: "radial-gradient(circle, #e6e9f0 0%, #eef1f5 100%)",
    icon: "🪙"
  }
];

const Events: React.FC = () => {
  const [showModal, setShowModal] = useState(false);
  const [referralCode, setReferralCode] = useState<string | null>(null);

  const handleCheckReferral = async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      alert('로그인이 필요한 서비스입니다.');
      window.location.href = '/login';
      return;
    }

    try {
      const res = await axios.get(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data && res.data.referralCode) {
        setReferralCode(res.data.referralCode);
      } else {
        setReferralCode('발급된 코드가 없습니다.');
      }
      setShowModal(true);
    } catch (error) {
      console.error('추천인 코드 조회 실패:', error);
      alert('정보를 불러오는데 실패했습니다.');
    }
  };

  return (
    <Container>
      <Header />
      <Main>
        <PageHeader>
          <Title>이벤트</Title>
          <Subtitle>VCE 거래소에서 준비한 특별한 혜택들을 놓치지 마세요!</Subtitle>
        </PageHeader>

        {/* 메인 추천인 배너 */}
        <HeroEventCard>
          <HeroContent>
            <HeroBadge>🔥 메가 히트 이벤트</HeroBadge>
            <HeroTitle>친구 초대하고<br /><span style={{ color: '#ffd700' }}>7만원 무제한 즉시 지급!</span></HeroTitle>
            <HeroDesc>
              가입 시 내 추천인 코드를 입력하면,<br />
              초대한 친구와 나 모두에게 70,000 KRW 현금 및 수수료 쿠폰을 100% 드립니다.
            </HeroDesc>
            <HeroButton onClick={handleCheckReferral}>
              내 추천인 코드 확인하기
            </HeroButton>
          </HeroContent>
          <HeroImageArea>
            🤝
          </HeroImageArea>
        </HeroEventCard>

        {/* 진행중인 다른 이벤트 리스트 */}
        <SectionTitle>진행 중인 다른 이벤트</SectionTitle>
        <EventsGrid>
          {dummyEvents.map(evt => (
            <EventCard key={evt.id}>
              <EventImagePlaceholder $bg={evt.bg}>
                {evt.icon}
              </EventImagePlaceholder>
              <EventCardBody>
                <StatusBadge $status={evt.status}>
                  {evt.status === 'ongoing' ? '진행중' :
                    evt.status === 'closing' ? '종료임박' :
                      evt.status === 'upcoming' ? '오픈예정' : '종료'}
                </StatusBadge>
                <EventCardTitle>{evt.title}</EventCardTitle>
                <EventCardPeriod>기간: {evt.period}</EventCardPeriod>
              </EventCardBody>
            </EventCard>
          ))}
        </EventsGrid>

      </Main>
      <Footer />

      {showModal && (
        <ModalOverlay onClick={() => setShowModal(false)}>
          <ModalContainer onClick={e => e.stopPropagation()}>
            <ModalTitle>내 추천인 코드</ModalTitle>
            <ModalSubtitle>친구에게 이 코드를 공유하고 혜택을 받아보세요!</ModalSubtitle>
            <ModalCodeBox>{referralCode}</ModalCodeBox>
            <ModalButton onClick={() => setShowModal(false)}>확인</ModalButton>
          </ModalContainer>
        </ModalOverlay>
      )}
    </Container>
  );
};

export default Events;
