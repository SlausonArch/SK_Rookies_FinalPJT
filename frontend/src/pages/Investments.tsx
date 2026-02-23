import { useState, useEffect, useMemo } from 'react';
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

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
  margin-bottom: 32px;
`;

const StatCard = styled.div<{ $positive?: boolean }>`
  background: ${props => props.$positive ?
    'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)' :
    'linear-gradient(135deg, #093687 0%, #0a4099 100%)'};
  padding: 24px;
  border-radius: 12px;
  color: white;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
`;

const StatLabel = styled.div`
  font-size: 13px;
  opacity: 0.9;
  margin-bottom: 8px;
  font-weight: 500;
`;

const StatValue = styled.div`
  font-size: 32px;
  font-weight: 700;
  margin-bottom: 4px;
`;

const StatChange = styled.div`
  font-size: 14px;
  opacity: 0.85;
`;

const Card = styled.div`
  background: white;
  border-radius: 12px;
  padding: 32px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
`;

const CardHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
`;

const CardTitle = styled.h2`
  font-size: 20px;
  color: #1a2e57;
  font-weight: 700;
  margin: 0;
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
`;

const Thead = styled.thead`
  background: #f8f9fa;
`;

const Th = styled.th`
  padding: 14px;
  text-align: left;
  font-size: 13px;
  font-weight: 700;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const SortTh = styled(Th)`
  cursor: pointer;
  user-select: none;
`;

const Tbody = styled.tbody``;

const Tr = styled.tr`
  border-bottom: 1px solid #f0f0f0;

  &:hover {
    background: #fafafa;
  }
`;

const Td = styled.td`
  padding: 16px 14px;
  font-size: 14px;
  color: #333;
`;

const SymbolButton = styled.button`
  border: 0;
  background: transparent;
  padding: 0;
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  color: #093687;
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }
`;

const Badge = styled.span<{ type: string }>`
  display: inline-block;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  background: ${props => props.type === 'BUY' ? '#d60000' : props.type === 'SELL' ? '#0051c7' : '#666'};
  color: white;
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 60px 20px;
  color: #999;
`;

const Pagination = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
  margin-top: 16px;
`;

const PageButton = styled.button<{ $active?: boolean }>`
  border: 1px solid ${props => (props.$active ? '#093687' : '#d1d8e3')};
  background: ${props => (props.$active ? '#eef3ff' : '#fff')};
  color: ${props => (props.$active ? '#093687' : '#333')};
  border-radius: 6px;
  min-width: 34px;
  height: 34px;
  padding: 0 10px;
  cursor: pointer;

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
`;

interface Transaction {
  txId: number;
  txType: string;
  assetType: string;
  amount: number;
  price: number | null;
  totalValue: number;
  fee: number | null;
  txDate: string;
}

type SortKey = 'txDate' | 'txType' | 'assetType' | 'amount' | 'price' | 'totalValue' | 'fee';
type SortOrder = 'asc' | 'desc';

const ROWS_PER_PAGE = 10;
function getKst9Anchor(now: Date = new Date()): Date {
  const offsetMs = 9 * 60 * 60 * 1000;
  const kstNow = new Date(now.getTime() + offsetMs);
  const y = kstNow.getUTCFullYear();
  const m = kstNow.getUTCMonth();
  const d = kstNow.getUTCDate();
  const h = kstNow.getUTCHours();
  const targetDay = h < 9 ? d - 1 : d;
  return new Date(Date.UTC(y, m, targetDay, 0, 0, 0));
}

