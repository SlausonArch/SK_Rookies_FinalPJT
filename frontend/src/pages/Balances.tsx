import { useState, useEffect } from 'react';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { fetchTickers } from '../services/upbitApi';
import type { UpbitTicker } from '../services/upbitApi';
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

const ButtonGroup = styled.div`
  display: flex;
  gap: 12px;
`;

const Button = styled.button<{ $variant?: 'primary' | 'secondary' }>`
  flex: 1;
  padding: 12px 24px;
  background: ${props => props.$variant === 'secondary' ? '#6c757d' : '#093687'};
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
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
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  // 자산 정보
  const [krwBalance, setKrwBalance] = useState(0);
  const [assets, setAssets] = useState<any[]>([]);

  // 투자 원금 및 수익률
  const [totalInvestment, setTotalInvestment] = useState(0);

  // 실시간 코인 시세
  const [coinPrices, setCoinPrices] = useState({
    BTC: 0,
    ETH: 0,
    XRP: 0,
    DOGE: 0,
  });

  // 입출금 폼
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [selectedCoin, setSelectedCoin] = useState('BTC');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferType, setTransferType] = useState<'deposit' | 'withdraw'>('deposit');

  // 로그인 체크, 자산 및 투자원금 조회
  useEffect(() => {
    const token = localStorage.getItem('accessToken');

    if (!token) {
      navigate('/login', { replace: true });
      return;
    }

    const fetchData = async () => {
      try {
        const headers = { Authorization: `Bearer ${token}` };

        // 자산 조회
        const assetsResponse = await axios.get('http://localhost:8080/api/assets', { headers });

        // HTML 응답 체크 (세션 만료/로그인 필요 시 200 OK로 로그인 페이지가 올 수 있음)
        if (typeof assetsResponse.data === 'string' && assetsResponse.data.includes('<!DOCTYPE html>')) {
          console.warn('인증 세션 만료됨');
          localStorage.removeItem('accessToken');
          navigate('/login');
          return;
        }

        console.log('자산 API 응답:', assetsResponse.data);

        const assetsData = Array.isArray(assetsResponse.data) ? assetsResponse.data : [];
        setAssets(assetsData);

        if (assetsData.length === 0) {
          console.warn('자산 데이터가 비어있습니다.');
        }

        // 투자원금 및 KRW 잔고 조회 (summaryResponse가 더 정확함)
        const summaryResponse = await axios.get('http://localhost:8080/api/assets/summary', { headers });
        console.log('투자원금 API 응답:', summaryResponse.data);

        const summary = summaryResponse.data;
        setTotalInvestment(summary.totalInvestment || 0);

        // KRW 잔고를 summary에서 우선 사용 (assets 리스트에 없을 수 있음)
        if (summary.krwBalance !== undefined) {
          setKrwBalance(summary.krwBalance);
        } else {
          const krw = assetsData.find((a: any) => a.assetType === 'KRW');
          setKrwBalance(krw?.balance || 0);
        }

      } catch (error) {
        console.error('자산 조회 실패:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [navigate]);

  // 실시간 코인 시세 조회
  useEffect(() => {
    const fetchPrices = async () => {
      if (assets.length === 0) return;

      try {
        // 보유 중인 코인만 시세 조회 (KRW 제외)
        const coinTypes = assets
          .map((a: any) => a.assetType)
          .filter((type: string) => type !== 'KRW');

        if (coinTypes.length === 0) return;

        // 중복 제거
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
    const interval = setInterval(fetchPrices, 5000); // 5초마다 업데이트
    return () => clearInterval(interval);
  }, [assets]);

  // 총 보유 자산 (실시간 시세 반영)
  const totalAssets = krwBalance + assets
    .filter((a: any) => a.assetType !== 'KRW')
    .reduce((sum, asset) => {
      const price = coinPrices[asset.assetType as keyof typeof coinPrices] || 0;
      return sum + (asset.balance * price);
    }, 0);

  // 수익률 (투자원금 기반)
  const profitRate = totalInvestment > 0
    ? ((totalAssets - totalInvestment) / totalInvestment * 100).toFixed(2)
    : '0.00';

  const handleCashDeposit = async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    try {
      await axios.post('http://localhost:8080/api/assets/deposit',
        { assetType: 'KRW', amount: parseFloat(depositAmount) },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert('입금이 완료되었습니다.');
      window.location.reload();
    } catch (error) {
      alert('입금에 실패했습니다.');
    }
  };

  const handleCashWithdraw = async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    try {
      await axios.post('http://localhost:8080/api/assets/withdraw',
        { assetType: 'KRW', amount: parseFloat(withdrawAmount) },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert('출금이 완료되었습니다.');
      window.location.reload();
    } catch (error: any) {
      alert(error.response?.data?.message || '출금에 실패했습니다.');
    }
  };

  const handleCoinTransfer = async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    const endpoint = transferType === 'deposit' ? 'deposit' : 'withdraw';

    try {
      await axios.post(`http://localhost:8080/api/assets/${endpoint}`,
        { assetType: selectedCoin, amount: parseFloat(transferAmount) },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert(`${transferType === 'deposit' ? '입금' : '출금'}이 완료되었습니다.`);
      window.location.reload();
    } catch (error: any) {
      alert(error.response?.data?.message || '처리에 실패했습니다.');
    }
  };

  if (loading) {
    return (
      <Container>
        <Header />
        <Main>
          <PageTitle>입출금</PageTitle>
          <div style={{ textAlign: 'center', padding: '60px', color: '#999' }}>
            로딩 중...
          </div>
        </Main>
        <Footer />
      </Container>
    );
  }

  return (
    <Container>
      <Header />
      <Main>
        <PageTitle>입출금</PageTitle>

        <TopSection>
          <BalanceRow>
            <BalanceLabel>보유 현금</BalanceLabel>
            <BalanceValue>₩{Math.round(krwBalance).toLocaleString()}</BalanceValue>
          </BalanceRow>
          <BalanceRow>
            <BalanceLabel>총 보유 자산</BalanceLabel>
            <BalanceValue>₩{Math.round(totalAssets).toLocaleString()}</BalanceValue>
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
            <CardTitle>현금 입금</CardTitle>
            <FormGroup>
              <Label>금액 (KRW)</Label>
              <Input
                type="number"
                placeholder="입금할 금액을 입력하세요"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
              />
            </FormGroup>
            <ButtonGroup>
              <Button onClick={handleCashDeposit} disabled={!depositAmount}>
                입금하기
              </Button>
            </ButtonGroup>
          </Card>

          <Card>
            <CardTitle>현금 출금</CardTitle>
            <FormGroup>
              <Label>금액 (KRW)</Label>
              <Input
                type="number"
                placeholder="출금할 금액을 입력하세요"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
              />
            </FormGroup>
            <ButtonGroup>
              <Button $variant="secondary" onClick={handleCashWithdraw} disabled={!withdrawAmount}>
                출금하기
              </Button>
            </ButtonGroup>
          </Card>
        </TabContainer>

        <Card>
          <CardTitle>코인 전송</CardTitle>
          <FormGroup>
            <Label>코인 선택</Label>
            <Select value={selectedCoin} onChange={(e) => setSelectedCoin(e.target.value)}>
              <option value="BTC">비트코인 (BTC)</option>
              <option value="ETH">이더리움 (ETH)</option>
              <option value="XRP">리플 (XRP)</option>
              <option value="DOGE">도지코인 (DOGE)</option>
            </Select>
          </FormGroup>
          <FormGroup>
            <Label>거래 유형</Label>
            <Select value={transferType} onChange={(e) => setTransferType(e.target.value as any)}>
              <option value="deposit">입금</option>
              <option value="withdraw">출금</option>
            </Select>
          </FormGroup>
          <FormGroup>
            <Label>수량</Label>
            <Input
              type="number"
              step="0.00000001"
              placeholder="전송할 수량을 입력하세요"
              value={transferAmount}
              onChange={(e) => setTransferAmount(e.target.value)}
            />
          </FormGroup>
          <ButtonGroup>
            <Button onClick={handleCoinTransfer} disabled={!transferAmount}>
              {transferType === 'deposit' ? '입금' : '출금'}하기
            </Button>
          </ButtonGroup>
        </Card>

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
              {assets.filter((a: any) => a.assetType !== 'KRW').map((asset: any) => {
                const symbol = asset.assetType;
                const balance = asset.balance;
                const price = coinPrices[symbol as keyof typeof coinPrices] || 0;
                const value = balance * price;
                const avgPrice = asset.averageBuyPrice || 0;
                const profitRate = avgPrice > 0 ? ((price - avgPrice) / avgPrice * 100) : 0;

                return (
                  <Tr key={symbol}>
                    <Td><strong>{symbol}</strong></Td>
                    <Td>{balance.toLocaleString()} {symbol}</Td>
                    <Td>₩{Math.round(avgPrice).toLocaleString()}</Td>
                    <Td>₩{price.toLocaleString()}</Td>
                    <Td>₩{Math.round(value).toLocaleString()}</Td>
                    <Td style={{ color: profitRate > 0 ? '#d60000' : profitRate < 0 ? '#0051c7' : '#333' }}>
                      {profitRate > 0 ? '+' : ''}{profitRate.toFixed(2)}%
                    </Td>
                  </Tr>
                );
              })}
              {assets.filter((a: any) => a.assetType !== 'KRW').length === 0 && (
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
