'use client'

import { useState, useEffect } from 'react';
import styled from 'styled-components';
import { useRouter, usePathname } from 'next/navigation';
import axios from 'axios';
import { fetchTickers } from '../services/upbitApi';
import type { UpbitTicker } from '../services/upbitApi';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { clearUserSession, getUserAccessToken } from '../utils/auth';
import { API_BASE_URL } from '@/config/publicEnv';

const API_BASE = API_BASE_URL;

const Container = styled.div`
  min-height: 100vh;
  background: #f5f6f7;
  display: flex;
  flex-direction: column;
`;

const Main = styled.main`
  flex: 1;
  max-width: 1400px;
  width: 100%;
  margin: 24px auto;
  padding: 0 20px;
`;

const PageTitle = styled.h1`
  font-size: 28px;
  color: #1a2e57;
  margin-bottom: 24px;
  font-weight: 700;
`;

const TopSection = styled.div`
  background: linear-gradient(135deg, #093687 0%, #0a4099 100%);
  padding: 32px;
  border-radius: 12px;
  margin-bottom: 32px;
  color: white;
`;

const BalanceRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 16px;
`;

const BalanceLabel = styled.div`
  font-size: 14px;
  opacity: 0.9;
`;

const BalanceValue = styled.div`
  font-size: 32px;
  font-weight: 700;
`;

const Subtitle = styled.div`
  display: flex;
  justify-content: space-between;
  font-size: 14px;
  opacity: 0.85;
  margin-top: 4px;
`;

const TabContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
  margin-bottom: 32px;
`;

const Card = styled.div`
  background: white;
  border-radius: 12px;
  padding: 32px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
`;

const CardTitle = styled.h2`
  font-size: 20px;
  color: #1a2e57;
  margin-bottom: 24px;
  font-weight: 700;
`;

const FormGroup = styled.div`
  margin-bottom: 20px;
`;

const Label = styled.label`
  display: block;
  font-size: 14px;
  color: #666;
  margin-bottom: 8px;
  font-weight: 500;
`;

const Input = styled.input`
  width: 100%;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  box-sizing: border-box;

  &:focus {
    outline: none;
    border-color: #093687;
  }
`;

const Select = styled.select`
  width: 100%;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  box-sizing: border-box;

  &:focus {
    outline: none;
    border-color: #093687;
  }
`;

const Button = styled.button<{ $variant?: 'primary' | 'secondary' }>`
  width: 100%;
  padding: 14px 24px;
  background: ${props => props.$variant === 'secondary' ? '#6c757d' : '#093687'};
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.2s;

  &:hover {
    opacity: 0.9;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const AddressBox = styled.div`
  padding: 16px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px dashed #ced4da;
  word-break: break-all;
  font-family: monospace;
  font-size: 15px;
  color: #1a5bc4;
  font-weight: 600;
  text-align: center;
  margin-bottom: 20px;
`;

const HoldingsCard = styled(Card)`
  grid-column: 1 / -1;
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
`;

const Thead = styled.thead`
  background: #f8f9fa;
`;

const Th = styled.th`
  padding: 12px;
  text-align: left;
  font-size: 13px;
  font-weight: 700;
  color: #666;
  text-transform: uppercase;
`;

const Tbody = styled.tbody``;

const Tr = styled.tr`
  border-bottom: 1px solid #f0f0f0;

  &:hover {
    background: #fafafa;
  }
`;

const Td = styled.td`
  padding: 14px 12px;
  font-size: 14px;
  color: #333;
