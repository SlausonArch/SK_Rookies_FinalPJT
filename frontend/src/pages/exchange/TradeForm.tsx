import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import axios from 'axios';

const API_BASE = 'http://localhost:8080';

interface Props {
  market: string;
  currentPrice: number;
  selectedPrice: number | null;
}

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
`;

const Tabs = styled.div`
  display: flex;
`;

const Tab = styled.button<{ $active: boolean; $type: 'buy' | 'sell' }>`
  flex: 1;
  padding: 10px;
  font-size: 13px;
  font-weight: 700;
  border: none;
  cursor: pointer;
  color: ${p => p.$active ? '#fff' : '#666'};
  background: ${p => {
    if (!p.$active) return '#f5f6f7';
    return p.$type === 'buy' ? '#d60000' : '#0051c7';
  }};
`;

const FormBody = styled.div`
  padding: 12px;
  flex: 1;
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

const SubmitBtn = styled.button<{ $type: 'buy' | 'sell' }>`
  width: 100%;
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

const TradeForm: React.FC<Props> = ({ market, currentPrice, selectedPrice }) => {
  const [tab, setTab] = useState<'buy' | 'sell'>('buy');
  const [price, setPrice] = useState('');
  const [amount, setAmount] = useState('');
  const [krwBalance, setKrwBalance] = useState(0);
  const [coinBalance, setCoinBalance] = useState(0);
  const [message, setMessage] = useState<{ text: string; success: boolean } | null>(null);
  const [loading, setLoading] = useState(false);

  const token = getToken();
  const isLoggedIn = !!token;
  const assetType = market.replace('KRW-', '');

  useEffect(() => {
    if (selectedPrice && selectedPrice > 0) {
      setPrice(String(selectedPrice));
    }
  }, [selectedPrice]);

  useEffect(() => {
    if (currentPrice > 0 && !price) {
      setPrice(String(currentPrice));
    }
  }, [currentPrice]);

  useEffect(() => {
    if (!isLoggedIn) return;
    const headers = { Authorization: `Bearer ${token}` };

    axios.get(`${API_BASE}/api/assets/KRW`, { headers })
      .then(res => setKrwBalance(res.data.availableBalance ?? 0))
      .catch(() => {});

    if (assetType) {
      axios.get(`${API_BASE}/api/assets/${assetType}`, { headers })
        .then(res => setCoinBalance(res.data.availableBalance ?? 0))
        .catch(() => {});
    }
  }, [isLoggedIn, token, assetType, message]);

  const total = (parseFloat(price) || 0) * (parseFloat(amount) || 0);

  const handlePercent = (pct: number) => {
    const p = parseFloat(price) || 0;
    if (p <= 0) return;

    if (tab === 'buy') {
      const maxAmount = krwBalance / p;
      setAmount((maxAmount * pct / 100).toFixed(8));
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
    } catch {
      setMessage({ text: '충전에 실패했습니다.', success: false });
    }
  };

  const handleSubmit = async () => {
    if (!token || loading) return;
    const p = parseFloat(price);
    const a = parseFloat(amount);
    if (!p || !a || p <= 0 || a <= 0) {
      setMessage({ text: '가격과 수량을 입력해 주세요.', success: false });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      await axios.post(`${API_BASE}/api/orders`, {
        orderType: tab === 'buy' ? 'BUY' : 'SELL',
        priceType: 'LIMIT',
        assetType,
        price: p,
        amount: a,
      }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMessage({
        text: `${tab === 'buy' ? '매수' : '매도'} 주문이 체결되었습니다.`,
        success: true,
      });
      setAmount('');
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data || '주문에 실패했습니다.';
      setMessage({ text: String(msg), success: false });
    } finally {
      setLoading(false);
    }
  };

  if (!isLoggedIn) {
    return (
      <Container>
        <Tabs>
          <Tab $active={true} $type="buy">매수</Tab>
          <Tab $active={false} $type="sell">매도</Tab>
        </Tabs>
        <LoginMessage>
          <a href="/login">로그인</a> 후 이용해 주세요.
        </LoginMessage>
      </Container>
    );
  }

  return (
    <Container>
      <Tabs>
        <Tab $active={tab === 'buy'} $type="buy" onClick={() => { setTab('buy'); setMessage(null); }}>매수</Tab>
        <Tab $active={tab === 'sell'} $type="sell" onClick={() => { setTab('sell'); setMessage(null); }}>매도</Tab>
      </Tabs>
      <FormBody>
        <BalanceInfo>
          {tab === 'buy' ? (
            <>주문가능: <span>{Number(krwBalance).toLocaleString()} KRW</span></>
          ) : (
            <>주문가능: <span>{Number(coinBalance).toFixed(8)} {assetType}</span></>
          )}
        </BalanceInfo>

        {tab === 'buy' && krwBalance === 0 && (
          <DepositBtn onClick={handleDeposit}>테스트 1,000만원 충전</DepositBtn>
        )}

        <FormRow>
          <Label>가격 (KRW)</Label>
          <Input
            type="number"
            value={price}
            onChange={e => setPrice(e.target.value)}
            placeholder="주문 가격"
          />
        </FormRow>

        <FormRow>
          <Label>수량 ({assetType})</Label>
          <Input
            type="number"
            value={amount}
            onChange={e => setAmount(e.target.value)}
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

        <SubmitBtn $type={tab} onClick={handleSubmit} disabled={loading}>
          {loading ? '처리 중...' : tab === 'buy' ? `${assetType} 매수` : `${assetType} 매도`}
        </SubmitBtn>

        {message && <ResultMessage $success={message.success}>{message.text}</ResultMessage>}
      </FormBody>
    </Container>
  );
};

export default TradeForm;
