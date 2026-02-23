import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import TierModal from '../../components/TierModal';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const API_BASE = 'http://localhost:8080';

interface Props {
  market: string;
  currentPrice: number;
  selectedPrice: number | null;
  tradeType: 'buy' | 'sell';
}

const Container = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 100%;
`;



const FormBody = styled.div`
  padding: 12px;
  flex: 1;
`;

const TierInfoBox = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
  background: #f8f9fa;
  padding: 8px 10px;
  margin-bottom: 10px;
  border-radius: 4px;
`;

const PolicyBtn = styled.button`
  background: none;
  border: none;
  color: #093687;
  font-weight: 600;
  cursor: pointer;
  padding: 0;
  text-decoration: underline;
`;

const VolumeText = styled.span`
  color: #333;
  font-weight: 600;
`;

const FormRow = styled.div`
  margin-bottom: 10px;
`;

const Label = styled.label`
  display: block;
  font-size: 11px;
  color: #666;
  margin-bottom: 4px;
`;

const Input = styled.input`
  width: 100%;
  padding: 8px 10px;
  border: 1px solid #dfe7f6;
  border-radius: 4px;
  font-size: 13px;
  outline: none;
  box-sizing: border-box;
  &:focus { border-color: #093687; }
`;

const BalanceInfo = styled.div`
  font-size: 11px;
  color: #999;
  margin-bottom: 8px;
  span { color: #333; font-weight: 600; }
`;

const PercentBtns = styled.div`
  display: flex;
  gap: 4px;
  margin-bottom: 10px;
`;

const PercentBtn = styled.button`
  flex: 1;
  padding: 4px;
  font-size: 10px;
  background: #f0f2f5;
  border: 1px solid #dfe7f6;
  border-radius: 4px;
  cursor: pointer;
  &:hover { background: #e8edf5; }
`;

const ButtonContainer = styled.div`
  display: flex;
  gap: 8px;
`;

