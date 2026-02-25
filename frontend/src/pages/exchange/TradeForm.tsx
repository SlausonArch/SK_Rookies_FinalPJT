import React, { useState, useEffect } from 'react';
import styled, { keyframes } from 'styled-components';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, AlertCircle, TrendingUp, TrendingDown, Clock, Info } from 'lucide-react';

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
  height: 100%;
`;



const FormBody = styled.div`
  padding: 12px;
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-evenly;
  min-height: 0;
`;


const FormRow = styled.div`
  margin-bottom: 6px;
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
  margin-bottom: 6px;
  span { color: #333; font-weight: 600; }
`;

const PercentBtns = styled.div`
  display: flex;
  gap: 4px;
  margin-bottom: 6px;
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
  background: ${(p: { $type: 'buy' | 'sell' }) => p.$type === 'buy' ? '#d60000' : '#0051c7'};
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
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  a {
    color: #093687;
    text-decoration: none;
    font-weight: 600;
  }
`;

const slideIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

const ToastContainer = styled.div`
  position: fixed;
  bottom: 24px;
  right: 24px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  z-index: 1000;
`;

const Toast = styled.div<{ $success: boolean }>`
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
  background: white;
  color: ${(p: { $success: boolean }) => p.$success ? '#2e7d32' : '#c62828'};
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  border-left: 4px solid ${(p: { $success: boolean }) => p.$success ? '#2e7d32' : '#c62828'};
  animation: ${slideIn} 0.3s ease-out forwards;
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
  if (code.includes('WITHDRAWN_ACCOUNT')) {
    return '탈퇴 계정입니다. 로그인이 불가능합니다. 관리자에게 문의하세요.';
  }
  if (code.includes('RESTRICTED_ACCOUNT')) {
    return '입출금 및 매수매도가 제한된 계정입니다. 관리자에게 문의하세요.';
  }
  if (code.includes('LOCKED_ACCOUNT')) {
    return '입출금 및 매수매도가 제한된 계정입니다. 관리자에게 문의하세요.';
  }
  return code || '요청 처리에 실패했습니다.';
}

