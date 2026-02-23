import React from 'react';
import styled from 'styled-components';

interface TierModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentVolume: number;
}

const Overlay = styled.div`
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
`;

const ModalContainer = styled.div`
  background: #fff;
  border-radius: 12px;
  width: 100%;
  max-width: 480px;
  overflow: hidden;
  box-shadow: 0 10px 30px rgba(0,0,0,0.15);
`;

const Header = styled.div`
  padding: 20px 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #eee;

  h2 {
    margin: 0;
    font-size: 18px;
    color: #1a2e57;
  }
`;

const CloseBtn = styled.button`
  background: none;
  border: none;
  font-size: 24px;
  line-height: 1;
  color: #999;
  cursor: pointer;
  padding: 0;
  margin: 0;
  &:hover { color: #333; }
`;

const Content = styled.div`
  padding: 24px;
`;

const TierTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 24px;

  th, td {
    border: 1px solid #dfe7f6;
    padding: 12px;
    text-align: center;
    font-size: 13px;
  }

  th {
    background: #f8f9fa;
    color: #666;
    font-weight: 600;
  }

  td {
    color: #333;
  }

  .active {
    background: #eef2fa;
    font-weight: 700;
    color: #093687;
  }
`;

const ProgressBarContainer = styled.div`
  background: #f0f4ff;
  border-radius: 8px;
  padding: 16px;
`;

const ProgressTitle = styled.div`
  font-size: 13px;
  font-weight: 600;
  color: #093687;
  margin-bottom: 8px;
  display: flex;
  justify-content: space-between;
`;

const Track = styled.div`
  width: 100%;
  height: 8px;
  background: #dfe7f6;
  border-radius: 4px;
  overflow: hidden;
`;

const Fill = styled.div<{ $percent: number }>`
  width: ${p => Math.min(Math.max(p.$percent, 0), 100)}%;
  height: 100%;
  background: #093687;
  border-radius: 4px;
  transition: width 0.3s ease;
`;

const TierModal: React.FC<TierModalProps> = ({ isOpen, onClose, currentVolume }) => {
  if (!isOpen) return null;

  // 등급 계산 로직
  let tier = 'BRONZE';
  let nextThreshold = 100000000;

  if (currentVolume >= 20000000000) {
    tier = 'VIP';
    nextThreshold = -1; // MAX
  } else if (currentVolume >= 2000000000) {
    tier = 'GOLD';
    nextThreshold = 20000000000;
  } else if (currentVolume >= 100000000) {
    tier = 'SILVER';
    nextThreshold = 2000000000;
  }

  const progressPercent = nextThreshold > 0
    ? (currentVolume / nextThreshold) * 100
    : 100;

  return (
    <Overlay onClick={onClose}>
      <ModalContainer onClick={e => e.stopPropagation()}>
        <Header>
          <h2>수수료 등급 정책</h2>
          <CloseBtn onClick={onClose}>&times;</CloseBtn>
        </Header>
        <Content>
          <TierTable>
            <thead>
              <tr>
                <th>등급</th>
                <th>누적 거래금액 조건</th>
                <th>매수/매도 수수료</th>
              </tr>
            </thead>
            <tbody>
              <tr className={tier === 'BRONZE' ? 'active' : ''}>
                <td>BRONZE</td>
                <td>1억 원 미만</td>
                <td>0.08%</td>
              </tr>
              <tr className={tier === 'SILVER' ? 'active' : ''}>
                <td>SILVER</td>
                <td>1억 이상 ~ 20억 미만</td>
                <td>0.05%</td>
              </tr>
              <tr className={tier === 'GOLD' ? 'active' : ''}>
                <td>GOLD</td>
                <td>20억 이상 ~ 200억 미만</td>
                <td>0.03%</td>
              </tr>
              <tr className={tier === 'VIP' ? 'active' : ''}>
                <td>VIP</td>
                <td>200억 원 이상</td>
                <td>0.01%</td>
              </tr>
            </tbody>
          </TierTable>

          <ProgressBarContainer>
            <ProgressTitle>
              <span>현재 등급: {tier}</span>
              <span>
                {nextThreshold > 0
                  ? `다음 등급까지 ${(nextThreshold - currentVolume).toLocaleString()} KRW`
                  : '최고 등급 달성!'}
              </span>
            </ProgressTitle>
            <Track>
              <Fill $percent={progressPercent} />
            </Track>
          </ProgressBarContainer>
        </Content>
      </ModalContainer>
    </Overlay>
  );
};

export default TierModal;