const SubmitBtn = styled.button<{ $type: 'buy' | 'sell' }>`
  flex: 1;
  padding: 12px;
  font-size: 14px;
  font-weight: 700;
  color: #fff;
  background: ${p => p.$type === 'buy' ? '#d60000' : '#0051c7'};
  border: none;
  border-radius: 6px;
  cursor: pointer;
  &:hover { opacity: 0.9; }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const HistoryBtn = styled.button`
  padding: 12px;
  font-size: 13px;
  font-weight: 600;
  color: #333;
  background: #fff;
  border: 1px solid #dfe7f6;
  border-radius: 6px;
  cursor: pointer;
  width: 80px;
  &:hover { background: #f8f9fa; }
`;

const LoginMessage = styled.div`
  padding: 32px 12px;
  text-align: center;
  color: #999;
  font-size: 13px;
  a {
    color: #093687;
    text-decoration: none;
    font-weight: 600;
  }
`;

const ResultMessage = styled.div<{ $success: boolean }>`
  padding: 8px;
  margin-top: 8px;
  border-radius: 4px;
  font-size: 12px;
  text-align: center;
  background: ${p => p.$success ? '#e8f5e8' : '#fde8e8'};
  color: ${p => p.$success ? '#2e7d32' : '#c62828'};
`;

const DepositBtn = styled.button`
  width: 100%;
  padding: 8px;
  margin-top: 8px;
  font-size: 12px;
  font-weight: 600;
  color: #093687;
  background: #f0f4ff;
  border: 1px solid #093687;
  border-radius: 4px;
  cursor: pointer;
  &:hover { background: #e0e8ff; }
`;

function getToken(): string | null {
  return localStorage.getItem('accessToken');
}

function toUserMessage(raw: unknown): string {
  const code = String(raw ?? '');
  if (code.includes('LOCKED_ACCOUNT')) {
    return '계정의 접속을 차단하고 제한된 계정입니다. 관리자에게 문의하세요.';
  }
  if (code.includes('RESTRICTED_ACCOUNT')) {
    return '제한계정입니다. 관리자한테 문의하세요.';
  }
  return code || '요청 처리에 실패했습니다.';
}

function showRestrictionPopupIfNeeded(msg: string): void {
  if (msg.includes('제한계정') || msg.includes('접속을 차단')) {
    window.alert(msg);
  }
}

const TradeForm: React.FC<Props> = ({ market, currentPrice, selectedPrice, tradeType }) => {
  const navigate = useNavigate();
  // const [tab, setTab] = useState<'buy' | 'sell'>('buy'); // 제거됨
  const [price, setPrice] = useState('');
  const [amount, setAmount] = useState('');
  const [krwBalance, setKrwBalance] = useState(0);
  const [coinBalance, setCoinBalance] = useState(0);
  const [message, setMessage] = useState<{ text: string; success: boolean } | null>(null);
  const [loading, setLoading] = useState(false);

  const [totalVolume, setTotalVolume] = useState<number>(0);
  const [nextTierVolume, setNextTierVolume] = useState<number>(100000000);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const token = getToken();
  const isLoggedIn = !!token;
  const assetType = market.replace('KRW-', '');

  // ... (useEffect 및 핸들러들은 그대로 유지)


  useEffect(() => {
    if (currentPrice > 0) {
      setPrice(String(currentPrice));
    }
  }, [currentPrice, market]);

  useEffect(() => {
    if (selectedPrice && selectedPrice > 0) {
      setPrice(String(selectedPrice));
    }
  }, [selectedPrice]);

  useEffect(() => {
    if (!isLoggedIn) return;
    const headers = { Authorization: `Bearer ${token}` };

    axios.get(`${API_BASE}/api/assets/KRW`, { headers })
      .then(res => setKrwBalance(res.data.availableBalance ?? 0))
      .catch(() => { });

    if (assetType) {
      axios.get(`${API_BASE}/api/assets/${assetType}`, { headers })
        .then(res => setCoinBalance(res.data.availableBalance ?? 0))
        .catch(() => { });
    }

    axios.get(`${API_BASE}/api/auth/me`, { headers })
      .then(res => {
        const volume = Number(res.data.totalVolume) || 0;
        setTotalVolume(volume);
        if (volume < 100000000) {
          setNextTierVolume(100000000);
        } else if (volume < 2000000000) {
          setNextTierVolume(2000000000);
        } else if (volume < 20000000000) {
          setNextTierVolume(20000000000);
        } else {
          setNextTierVolume(volume); // VIP
        }
      })
      .catch(() => { });
  }, [isLoggedIn, token, assetType, message]);

  // 쉼표 제거하여 파싱
  const parseNumber = (str: string) => parseFloat(str.replace(/,/g, '')) || 0;
  const total = parseNumber(price) * parseNumber(amount);

  const handlePercent = (pct: number) => {
    const p = parseNumber(price);
    if (p <= 0) return;

    if (tradeType === 'buy') {
      // 등급별 수수료율 계산
      let feeRate = 0.0008; // BRONZE
      if (totalVolume >= 20000000000) feeRate = 0.0001; // VIP
      else if (totalVolume >= 2000000000) feeRate = 0.0003; // GOLD
      else if (totalVolume >= 100000000) feeRate = 0.0005; // SILVER

      // 매수 시: 필요한 총 KRW = (현재가 * 수량) + (현재가 * 수량 * 수수료율)
      // 즉, 잔액 배분: 잔액 = 수량 * 현재가 * (1 + 수수료율)
      // 최대 수량 = (할당할 잔액) / (현재가 * (1 + 수수료율))
      const allocatedBalance = krwBalance * (pct / 100);
      const maxAmount = allocatedBalance / (p * (1 + feeRate));

      setAmount(maxAmount.toFixed(8));
    } else {
      setAmount((coinBalance * pct / 100).toFixed(8));
    }
  };

  const handleDeposit = async () => {
    if (!token) return;
    try {
      await axios.post(`${API_BASE}/api/assets/deposit`,
        { assetType: 'KRW', amount: 10000000 },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMessage({ text: '테스트 1,000만원이 충전되었습니다!', success: true });
    } catch (err: any) {
      const raw = err.response?.data?.message || err.response?.data || '충전에 실패했습니다.';
      const userMessage = toUserMessage(raw);
      showRestrictionPopupIfNeeded(userMessage);
      setMessage({ text: userMessage, success: false });
    }
  };

  const handleSubmit = async () => {
    if (!token || loading) return;
    const p = parseNumber(price);
    const a = parseNumber(amount);
    if (!p || !a || p <= 0 || a <= 0) {
      setMessage({ text: '가격과 수량을 입력해 주세요.', success: false });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      await axios.post(`${API_BASE}/api/orders`, {
        orderType: tradeType === 'buy' ? 'BUY' : 'SELL',
        priceType: 'LIMIT',
        assetType,
        price: p,
        amount: a,
      }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMessage({
        text: `${tradeType === 'buy' ? '매수' : '매도'} 주문이 체결되었습니다.`,
        success: true,
      });
      setAmount('');
    } catch (err: any) {
      const raw = err.response?.data?.message || err.response?.data || '주문에 실패했습니다.';
      const userMessage = toUserMessage(raw);
      showRestrictionPopupIfNeeded(userMessage);
      setMessage({ text: userMessage, success: false });
    } finally {
      setLoading(false);
    }
  };

  if (!isLoggedIn) {
    return (
      <Container>
        <LoginMessage>
          <a href="/login">로그인</a> 후 이용해 주세요.
        </LoginMessage>
      </Container>
    );
  }

  return (
    <Container>
      <FormBody>
        <TierInfoBox>
          <PolicyBtn onClick={() => setIsModalOpen(true)}>수수료 정책 보기</PolicyBtn>
          <VolumeText>
            {totalVolume >= 20000000000 ? (
              `${totalVolume.toLocaleString()} / VIP 달성 (KRW)`
            ) : (
              `${totalVolume.toLocaleString()} / ${nextTierVolume.toLocaleString()} (KRW)`
            )}
          </VolumeText>
        </TierInfoBox>

        <TierModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          currentVolume={totalVolume}
        />

        <BalanceInfo>
          {tradeType === 'buy' ? (
            <>주문가능: <span>{Number(krwBalance).toLocaleString()} KRW</span></>
          ) : (
            <>주문가능: <span>{Number(coinBalance).toFixed(8)} {assetType}</span></>
          )}
        </BalanceInfo>

        {tradeType === 'buy' && krwBalance === 0 && (
          <DepositBtn onClick={handleDeposit}>테스트 1,000만원 충전</DepositBtn>
        )}

        <FormRow>
          <Label>가격 (KRW)</Label>
          <Input
            type="text"
            value={price ? parseNumber(price).toLocaleString('ko-KR') : ''}
            onChange={e => setPrice(e.target.value.replace(/,/g, ''))}
            placeholder="주문 가격"
          />
        </FormRow>

        <FormRow>
          <Label>수량 ({assetType})</Label>
          <Input
            type="text"
            value={amount}
            onChange={e => setAmount(e.target.value.replace(/,/g, ''))}
            placeholder="주문 수량"
          />
        </FormRow>

        <PercentBtns>
          {[10, 25, 50, 100].map(pct => (
            <PercentBtn key={pct} onClick={() => handlePercent(pct)}>{pct}%</PercentBtn>
          ))}
        </PercentBtns>

        <FormRow>
          <Label>총액 (KRW)</Label>
          <Input type="text" value={total > 0 ? total.toLocaleString() : ''} readOnly />
        </FormRow>

        <ButtonContainer>
          <SubmitBtn $type={tradeType} onClick={handleSubmit} disabled={loading}>
            {loading ? '처리 중...' : tradeType === 'buy' ? `${assetType} 매수` : `${assetType} 매도`}
          </SubmitBtn>
          <HistoryBtn onClick={() => navigate('/investments')}>내역</HistoryBtn>
        </ButtonContainer>

        {message && <ResultMessage $success={message.success}>{message.text}</ResultMessage>}
      </FormBody>
    </Container>
  );
};

export default TradeForm;