const Investments = () => {
  const navigate = useNavigate();
  const [sortKey, setSortKey] = useState<SortKey>('txDate');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [currentPage, setCurrentPage] = useState(1);

  // 자산
  const [krwBalance, setKrwBalance] = useState(0);

  // 투자원금
  const [totalInvestment, setTotalInvestment] = useState(0);

  // 실시간 코인 시세 및 변동액
  const [coinPrices, setCoinPrices] = useState<Record<string, { price: number, changePrice: number }>>({});

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const [assets, setAssets] = useState<any[]>([]);

  // 로그인 체크 및 데이터 조회
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
        const balanceResponse = await axios.get('http://localhost:8080/api/assets', { headers });

        // HTML 응답 체크
        if (typeof balanceResponse.data === 'string' && balanceResponse.data.includes('<!DOCTYPE html>')) {
          console.warn('인증 세션 만료됨');
          localStorage.removeItem('accessToken');
          navigate('/login');
          return;
        }

        console.log('자산 API 응답:', balanceResponse.data);

        const assetsData = Array.isArray(balanceResponse.data) ? balanceResponse.data : [];
        setAssets(assetsData);

        // 투자원금 및 KRW 잔고 조회
        const summaryResponse = await axios.get('http://localhost:8080/api/assets/summary', { headers });
        console.log('투자원금 API 응답:', summaryResponse.data);
        setTotalInvestment(summaryResponse.data.totalInvestment || 0);

        // KRW 잔고는 summaryResponse가 더 정확할 수 있음
        const summaryKrw = summaryResponse.data.krwBalance;
        if (summaryKrw !== undefined) {
          setKrwBalance(summaryKrw);
        }

        // 거래 내역 조회
        const txResponse = await axios.get('http://localhost:8080/api/transactions', { headers });
        console.log('거래내역 API 응답:', txResponse.data);
        setTransactions(txResponse.data || []);
      } catch (error) {
        console.error('데이터 조회 실패:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [navigate]);

  // 실시간 코인 시세 조회
  useEffect(() => {
    const fetchPrices = async () => {
      // assets가 비어있어도 시세는 조회해야 함 (보유 코인이 없어도 관심 코인 등) 
      // 하지만 여기서는 보유 코인 기반으로 조회하므로 assets 의존
      if (assets.length === 0) return;

      try {
        const coinTypes = assets
          .map((a: any) => a.assetType)
          .filter((type: string) => type !== 'KRW');

        // 보유 코인이 없으면 기본 메이저 코인이라도 조회
        const markets = coinTypes.length > 0
          ? Array.from(new Set(coinTypes)).map(type => `KRW-${type}`)
          : ['KRW-BTC', 'KRW-ETH', 'KRW-XRP'];

        const tickers: UpbitTicker[] = await fetchTickers(markets);

        const newPrices: Record<string, { price: number, changePrice: number }> = {};
        tickers.forEach(ticker => {
          const symbol = ticker.market.replace('KRW-', '');
          newPrices[symbol] = {
            price: ticker.trade_price,
            changePrice: ticker.signed_change_price
          };
        });

        setCoinPrices(prev => ({ ...prev, ...newPrices }));
      } catch (error) {
        console.error('시세 조회 실패:', error);
      }
    };

    fetchPrices();
    const interval = setInterval(fetchPrices, 5000); // 5초마다 업데이트
    return () => clearInterval(interval);
  }, [assets]);

  // 필터링된 거래 내역
  const onSort = (key: SortKey) => {
    setCurrentPage(1);
    if (sortKey === key) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortOrder('desc');
  };

  const sortedTrades = useMemo(() => {
    const data = [...transactions];
    const direction = sortOrder === 'asc' ? 1 : -1;

    data.sort((a, b) => {
      if (sortKey === 'txDate') {
        const aTime = Number.isNaN(new Date(a.txDate).getTime()) ? 0 : new Date(a.txDate).getTime();
        const bTime = Number.isNaN(new Date(b.txDate).getTime()) ? 0 : new Date(b.txDate).getTime();
        return (aTime - bTime) * direction;
      }

      if (sortKey === 'txType' || sortKey === 'assetType') {
        const aText = String(a[sortKey] ?? '');
        const bText = String(b[sortKey] ?? '');
        return aText.localeCompare(bText, 'ko-KR') * direction;
      }

      const aValue = Number(a[sortKey] ?? 0);
      const bValue = Number(b[sortKey] ?? 0);
      return (aValue - bValue) * direction;
    });

    return data;
  }, [transactions, sortKey, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(sortedTrades.length / ROWS_PER_PAGE));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const pagedTrades = useMemo(() => {
    const start = (currentPage - 1) * ROWS_PER_PAGE;
    return sortedTrades.slice(start, start + ROWS_PER_PAGE);
  }, [sortedTrades, currentPage]);

  // 총 보유 자산 계산 (실시간 시세 반영)
  const totalAssets = krwBalance + assets
    .filter((a: any) => a.assetType !== 'KRW')
    .reduce((sum, asset) => {
      const info = coinPrices[asset.assetType] || { price: 0, changePrice: 0 };
      return sum + (asset.balance * info.price);
    }, 0);

  // KST 09:00 ~ 현재 기준 거래 (입출금 제외)
  const sessionStart = getKst9Anchor();
  const todayTrades = transactions.filter(tx => {
    const txTime = new Date(tx.txDate).getTime();
    if (Number.isNaN(txTime)) return false;
    return txTime >= sessionStart.getTime() && (tx.txType === 'BUY' || tx.txType === 'SELL');
  });
  const todayTradeAmount = todayTrades.reduce((sum, tx) => sum + (Number(tx.totalValue) || 0), 0);

  // 오늘 수익: 보유 자산의 평가손익만 반영 (KST 9시 기준가 대비)
  // Upbit signed_change_price = 현재가 - KST 9시 기준가
  const todayProfit = assets
    .filter((a: any) => a.assetType !== 'KRW' && (Number(a.balance) || 0) > 0)
    .reduce((sum, asset) => {
      const info = coinPrices[asset.assetType] || { price: 0, changePrice: 0 };
      return sum + ((Number(asset.balance) || 0) * info.changePrice);
    }, 0);

  // 총 수익률 (투자원금 기반)
  const profitRate = totalInvestment > 0
    ? ((totalAssets - totalInvestment) / totalInvestment * 100).toFixed(2)
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

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const sortMark = (key: SortKey) => {
    if (sortKey !== key) return '';
    return sortOrder === 'asc' ? ' ▲' : ' ▼';
  };

  if (loading) {
    return (
      <Container>
        <Header />
        <Main>
          <PageTitle>투자 내역</PageTitle>
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
        <PageTitle>투자 내역</PageTitle>

        <StatsGrid>
          <StatCard $positive={todayProfit >= 0}>
            <StatLabel>오늘의 수익</StatLabel>
            <StatValue>{todayProfit >= 0 ? '+' : ''}₩{Math.round(todayProfit).toLocaleString()}</StatValue>
            <StatChange>{todayProfit >= 0 ? '수익' : '손실'}</StatChange>
          </StatCard>
          <StatCard>
            <StatLabel>오늘의 거래금액</StatLabel>
            <StatValue>₩{todayTradeAmount.toLocaleString()}</StatValue>
            <StatChange>{todayTrades.length}건 거래</StatChange>
          </StatCard>
          <StatCard>
            <StatLabel>총 보유 자산</StatLabel>
            <StatValue>₩{Math.round(totalAssets).toLocaleString()}</StatValue>
            <StatChange>현금 + 코인</StatChange>
          </StatCard>
          <StatCard>
            <StatLabel>총 수익률</StatLabel>
            <StatValue>{parseFloat(profitRate) >= 0 ? '+' : ''}{profitRate}%</StatValue>
            <StatChange>누적 수익</StatChange>
          </StatCard>
        </StatsGrid>

        <Card style={{ marginBottom: '32px' }}>
          <CardHeader>
            <CardTitle>보유 자산 현황</CardTitle>
            <div style={{ fontSize: '14px', color: '#666' }}>
              현재 보유 중인 코인의 평가 현황입니다.
            </div>
          </CardHeader>
          <Table>
            <Thead>
              <Tr>
                <Th>코인</Th>
                <Th>보유수량</Th>
                <Th>평단가</Th>
                <Th>현재가</Th>
                <Th>평가금액</Th>
                <Th>평가손익</Th>
                <Th>수익률</Th>
              </Tr>
            </Thead>
            <Tbody>
              {assets.filter((a: any) => a.assetType !== 'KRW' && a.balance > 0).map((asset: any) => {
                const symbol = asset.assetType;
                const market = symbol.startsWith('KRW-') ? symbol : `KRW-${symbol}`;
                const balance = asset.balance;
                const avgPrice = asset.averageBuyPrice || 0;
                const coinInfo = coinPrices[symbol] || { price: 0, changePrice: 0 };
                const currentPrice = coinInfo.price;
                const valuation = balance * currentPrice;
                const totalInvest = balance * avgPrice;
                const profit = valuation - totalInvest;
                const profitRate = totalInvest > 0 ? (profit / totalInvest * 100) : 0;

                return (
                  <Tr key={symbol}>
                    <Td>
                      <SymbolButton
                        type='button'
                        onClick={() => navigate(`/exchange?market=${encodeURIComponent(market)}`)}
                      >
                        {symbol}
                      </SymbolButton>
                    </Td>
                    <Td>{balance.toFixed(8)}</Td>
                    <Td>{formatAverageBuyPrice(avgPrice)}</Td>
                    <Td>₩{currentPrice.toLocaleString()}</Td>
                    <Td>₩{Math.round(valuation).toLocaleString()}</Td>
                    <Td style={{ color: avgPrice > 0 ? (profit >= 0 ? '#d60000' : '#0051c7') : '#999' }}>
                      {avgPrice > 0 ? `${profit >= 0 ? '+' : ''}₩${Math.round(profit).toLocaleString()}` : '-'}
                    </Td>
                    <Td style={{ color: avgPrice > 0 ? (profitRate >= 0 ? '#d60000' : '#0051c7') : '#999' }}>
                      {avgPrice > 0 ? `${profitRate >= 0 ? '+' : ''}${profitRate.toFixed(2)}%` : '-'}
                    </Td>
                  </Tr>
                );
              })}
              {assets.filter((a: any) => a.assetType !== 'KRW' && a.balance > 0).length === 0 && (
                <Tr>
                  <Td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                    보유 중인 코인이 없습니다.
                  </Td>
                </Tr>
              )}
            </Tbody>
          </Table>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>거래 내역</CardTitle>
            <div style={{ fontSize: '13px', color: '#666' }}>헤더 클릭으로 정렬</div>
          </CardHeader>

          {sortedTrades.length > 0 ? (
            <Table>
              <Thead>
                <Tr>
                  <SortTh onClick={() => onSort('txDate')}>날짜{sortMark('txDate')}</SortTh>
                  <SortTh onClick={() => onSort('txType')}>구분{sortMark('txType')}</SortTh>
                  <SortTh onClick={() => onSort('assetType')}>자산{sortMark('assetType')}</SortTh>
                  <SortTh onClick={() => onSort('amount')}>수량{sortMark('amount')}</SortTh>
                  <SortTh onClick={() => onSort('price')}>거래가{sortMark('price')}</SortTh>
                  <SortTh onClick={() => onSort('totalValue')}>총액{sortMark('totalValue')}</SortTh>
                  <SortTh onClick={() => onSort('fee')}>비고{sortMark('fee')}</SortTh>
                </Tr>
              </Thead>
              <Tbody>
                {pagedTrades.map(tx => (
                  <Tr key={tx.txId}>
                    <Td>{formatDate(tx.txDate)}</Td>
                    <Td>
                      <Badge type={tx.txType}>
                        {tx.txType === 'BUY' ? '매수' :
                          tx.txType === 'SELL' ? '매도' :
                            tx.txType === 'DEPOSIT' ? '입금' : '출금'}
                      </Badge>
                    </Td>
                    <Td><strong>{tx.assetType}</strong></Td>
                    <Td>{tx.amount.toLocaleString()}</Td>
                    <Td>
                      {(tx.txType === 'DEPOSIT' || tx.txType === 'WITHDRAW') ? '-' : `₩${tx.price?.toLocaleString()}`}
                    </Td>
                    <Td>₩{tx.totalValue.toLocaleString()}</Td>
                    <Td>{tx.fee ? `수수료 ₩${tx.fee.toLocaleString()}` : '-'}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          ) : (
            <EmptyState>거래 내역이 없습니다.</EmptyState>
          )}

          {sortedTrades.length > 0 && (
            <Pagination>
              <PageButton
                type='button'
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                이전
              </PageButton>
              <span style={{ fontSize: '13px', color: '#555' }}>
                {currentPage} / {totalPages}
              </span>
              <PageButton
                type='button'
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
              >
                다음
              </PageButton>
            </Pagination>
          )}
        </Card>
      </Main>
      <Footer />
    </Container>
  );
};

export default Investments;
