import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
const exchangeUrl = import.meta.env.VITE_EXCHANGE_FRONTEND_URL || `${window.location.protocol}//${window.location.hostname}:15173`;

const PageContainer = styled.div`
  min-height: 100vh;
  background-color: #f4f7fb;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 60px;
`;

const HeaderNav = styled.nav`
  position: absolute;
  top: 0;
  width: 100%;
  padding: 20px 40px;
  display: flex;
  justify-content: flex-end; /* Align the single button to the right */
  background: white;
  box-shadow: 0 2px 10px rgba(0,0,0,0.05);
`;

const NavLink = styled.button`
  background: none;
  border: none;
  color: #1a5bc4;
  font-weight: 700;
  font-size: 16px;
  cursor: pointer;
  
  &:hover {
    text-decoration: underline;
  }
`;

const NavExternalLink = styled.a`
  background: none;
  border: none;
  color: #1a5bc4;
  font-weight: 700;
  font-size: 16px;
  cursor: pointer;
  text-decoration: none;
  
  &:hover {
    text-decoration: underline;
  }
`;

const DashboardCard = styled.div`
  background: white;
  border-radius: 20px;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.08);
  width: 100%;
  max-width: 500px;
  padding: 40px;
  text-align: center;
`;

const BankLogo = styled.div`
  font-size: 28px;
  font-weight: 900;
  color: #1a5bc4;
  margin-bottom: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
`;

const BalanceBox = styled.div`
  background: #f8f9fa;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 30px;
`;

const BalanceLabel = styled.div`
  font-size: 14px;
  color: #6c757d;
  margin-bottom: 8px;
`;

const BalanceAmount = styled.div`
  font-size: 32px;
  font-weight: 800;
  color: #212529;
`;

const ActionGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 24px;
`;

const ActionCard = styled.div<{ $isDeposit?: boolean }>`
  border: 1px solid #e9ecef;
  border-radius: 12px;
  padding: 20px;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    border-color: ${p => p.$isDeposit ? '#20c997' : '#ff6b6b'};
    background: ${p => p.$isDeposit ? '#f8fffb' : '#fff5f5'};
    transform: translateY(-2px);
  }
  
  h3 {
    margin: 0 0 8px;
    font-size: 16px;
    color: ${p => p.$isDeposit ? '#20c997' : '#ff6b6b'};
  }
  
  p {
    margin: 0;
    font-size: 13px;
    color: #868e96;
  }
`;

const ErrorMsg = styled.div`
  color: #ff6b6b;
  font-size: 14px;
  margin-top: 10px;
`;

const SuccessMsg = styled.div`
  color: #20c997;
  font-size: 14px;
  margin-top: 10px;
`;

const InputGroup = styled.div`
  margin-bottom: 20px;
  text-align: left;
`;

const Label = styled.label`
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: #495057;
  margin-bottom: 6px;
`;

const StyledInput = styled.input`
  width: 100%;
  padding: 12px 16px;
  border: 1px solid #ced4da;
  border-radius: 8px;
  font-size: 15px;
  
  &:focus {
    outline: none;
    border-color: #1a5bc4;
    box-shadow: 0 0 0 3px rgba(26, 91, 196, 0.1);
  }
`;

const SubmitButton = styled.button<{ $variant?: 'deposit' | 'withdraw' }>`
  width: 100%;
  padding: 14px;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 700;
  color: white;
  background: ${p => p.$variant === 'deposit' ? '#20c997' : '#ff6b6b'};
  cursor: pointer;
  transition: opacity 0.2s ease;
  
  &:hover {
    opacity: 0.9;
  }
  
  &:disabled {
    background: #ced4da;
    cursor: not-allowed;
  }
`;

const ModeSwitch = styled.div`
  display: flex;
  margin-bottom: 20px;
  background: #f1f3f5;
  border-radius: 8px;
  padding: 4px;
`;

const ModeBtn = styled.button<{ $active: boolean }>`
  flex: 1;
  padding: 10px;
  border: none;
  background: ${p => p.$active ? 'white' : 'transparent'};
  color: ${p => p.$active ? '#111' : '#868e96'};
  font-weight: ${p => p.$active ? '700' : '600'};
  border-radius: 6px;
  box-shadow: ${p => p.$active ? '0 2px 5px rgba(0,0,0,0.05)' : 'none'};
  transition: all 0.2s ease;
  cursor: pointer;