`;

const Balances = () => {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const loginRedirectUrl = `/login?redirect=${encodeURIComponent(pathname)}`;

  // 자산 정보
  const [krwBalance, setKrwBalance] = useState(0);
  const [assets, setAssets] = useState<any[]>([]);

  // 투자 원금 및 수익률
  const [, setTotalInvestment] = useState(0);

  // 실시간 코인 시세
  const [coinPrices, setCoinPrices] = useState({
    BTC: 0,
    ETH: 0,
    XRP: 0,
    DOGE: 0,
  });

  // 지갑 폼 지정
  const [selectedDepositCoin, setSelectedDepositCoin] = useState('BTC');
  const [depositAddress, setDepositAddress] = useState('');

  const [selectedWithdrawCoin, setSelectedWithdrawCoin] = useState('BTC');
  const [withdrawAddress, setWithdrawAddress] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferring, setTransferring] = useState(false);

  // 로그인 체크, 자산 및 투자원금 조회
  const fetchData = async () => {
    const token = getUserAccessToken();
    if (!token) {
      if (loading) setLoading(false);
      router.replace(loginRedirectUrl);
      return;
    }

    try {
      const headers = { Authorization: `Bearer ${token}` };

      // 자산 조회
      const assetsResponse = await axios.get(`${API_BASE}/api/assets`, { headers });

      if (typeof assetsResponse.data === 'string' && assetsResponse.data.includes('<!DOCTYPE html>')) {
        clearUserSession(true);
        router.push(loginRedirectUrl);
        return;
      }

      const assetsData = Array.isArray(assetsResponse.data) ? assetsResponse.data : [];
      setAssets(assetsData);

      // 투자원금 및 KRW 잔고 조회
      const summaryResponse = await axios.get(`${API_BASE}/api/assets/summary`, { headers });
      const summary = summaryResponse.data;
      setTotalInvestment(summary.totalInvestment || 0);

      if (summary.krwBalance !== undefined) {
        setKrwBalance(summary.krwBalance);
      } else {
        const krw = assetsData.find((a: any) => a.assetType === 'KRW');
        setKrwBalance(krw?.balance || 0);
      }

    } catch (error: any) {
      console.error('자산 조회 실패:', error);
      if (error.response && (
        error.response.status === 401 ||
        (error.response.status === 403 && error.response.data?.message === 'WITHDRAWN_ACCOUNT')
      )) {
        clearUserSession(true);
        router.replace(loginRedirectUrl);
      }
    } finally {
      if (loading) setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const intervalId = setInterval(fetchData, 3000);
    return () => clearInterval(intervalId);
  }, [router, loginRedirectUrl]);

  // 실시간 코인 시세 조회
  useEffect(() => {
    const fetchPrices = async () => {
      if (assets.length === 0) return;

      try {
        const coinTypes = assets
          .map((a: any) => a.assetType)
          .filter((type: string) => type !== 'KRW');

        if (coinTypes.length === 0) return;

        const uniqueTypes = Array.from(new Set(coinTypes));
        const markets = uniqueTypes.map(type => `KRW-${type}`);

        const tickers: UpbitTicker[] = await fetchTickers(markets);

        const prices: any = {};
        tickers.forEach(ticker => {
          const symbol = ticker.market.replace('KRW-', '');
          prices[symbol] = ticker.trade_price;
        });

        setCoinPrices(prev => ({ ...prev, ...prices }));
      } catch (error) {
        console.error('시세 조회 실패:', error);
      }
    };

    fetchPrices();
    const interval = setInterval(fetchPrices, 5000);
    return () => clearInterval(interval);
  }, [assets]);

  // 지갑 주소 조회 (입금)
  useEffect(() => {
    const token = getUserAccessToken();
    if (!token) return;

    axios.get(`${API_BASE}/api/wallets/${selectedDepositCoin}/address`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => {
        setDepositAddress(res.data.address);
      })
      .catch(err => {
        console.error("지갑 주소 조회 실패", err);
        setDepositAddress('주소 발급 실패');
      });
  }, [selectedDepositCoin]);

  const holdingAssets = assets.filter((a: any) => a.assetType !== 'KRW' && Number(a.balance) > 0);

  const totalCoinValue = holdingAssets.reduce((sum, asset) => {
    const price = coinPrices[asset.assetType as keyof typeof coinPrices] || 0;
    return sum + (asset.balance * price);
  }, 0);

  const totalAssets = krwBalance + totalCoinValue;

  const totalCoinBuyAmount = holdingAssets.reduce((sum, asset) => {
    const avgPrice = asset.averageBuyPrice || 0;
    return sum + (asset.balance * avgPrice);
  }, 0);

  const totalEvaluationProfit = totalCoinValue - totalCoinBuyAmount;

  const profitRate = totalCoinBuyAmount > 0
    ? (totalEvaluationProfit / totalCoinBuyAmount * 100).toFixed(2)
    : '0.00';

  const formatAverageBuyPrice = (price: number) => {
    if (!Number.isFinite(price) || price <= 0) return '-';

    let options: Intl.NumberFormatOptions;
    if (price >= 1000) {
      options = { maximumFractionDigits: 0 };
    } else if (price >= 1) {
      options = { minimumFractionDigits: 2, maximumFractionDigits: 4 };
    } else {
      options = { minimumFractionDigits: 3, maximumFractionDigits: 8 };
    }

    return `₩${price.toLocaleString('ko-KR', options)}`;
  };

  const formatKrwPrice = (value: number) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return '-';
    if (n >= 100) return n.toLocaleString('ko-KR', { maximumFractionDigits: 0 });
    if (n >= 1) return n.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (n >= 0.0001) return n.toLocaleString('ko-KR', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
    return n.toLocaleString('ko-KR', { maximumFractionDigits: 8 });
  };

  const formatKrwValue = (value: number) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return '-';
    return n.toLocaleString('ko-KR', { maximumFractionDigits: 4 });
  };

  const formatCoinAmount = (value: number) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return '0';
    return n.toFixed(8).replace(/\.?0+$/, '');
  };

  const toUserMessage = (raw: unknown, fallback: string) => {
    const code = String(raw ?? '');
    if (code.includes('WITHDRAWN_ACCOUNT')) return '탈퇴 계정입니다. 관리자에게 문의하세요.';
    if (code.includes('RESTRICTED_ACCOUNT')) return '입출금이 제한된 계정입니다.';
    return code || fallback;
  };

  const availableWithdrawAmount = assets.find((a: any) => a.assetType === selectedWithdrawCoin)?.balance || 0;

  const handleCoinTransfer = async () => {
    const token = getUserAccessToken();
    if (!token || !withdrawAddress || !transferAmount) return;

    setTransferring(true);
    try {
      await axios.post(`${API_BASE}/api/wallets/transfer`,
        {
          assetType: selectedWithdrawCoin,
          toAddress: withdrawAddress,
          amount: parseFloat(transferAmount),
          currentPrice: coinPrices[selectedWithdrawCoin as keyof typeof coinPrices] || 0
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setTransferAmount('');
      setWithdrawAddress('');
      alert('코인 이체가 완료되었습니다.');
      fetchData(); // Transfer 완료 직후 갱신
    } catch (error: any) {
      const msg = toUserMessage(error.response?.data?.message || '처리에 실패했습니다.', '처리에 실패했습니다.');
      alert(msg);
    } finally {
      setTransferring(false);
    }
  };

  if (loading) {
    return (
      <Container>
        <Header />
        <Main>
          <PageTitle>자산/지갑 관리</PageTitle>
          <div style={{ textAlign: 'center', padding: '60px', color: '#999' }}>로딩 중...</div>
        </Main>
        <Footer />
      </Container>
    );
  }

  return (
    <Container>
      <Header />
      <Main>
        <PageTitle>자산/지갑 관리</PageTitle>

        <TopSection>
          <BalanceRow>
            <BalanceLabel>보유 현금</BalanceLabel>
            <BalanceValue>{formatKrwValue(krwBalance)} KRW</BalanceValue>
          </BalanceRow>
          <BalanceRow>
            <BalanceLabel>총 보유 자산</BalanceLabel>
            <BalanceValue>{formatKrwValue(totalAssets)} KRW</BalanceValue>
          </BalanceRow>
          <Subtitle>
            <span>투자 수익률</span>
            <span style={{ fontSize: '18px', fontWeight: 700 }}>
              {parseFloat(profitRate) >= 0 ? '+' : ''}{profitRate}%
            </span>
          </Subtitle>
        </TopSection>

        <TabContainer>
          <Card>
            <CardTitle>내 지갑 입금 주소</CardTitle>
            <FormGroup>
              <Label>코인 선택</Label>
              <Select value={selectedDepositCoin} onChange={(e) => setSelectedDepositCoin(e.target.value)}>
                <option value="BTC">비트코인 (BTC)</option>
                <option value="ETH">이더리움 (ETH)</option>
                <option value="XRP">리플 (XRP)</option>
                <option value="DOGE">도지코인 (DOGE)</option>
              </Select>
            </FormGroup>

            <Label>내 {selectedDepositCoin} 입금 주소</Label>
            <AddressBox>
              {depositAddress || "주소를 불러오는 중..."}
            </AddressBox>
            <p style={{ fontSize: '13px', color: '#868e96', marginTop: 0 }}>
              이 주소로 다른 VCE 회원이 코인을 전송할 수 있습니다.
            </p>
          </Card>

          <Card>
            <CardTitle>코인 이체하기 (출금)</CardTitle>
            <FormGroup>
              <Label>
                코인 선택
                <span style={{ float: 'right', fontSize: '13px', color: '#093687' }}>
                  보유량: {formatCoinAmount(availableWithdrawAmount)} {selectedWithdrawCoin}
                </span>
              </Label>
              <Select value={selectedWithdrawCoin} onChange={(e) => {
                setSelectedWithdrawCoin(e.target.value);
                setTransferAmount('');
              }}>
                <option value="BTC">비트코인 (BTC)</option>
                <option value="ETH">이더리움 (ETH)</option>
                <option value="XRP">리플 (XRP)</option>
                <option value="DOGE">도지코인 (DOGE)</option>
              </Select>
            </FormGroup>
            <FormGroup>
              <Label>받는 사람의 VCE 지갑 주소</Label>
              <Input
                type="text"
                placeholder="상대방의 지갑 주소 (예: VCE-abc...)"
                value={withdrawAddress}
                onChange={(e) => setWithdrawAddress(e.target.value)}
              />
            </FormGroup>
            <FormGroup>
              <Label>
                수량
                <button
                  type="button"
                  style={{ float: 'right', fontSize: '12px', background: 'none', border: 'none', color: '#1a5bc4', cursor: 'pointer', fontWeight: 600 }}
                  onClick={() => setTransferAmount(formatCoinAmount(availableWithdrawAmount))}
                >
                  최대
                </button>
              </Label>
              <Input
                type="number"
                step="0.00000001"
                placeholder="전송할 수량을 입력하세요"
                value={transferAmount}
                onChange={(e) => setTransferAmount(e.target.value)}
              />
            </FormGroup>
            <Button onClick={handleCoinTransfer} disabled={!transferAmount || !withdrawAddress || transferring || parseFloat(transferAmount) <= 0 || parseFloat(transferAmount) > availableWithdrawAmount}>
              {transferring ? '전송 중...' : '전송하기'}
            </Button>
          </Card>
        </TabContainer>

        <HoldingsCard>
          <CardTitle>보유 코인</CardTitle>
          <Table>
            <Thead>
              <Tr>
                <Th>코인</Th>
                <Th>보유 수량</Th>
                <Th>평단가</Th>
                <Th>현재가</Th>
                <Th>평가 금액</Th>
                <Th>수익률</Th>
              </Tr>
            </Thead>
            <Tbody>
              {holdingAssets.map((asset: any) => {
                const symbol = asset.assetType;
                const balance = asset.balance;
                const price = coinPrices[symbol as keyof typeof coinPrices] || 0;
                const value = balance * price;
                const avgPrice = asset.averageBuyPrice || 0;
                const profitRate = avgPrice > 0 ? ((price - avgPrice) / avgPrice * 100) : 0;

                return (
                  <Tr key={symbol}>
                    <Td><strong>{symbol}</strong></Td>
                    <Td>{formatCoinAmount(balance)} {symbol}</Td>
                    <Td>{formatAverageBuyPrice(avgPrice)}</Td>
                    <Td>{formatKrwPrice(price)} KRW</Td>
                    <Td>{formatKrwValue(value)} KRW</Td>
                    <Td style={{ color: profitRate > 0 ? '#d60000' : profitRate < 0 ? '#0051c7' : '#333' }}>
                      {profitRate > 0 ? '+' : ''}{profitRate.toFixed(2)}%
                    </Td>
                  </Tr>
                );
              })}
              {holdingAssets.length === 0 && (
                <Tr>
                  <Td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                    보유 중인 코인이 없습니다.
                  </Td>
                </Tr>
              )}
            </Tbody>
          </Table>
        </HoldingsCard>
      </Main >
      <Footer />
    </Container >
  );
};

export default Balances;