function showRestrictionPopupIfNeeded(msg: string): void {
  if (msg.includes('제한') || msg.includes('탈퇴')) {
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

  const token = getToken();
  const isLoggedIn = !!token;
  const assetType = market.replace('KRW-', '');

  // ... (useEffect 및 핸들러들은 그대로 유지)


  useEffect(() => {
    // When market changes, clear the price so it will auto-update to the new market's price
    setPrice('');
    setAmount('');
  }, [market]);

  useEffect(() => {
    // Only update price automatically if it hasn't been set manually
    // Allow users to keep their static limit price unless they change market
    if (currentPrice > 0 && !price) {
      setPrice(String(currentPrice));
    }
  }, [currentPrice, price]);

  useEffect(() => {
    if (selectedPrice && selectedPrice > 0) {
      setPrice(String(selectedPrice));
    }
  }, [selectedPrice]);

  useEffect(() => {
    if (!isLoggedIn) return;
    const headers = { Authorization: `Bearer ${token}` };

    axios.get(`${API_BASE}/api/assets/KRW`, { headers })
      .then((res: any) => setKrwBalance(res.data.availableBalance ?? 0))
      .catch(() => { });

    if (assetType) {
      axios.get(`${API_BASE}/api/assets/${assetType}`, { headers })
        .then((res: any) => setCoinBalance(res.data.availableBalance ?? 0))
        .catch(() => { });
    }

    axios.get(`${API_BASE}/api/auth/me`, { headers })
      .catch(() => { });
  }, [isLoggedIn, token, assetType, message]);

  // 쉼표 제거하여 파싱
  const parseNumber = (str: string) => parseFloat(str.replace(/,/g, '')) || 0;
  const total = parseNumber(price) * parseNumber(amount);

  const handlePercent = (pct: number) => {
    // 시장가 매수는 버튼 누르는 순간의 현재가가 반영되어야 하므로, 퍼센트 버튼 클릭 시 입력창의 price가 아닌
    // 현재 currentPrice 혹은 입력된 price 중 의도에 맞게 적용: 일반적으로 시장가 매수 기능을 위해서는
    // 수량 계산 기준가격을 현재가로 하거나, 입력된 지정가로 합니다.
    const p = parseNumber(price) || currentPrice;
    if (p <= 0) return;

    if (tradeType === 'buy') {
      // 매수 시: 필요한 총 KRW = (현재가 * 수량) + (현재가 * 수량 * 수수료율)
      const feeRate = 0.0005; // 임시 기본 수수료
      const allocatedBalance = krwBalance * (pct / 100);
      const maxAmount = allocatedBalance / (p * (1 + feeRate));

      setAmount(maxAmount.toFixed(5));
    } else {
      setAmount((coinBalance * pct / 100).toFixed(5));
    }
  };

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        setMessage(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

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

  const handleSubmit = async (isMarket: boolean) => {
    if (!token || loading) return;

    // 시장가 주문 시에는 무조건 currentPrice 사용, 지정가는 입력된 price 사용
    const p = isMarket ? currentPrice : parseNumber(price);

    // 수량 계산
    let a = parseNumber(amount);

    if (!p || p <= 0) {
      setMessage({ text: '가격 정보가 올바르지 않습니다.', success: false });
      return;
    }

    if (!a || a <= 0) {
      setMessage({ text: '수량을 입력해 주세요.', success: false });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      await axios.post(`${API_BASE}/api/orders`, {
        orderType: tradeType === 'buy' ? 'BUY' : 'SELL',
        priceType: isMarket ? 'MARKET' : 'LIMIT',
        assetType,
        price: p,
        amount: a,
      }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMessage({
        text: isMarket
          ? `시장가 ${tradeType === 'buy' ? '매수' : '매도'} 주문이 체결되었습니다.`
          : `지정가 ${tradeType === 'buy' ? '매수' : '매도'} 주문이 접수되었습니다. (체결 대기)`,
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
          <Info size={32} color="#999" />
          <span><a href="/login">로그인</a> 후 지정가 주문 및 거래를 이용해 주세요.</span>
        </LoginMessage>
      </Container>
    );
  }

  return (
    <Container>
      <FormBody>
        <BalanceInfo>
          {tradeType === 'buy' ? (
            <>주문가능: <span>≈ {Math.round(krwBalance).toLocaleString()} KRW</span></>
          ) : (
            <>주문가능: <span>{Number(coinBalance).toFixed(5)} {assetType}</span></>
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
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPrice(e.target.value.replace(/,/g, ''))}
            placeholder="주문 가격"
          />
        </FormRow>

        <FormRow>
          <Label>수량 ({assetType})</Label>
          <Input
            type="text"
            value={amount}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAmount(e.target.value.replace(/,/g, ''))}
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
          <Input type="text" value={total > 0 ? `≈ ${Math.round(total).toLocaleString()}` : ''} readOnly />
        </FormRow>

        <ButtonContainer style={{ flexDirection: 'column' }}>
          <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
            <SubmitBtn $type={tradeType} onClick={() => handleSubmit(false)} disabled={loading} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', flex: 1, padding: '10px' }}>
              {tradeType === 'buy' ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
              지정가 {tradeType === 'buy' ? '매수' : '매도'}
            </SubmitBtn>
            <SubmitBtn $type={tradeType} onClick={() => handleSubmit(true)} disabled={loading} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', flex: 1, padding: '10px', background: tradeType === 'buy' ? '#ff8a80' : '#90caf9', color: tradeType === 'buy' ? '#d60000' : '#0051c7' }}>
              시장가 {tradeType === 'buy' ? '매수' : '매도'}
            </SubmitBtn>
          </div>
          <HistoryBtn onClick={() => navigate('/investments')} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', padding: '10px' }}>
            <Clock size={16} /> 거래 내역 조회
          </HistoryBtn>
        </ButtonContainer>
      </FormBody>

      {message && (
        <ToastContainer>
          <Toast $success={message.success}>
            {message.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{message.text}</span>
          </Toast>
        </ToastContainer>
      )}
    </Container>
  );
};

export default TradeForm;