`;


const BankDashboard: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [balance, setBalance] = useState<number>(0);
  const [mode, setMode] = useState<'main' | 'deposit' | 'withdraw'>('main');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [token, setToken] = useState<string | null>(localStorage.getItem('accessToken'));

  const loginRedirectUrl = `/login?redirect=${encodeURIComponent(`${location.pathname}${location.search || ''}`)}`;

  useEffect(() => {
    const handleStorageChange = () => {
      setToken(localStorage.getItem('accessToken'));
    };

    // Listen for storage events from App.tsx sync logic
    window.addEventListener('storage', handleStorageChange);

    // Quick polling for the first few seconds after load, in case of race conditions with OAuth redirect
    const interval = setInterval(handleStorageChange, 500);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  const [exchangeBalance, setExchangeBalance] = useState<number>(0);

  const getEmailFromToken = () => {
    if (!token) return 'default';
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.sub || 'default';
    } catch (e) {
      return 'default';
    }
  };

  const loadBankBalance = () => {
    const email = getEmailFromToken();
    const key = `mock_bank_balance_${email}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      setBalance(Number(saved));
    } else {
      const initial = 50000000; // 5천만원 기본 지급
      setBalance(initial);
      localStorage.setItem(key, String(initial));
    }
  };

  const updateBankBalance = (newBalance: number) => {
    setBalance(newBalance);
    const email = getEmailFromToken();
    localStorage.setItem(`mock_bank_balance_${email}`, String(newBalance));
  };

  const fetchExchangeBalance = () => {
    if (!token) return;
    axios.get(`${API_BASE}/api/assets/KRW`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => {
        setExchangeBalance(res.data.balance || 0);
      })
      .catch((e: any) => {
        console.error("거래소 잔고 조회 실패", e);
        if (e.response && e.response.status === 401) {
          console.warn("Unauthorized API call in BankDashboard. Token may be expired.");
          // Only clear and redirect if we actually had a token that we tried to use and it failed, 
          // preventing a redirect loop if the token was just momentarily missing during sync.
          if (token) {
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            setToken(null);
            navigate(loginRedirectUrl, { replace: true });
          }
        }
      });
  };

  useEffect(() => {
    if (token) {
      loadBankBalance();
      fetchExchangeBalance();
      const interval = setInterval(fetchExchangeBalance, 3000);
      return () => clearInterval(interval);
    }
  }, [token]);

  const handleTransaction = async () => {
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      setError('올바른 금액을 입력하세요.');
      return;
    }

    const numAmount = Number(amount);
    if (mode === 'deposit' && numAmount > balance) {
      setError('가상은행 통장 잔고가 부족합니다.');
      return;
    }
    if (mode === 'withdraw' && numAmount > exchangeBalance) {
      setError('거래소 보유 원화가 부족합니다.');
      return;
    }

    setError('');
    setSuccess('');
    setLoading(true);

    const bankName = "VCE 가상은행";
    const accountNumber = "110-123-456789";

    try {
      const endpoint = mode === 'deposit' ? '/api/assets/deposit' : '/api/assets/withdraw';
      await axios.post(`${API_BASE}${endpoint}`, {
        assetType: 'KRW',
        amount: numAmount,
        bankName,
        accountNumber
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (mode === 'deposit') {
        updateBankBalance(balance - numAmount);
        setSuccess('성공적으로 거래소로 입금되었습니다.');
      } else {
        updateBankBalance(balance + numAmount);
        setSuccess('성공적으로 나의 통장으로 출금되었습니다.');
      }

      setAmount('');
      setTimeout(() => setMode('main'), 2000);
    } catch (err: any) {
      setError(err.response?.data?.message || '거래 처리 중 오류가 발생했습니다.');
      if (err.response && err.response.status === 401) {
        if (token) {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          setToken(null);
          navigate(loginRedirectUrl, { replace: true });
        }
      }
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <PageContainer>
        <DashboardCard>
          <BankLogo>🏦 VCE 가상은행</BankLogo>
          <p>서비스를 이용하려면 거래소 로그인이 필요합니다.</p>
          <SubmitButton style={{ background: '#1a5bc4', marginTop: '20px' }} onClick={() => navigate(loginRedirectUrl)}>로 그 인</SubmitButton>
        </DashboardCard>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <HeaderNav>
        <NavExternalLink href={`${exchangeUrl}/crypto`}>암호화폐 거래소 &rarr;</NavExternalLink>
      </HeaderNav>
      <DashboardCard>
        <BankLogo>🏦 VCE 가상은행</BankLogo>

        <BalanceBox>
          <BalanceLabel>현재 가상은행 통장 잔고</BalanceLabel>
          <BalanceAmount>{balance.toLocaleString()} 원</BalanceAmount>
          <div style={{ fontSize: '13px', color: '#adb5bd', marginTop: '4px' }}>
            연결계좌: VCE 가상은행 110-123-456789
          </div>
          <div style={{ fontSize: '14px', color: '#1a5bc4', marginTop: '12px', fontWeight: 600 }}>
            내 거래소 보유 원화: {exchangeBalance.toLocaleString()} 원
          </div>
        </BalanceBox>

        {mode === 'main' && (
          <ActionGrid>
            <ActionCard $isDeposit onClick={() => { setMode('deposit'); setError(''); setSuccess(''); }}>
              <h3>입 금 하 기</h3>
              <p>가상은행 &rarr; 거래소</p>
            </ActionCard>
            <ActionCard onClick={() => { setMode('withdraw'); setError(''); setSuccess(''); }}>
              <h3>출 금 하 기</h3>
              <p>거래소 &rarr; 가상은행</p>
            </ActionCard>
          </ActionGrid>
        )}

        {mode !== 'main' && (
          <div style={{ textAlign: 'left', marginTop: '10px' }}>
            <ModeSwitch>
              <ModeBtn $active={mode === 'deposit'} onClick={() => setMode('deposit')}>입 금</ModeBtn>
              <ModeBtn $active={mode === 'withdraw'} onClick={() => setMode('withdraw')}>출 금</ModeBtn>
            </ModeSwitch>

            <InputGroup>
              <Label>금액 (KRW)</Label>
              <StyledInput
                type="number"
                placeholder={mode === 'deposit' ? "거래소로 입금할 금액" : "나의 통장으로 출금할 금액"}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </InputGroup>

            <SubmitButton
              $variant={mode}
              onClick={handleTransaction}
              disabled={loading}
            >
              {loading ? '처리중...' : (mode === 'deposit' ? '거래소로 입금' : '나의 통장으로 출금')}
            </SubmitButton>

            <div style={{ textAlign: 'center', marginTop: '16px' }}>
              <NavLink onClick={() => setMode('main')} style={{ fontSize: '14px', color: '#868e96' }}>취 소</NavLink>
            </div>
          </div>
        )}

        {error && <ErrorMsg>{error}</ErrorMsg>}
        {success && <SuccessMsg>{success}</SuccessMsg>}

      </DashboardCard>
    </PageContainer>
  );
};

export default BankDashboard;
