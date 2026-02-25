import { useState, useEffect, useMemo } from 'react';
import styled from 'styled-components';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { fetchTickers } from '../services/upbitApi';
import type { UpbitTicker } from '../services/upbitApi';
import { TrendingUp, TrendingDown, ArrowRightLeft, Download, Upload, Clock } from 'lucide-react';
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

const StatCard = styled.div<{ $type?: 'positive' | 'negative' | 'default' }>`
  background: ${props =>
    props.$type === 'negative' ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' :
      props.$type === 'positive' ? 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)' :
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

const SubHeader = styled.div`
  background: #fff;
  border-radius: 12px;
  padding: 8px;
  margin-bottom: 24px;
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
`;

const SubHeaderButton = styled.button<{ $active: boolean }>`
  border: 1px solid ${props => props.$active ? '#093687' : '#d9e0ea'};
  background: ${props => props.$active ? '#eef3ff' : '#fff'};
  color: ${props => props.$active ? '#093687' : '#495057'};
  border-radius: 10px;
  padding: 12px 10px;
  font-size: 14px;
  font-weight: ${props => props.$active ? 700 : 600};
  cursor: pointer;
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

const CardDescription = styled.div`
  color: #667085;
  font-size: 13px;
`;

const SummaryGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 14px;
  margin-bottom: 24px;
`;

const SummaryItem = styled.div`
  border: 1px solid #e5eaf2;
  border-radius: 10px;
  padding: 14px;
  background: #f8fafd;
`;

const SummaryLabel = styled.div`
  color: #667085;
  font-size: 12px;
  margin-bottom: 8px;
`;

const SummaryValue = styled.div<{ $tone?: 'up' | 'down' | 'default' }>`
  color: ${props =>
    props.$tone === 'up' ? '#d60000' :
      props.$tone === 'down' ? '#0051c7' :
        '#1a2e57'};
  font-size: 20px;
  font-weight: 700;
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
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  background: ${props => props.type === 'BUY' ? '#d60000' : props.type === 'SELL' ? '#0051c7' : '#666'};
  color: white;
`;

const StatusPill = styled.span<{ $color: 'gray' | 'blue' | 'green' }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  color: white;
  background: ${props =>
    props.$color === 'green' ? '#16a34a' :
      props.$color === 'blue' ? '#1d4ed8' :
        '#6b7280'};
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

const InfoBanner = styled.div`
  border: 1px solid #dbe6ff;
  background: #f3f7ff;
  color: #334155;
  border-radius: 10px;
  padding: 12px 14px;
  font-size: 13px;
  margin-bottom: 16px;
`;

const PerformanceNotice = styled.div`
  border-top: 1px solid #e7ebf2;
  border-bottom: 1px solid #e7ebf2;
  background: #f9fbff;
  color: #4b5563;
  padding: 12px 14px;
  font-size: 14px;
  margin-bottom: 14px;
`;

const PerformanceControls = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
  flex-wrap: wrap;
`;

const MetricTabs = styled.div`
  display: inline-flex;
  border: 1px solid #d8dde5;
  background: #fff;
`;

const MetricTabButton = styled.button<{ $active: boolean }>`
  border: none;
  border-right: 1px solid #d8dde5;
  padding: 12px 18px;
  font-size: 14px;
  font-weight: 600;
  background: ${props => props.$active ? '#eef4ff' : '#fff'};
  color: ${props => props.$active ? '#0b3e91' : '#374151'};
  cursor: pointer;

  &:last-child {
    border-right: none;
  }
`;

const PeriodControlGroup = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 10px;
`;

const PeriodModeTabs = styled.div`
  display: inline-flex;
  border: 1px solid #d8dde5;
  background: #fff;
`;

const PeriodModeButton = styled.button<{ $active: boolean }>`
  border: none;
  border-right: 1px solid #d8dde5;
  padding: 10px 16px;
  font-size: 14px;
  font-weight: 600;
  background: ${props => props.$active ? '#eef4ff' : '#fff'};
  color: ${props => props.$active ? '#0b3e91' : '#374151'};
  cursor: pointer;

  &:last-child {
    border-right: none;
  }
`;

const PeriodSelect = styled.select`
  min-width: 150px;
  border: 1px solid #d8dde5;
  background: #fff;
  color: #1f2937;
  font-size: 14px;
  padding: 10px 12px;
`;

const PeriodRangeText = styled.div`
  border-top: 1px solid #e7ebf2;
  border-bottom: 1px solid #e7ebf2;
  padding: 14px 10px;
  margin-bottom: 14px;
  font-size: 14px;
  color: #374151;
`;

const PerformanceSummaryBar = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  border-bottom: 1px solid #e7ebf2;
  margin-bottom: 18px;
`;

const PerformanceSummaryItem = styled.div`
  padding: 16px 14px;
  border-right: 1px solid #e7ebf2;
  display: flex;
  justify-content: space-between;
  align-items: baseline;

  &:last-child {
    border-right: none;
  }
`;

const PerformanceSummaryLabel = styled.span`
  font-size: 13px;
  color: #4b5563;
`;

const PerformanceSummaryValue = styled.span<{ $positive?: boolean }>`
  font-size: 36px;
  font-weight: 700;
  color: ${props => props.$positive === undefined ? '#1f2937' : props.$positive ? '#d60000' : '#0051c7'};
`;

const PerformanceGraphSection = styled.div`
  margin-top: 10px;
`;

const PerformanceGraphTitle = styled.h3`
  margin: 0 0 12px;
  font-size: 28px;
  color: #1f2937;
  font-weight: 700;
`;

const GraphGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;

  @media (max-width: 1100px) {
    grid-template-columns: 1fr;
  }
`;

const GraphCard = styled.div`
  border: 1px solid #e7ebf2;
  background: #fff;
`;

const GraphCardHeader = styled.div`
  background: #f6f8fb;
  border-bottom: 1px solid #e7ebf2;
  padding: 10px 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  color: #4b5563;
  font-weight: 600;
`;

const GraphPlotArea = styled.div`
  padding: 14px 14px 10px;
`;

const GraphSvg = styled.svg`
  width: 100%;
  height: 210px;
  display: block;
`;

const GraphAxisLabels = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: #6b7280;
  padding: 0 2px 10px;
`;

const RealizedSection = styled.div`
  margin: 14px 0 18px;
  border: 1px solid #e7ebf2;
  background: #fff;
`;

const RealizedHeader = styled.div`
  padding: 10px 12px;
  border-bottom: 1px solid #e7ebf2;
  background: #f8fafc;
  color: #334155;
  font-size: 13px;
  font-weight: 600;
`;

const RealizedSummaryGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  border-bottom: 1px solid #e7ebf2;
`;

const RealizedSummaryItem = styled.div`
  padding: 14px 14px;
  border-right: 1px solid #e7ebf2;
  display: flex;
  justify-content: space-between;
  align-items: baseline;

  &:last-child {
    border-right: none;
  }
`;

const RealizedSummaryLabel = styled.span`
  font-size: 13px;
  color: #4b5563;
`;

const RealizedSummaryValue = styled.span<{ $positive: boolean }>`
  font-size: 18px;
  font-weight: 700;
  color: ${props => props.$positive ? '#d60000' : '#0051c7'};
`;

interface Transaction {
  txId: number;
  txType: string;
  assetType: string;
  amount: number;
  price: number;
  totalValue: number;
  fee: number;
  txDate: string;
  fromAddress?: string;
  toAddress?: string;
  txHash?: string;
  bankName?: string;
  accountNumber?: string;
  status?: string;
}

interface Asset {
  assetId: number;
  assetType: string;
  balance: number;
  lockedBalance: number;
  availableBalance: number;
  averageBuyPrice: number;
}

interface OpenOrder {
  orderId: number;
  orderType: string;
  priceType: string;
  assetType: string;
  price: number;
  amount: number;
  filledAmount: number;
  status: string;
  createdAt: string;
}

interface RealizedByCoinRow {
  assetType: string;
  realizedPnl: number;
  costBasisSold: number;
  proceedsNet: number;
  sellQty: number;
}

type SortKey = 'txDate' | 'txType' | 'assetType' | 'amount' | 'price' | 'totalValue' | 'fee';
type SortOrder = 'asc' | 'desc';
type SubSectionKey = 'holdings' | 'performance' | 'history' | 'openOrders' | 'pendingTransfers';
type PerformancePeriod = 'monthly' | 'yearly';
type PerformanceMetric = 'amountWeighted' | 'timeWeighted' | 'simple';

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

const toNumber = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const sectionTabs: Array<{ key: SubSectionKey; label: string }> = [
  { key: 'holdings', label: '보유자산' },
  { key: 'performance', label: '투자손익' },
  { key: 'history', label: '거래내역' },
  { key: 'openOrders', label: '미체결' },
  { key: 'pendingTransfers', label: '입출금 내역' },
];

const Investments = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeSection, setActiveSection] = useState<SubSectionKey>('holdings');
  const [performancePeriod, setPerformancePeriod] = useState<PerformancePeriod>('monthly');
  const [performanceMetric, setPerformanceMetric] = useState<PerformanceMetric>('amountWeighted');
  const [selectedPerformanceKey, setSelectedPerformanceKey] = useState('');
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
  const [openOrders, setOpenOrders] = useState<OpenOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const loginRedirectUrl = `/login?redirect=${encodeURIComponent(`${location.pathname}${location.search || ''}`)}`;
  const [cancelingOrderId, setCancelingOrderId] = useState<number | null>(null);

  const [assets, setAssets] = useState<Asset[]>([]);

  const normalizeOpenOrders = (openOrderData: any[]): OpenOrder[] => {
    return openOrderData.map((order: any) => ({
      orderId: toNumber(order.orderId),
      orderType: String(order.orderType ?? ''),
      priceType: String(order.priceType ?? ''),
      assetType: String(order.assetType ?? ''),
      price: toNumber(order.price),
      amount: toNumber(order.amount),
      filledAmount: toNumber(order.filledAmount),
      status: String(order.status ?? ''),
      createdAt: String(order.createdAt ?? ''),
    }));
  };

  // 로그인 체크 및 데이터 조회
  useEffect(() => {
    const token = localStorage.getItem('accessToken');

    if (!token) {
      navigate(loginRedirectUrl, { replace: true });
      return;
    }

    const fetchData = async () => {
      try {
        const headers = { Authorization: `Bearer ${token}` };

        const [balanceResponse, summaryResponse, txResponse, openOrderResponse] = await Promise.all([
          axios.get(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'}/api/assets`, { headers }),
          axios.get(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'}/api/assets/summary`, { headers }),
          axios.get(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'}/api/transactions`, { headers }),
          axios.get(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'}/api/orders/open`, { headers }),
        ]);

        // HTML 응답 체크
        if (typeof balanceResponse.data === 'string' && balanceResponse.data.includes('<!DOCTYPE html>')) {
          console.warn('인증 세션 만료됨');
          localStorage.removeItem('accessToken');
          navigate(loginRedirectUrl);
          return;
        }

        console.log('자산 API 응답:', balanceResponse.data);

        const assetsData = Array.isArray(balanceResponse.data) ? balanceResponse.data : [];
        const normalizedAssets: Asset[] = assetsData.map((a: any) => ({
          assetId: toNumber(a.assetId),
          assetType: String(a.assetType ?? ''),
          balance: toNumber(a.balance),
          lockedBalance: toNumber(a.lockedBalance),
          availableBalance: toNumber(a.availableBalance),
          averageBuyPrice: toNumber(a.averageBuyPrice),
        }));
        setAssets(normalizedAssets);

        console.log('투자원금 API 응답:', summaryResponse.data);
        setTotalInvestment(toNumber(summaryResponse.data.totalInvestment));

        // KRW 잔고는 summaryResponse가 더 정확할 수 있음
        const summaryKrw = summaryResponse.data.krwBalance;
        if (summaryKrw !== undefined) {
          setKrwBalance(toNumber(summaryKrw));
        }

        console.log('거래내역 API 응답:', txResponse.data);
        const txData = Array.isArray(txResponse.data) ? txResponse.data : [];
        const normalizedTransactions: Transaction[] = txData.map((tx: any) => ({
          txId: toNumber(tx.txId),
          txType: String(tx.txType ?? ''),
          assetType: String(tx.assetType ?? ''),
          amount: toNumber(tx.amount),
          price: toNumber(tx.price),
          totalValue: toNumber(tx.totalValue),
          fee: toNumber(tx.fee),
          txDate: String(tx.txDate ?? ''),
          fromAddress: tx.fromAddress,
          toAddress: tx.toAddress,
          txHash: tx.txHash,
          bankName: tx.bankName,
          accountNumber: tx.accountNumber,
          status: tx.status,
        }));
        setTransactions(normalizedTransactions);

        const openOrderData = Array.isArray(openOrderResponse.data) ? openOrderResponse.data : [];
        setOpenOrders(normalizeOpenOrders(openOrderData));
      } catch (error: any) {
        console.error('데이터 조회 실패:', error);
        if (error.response && error.response.status === 401) {
          localStorage.removeItem('accessToken');
          navigate(loginRedirectUrl, { replace: true });
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [navigate, loginRedirectUrl]);

  const handleCancelOpenOrder = async (orderId: number) => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      navigate(loginRedirectUrl, { replace: true });
      return;
    }
    if (!window.confirm('해당 지정가 주문을 취소하시겠습니까?')) return;

    setCancelingOrderId(orderId);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      await axios.delete(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'}/api/orders/${orderId}`, { headers });

      const openOrderResponse = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'}/api/orders/open`,
        { headers }
      );
      const openOrderData = Array.isArray(openOrderResponse.data) ? openOrderResponse.data : [];
      setOpenOrders(normalizeOpenOrders(openOrderData));
    } catch (error: any) {
      alert(error?.response?.data?.message || error?.response?.data || '주문 취소에 실패했습니다.');
    } finally {
      setCancelingOrderId(null);
    }
  };

  // 실시간 코인 시세 조회
  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const coinTypes = assets
          .map(a => a.assetType)
          .filter(type => type !== 'KRW');

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

        setCoinPrices(newPrices);
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

  const holdingAssets = useMemo(
    () => assets.filter(asset => asset.assetType !== 'KRW' && asset.balance > 0),
    [assets],
  );

  const totalCoinValue = useMemo(
    () => holdingAssets.reduce((sum, asset) => {
      const info = coinPrices[asset.assetType] || { price: 0, changePrice: 0 };
      return sum + (asset.balance * info.price);
    }, 0),
    [holdingAssets, coinPrices],
  );

  const totalAssets = krwBalance + totalCoinValue;

  const totalCoinBuyAmount = useMemo(
    () => holdingAssets.reduce((sum, asset) => sum + (asset.balance * asset.averageBuyPrice), 0),
    [holdingAssets],
  );

  const totalEvaluationProfit = totalCoinValue - totalCoinBuyAmount;

  const orderableKrw = useMemo(() => {
    const krwAsset = assets.find(asset => asset.assetType === 'KRW');
    return krwAsset ? krwAsset.availableBalance : krwBalance;
  }, [assets, krwBalance]);

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
  const todayProfit = holdingAssets
    .reduce((sum, asset) => {
      const info = coinPrices[asset.assetType] || { price: 0, changePrice: 0 };
      return sum + (asset.balance * info.changePrice);
    }, 0);

  // 총 수익률 (매수금액 기반)
  const profitRate = totalCoinBuyAmount > 0
    ? (totalEvaluationProfit / totalCoinBuyAmount * 100)
    : 0;

  const performancePeriodOptions = useMemo(() => {
    const monthlySet = new Set<string>();
    const yearlySet = new Set<string>();

    transactions.forEach(tx => {
      if (tx.txType !== 'BUY' && tx.txType !== 'SELL') return;
      const date = new Date(tx.txDate);
      if (Number.isNaN(date.getTime())) return;
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      monthlySet.add(`${year}-${month}`);
      yearlySet.add(String(year));
    });

    const monthly = [...monthlySet].sort((a, b) => b.localeCompare(a));
    const yearly = [...yearlySet].sort((a, b) => b.localeCompare(a));
    return { monthly, yearly };
  }, [transactions]);

  useEffect(() => {
    const options = performancePeriod === 'monthly'
      ? performancePeriodOptions.monthly
      : performancePeriodOptions.yearly;
    if (options.length === 0) {
      setSelectedPerformanceKey('');
      return;
    }
    setSelectedPerformanceKey(prev => (prev && options.includes(prev) ? prev : options[0]));
  }, [performancePeriod, performancePeriodOptions]);

  const selectedPeriodRange = useMemo(() => {
    if (!selectedPerformanceKey) return null;

    const now = new Date();
    const isMonthly = performancePeriod === 'monthly';

    if (isMonthly) {
      const [yearText, monthText] = selectedPerformanceKey.split('-');
      const year = Number(yearText);
      const month = Number(monthText);
      if (!Number.isFinite(year) || !Number.isFinite(month)) return null;

      const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
      const isCurrentMonth = now.getFullYear() === year && now.getMonth() === month - 1;
      const end = isCurrentMonth
        ? now
        : new Date(year, month, 0, 23, 59, 59, 999);

      return {
        start,
        end,
        title: `${year}년 ${String(month).padStart(2, '0')}월`,
      };
    }

    const year = Number(selectedPerformanceKey);
    if (!Number.isFinite(year)) return null;
    const start = new Date(year, 0, 1, 0, 0, 0, 0);
    const isCurrentYear = now.getFullYear() === year;
    const end = isCurrentYear
      ? now
      : new Date(year, 11, 31, 23, 59, 59, 999);

    return {
      start,
      end,
      title: `${year}년`,
    };
  }, [performancePeriod, selectedPerformanceKey]);

  const periodTransactions = useMemo(() => {
    if (!selectedPeriodRange) return [];
    return transactions
      .filter(tx => (tx.txType === 'BUY' || tx.txType === 'SELL'))
      .filter(tx => {
        const t = new Date(tx.txDate).getTime();
        if (Number.isNaN(t)) return false;
        return t >= selectedPeriodRange.start.getTime() && t <= selectedPeriodRange.end.getTime();
      })
      .sort((a, b) => new Date(a.txDate).getTime() - new Date(b.txDate).getTime());
  }, [transactions, selectedPeriodRange]);

  const performancePoints = useMemo(() => {
    if (!selectedPeriodRange) return [] as Array<{
      label: string;
      pnl: number;
      amountRate: number;
      twrRate: number;
      cumBuy: number;
    }>;

    const buckets: Array<{ label: string; endAt: number }> = [];
    const start = selectedPeriodRange.start;
    const end = selectedPeriodRange.end;

    if (performancePeriod === 'monthly') {
      const lastDay = end.getDate();
      for (let day = 1; day <= lastDay; day += 1) {
        const bucketEnd = new Date(start.getFullYear(), start.getMonth(), day, 23, 59, 59, 999);
        buckets.push({
          label: `${String(start.getMonth() + 1).padStart(2, '0')}.${String(day).padStart(2, '0')}`,
          endAt: bucketEnd.getTime(),
        });
      }
    } else {
      const lastMonth = end.getMonth() + 1;
      for (let month = 1; month <= lastMonth; month += 1) {
        const bucketEnd = new Date(start.getFullYear(), month, 0, 23, 59, 59, 999);
        buckets.push({
          label: `${String(month).padStart(2, '0')}월`,
          endAt: bucketEnd.getTime(),
        });
      }
    }

    let index = 0;
    let cumBuy = 0;
    let realizedPnl = 0;
    let twrAccum = 0;
    let prevPnl = 0;
    const positions = new Map<string, { qty: number; cost: number; lastPrice: number }>();
    const points: Array<{ label: string; pnl: number; amountRate: number; twrRate: number; cumBuy: number }> = [];

    buckets.forEach(bucket => {
      const prevCumBuy = cumBuy;

      while (index < periodTransactions.length) {
        const tx = periodTransactions[index];
        const txTime = new Date(tx.txDate).getTime();
        if (txTime > bucket.endAt) break;

        const symbol = tx.assetType;
        const amountNum = Math.max(toNumber(tx.amount), 0);
        const gross = Math.max(toNumber(tx.totalValue), 0);
        const feeNum = Math.max(toNumber(tx.fee), 0);
        const tradePrice = Math.max(toNumber(tx.price), 0);
        const state = positions.get(symbol) || { qty: 0, cost: 0, lastPrice: 0 };
        if (tradePrice > 0) {
          state.lastPrice = tradePrice;
        }

        if (tx.txType === 'BUY') {
          const buyCost = gross + feeNum;
          state.qty += amountNum;
          state.cost += buyCost;
          cumBuy += buyCost;
        } else {
          const proceedsNet = Math.max(gross - feeNum, 0);
          const matchedQty = state.qty > 0 ? Math.min(state.qty, amountNum) : 0;
          const avgCost = state.qty > 0 ? state.cost / state.qty : 0;
          const costBasis = avgCost * matchedQty;
          realizedPnl += (proceedsNet - costBasis);

          if (matchedQty > 0) {
            state.qty -= matchedQty;
            state.cost -= costBasis;
            if (state.qty <= 0.00000001 || state.cost <= 0.00000001) {
              state.qty = 0;
              state.cost = 0;
            }
          }
        }
        positions.set(symbol, state);
        index += 1;
      }

      const unrealizedPnl = [...positions.entries()].reduce((sum, [symbol, state]) => {
        if (state.qty <= 0) return sum;
        const marketPrice = coinPrices[symbol]?.price || state.lastPrice || 0;
        return sum + ((state.qty * marketPrice) - state.cost);
      }, 0);

      const pnl = realizedPnl + unrealizedPnl;
      const deltaPnl = pnl - prevPnl;
      const twrBase = prevCumBuy > 0 ? prevCumBuy : cumBuy;
      if (twrBase > 0) {
        twrAccum += (deltaPnl / twrBase);
      }
      prevPnl = pnl;

      const amountRate = cumBuy > 0 ? (pnl / cumBuy) * 100 : 0;
      const twrRate = twrAccum * 100;
      points.push({ label: bucket.label, pnl, amountRate, twrRate, cumBuy });
    });

    return points;
  }, [coinPrices, performancePeriod, periodTransactions, selectedPeriodRange]);

  const selectedRateSeries = useMemo(
    () => performancePoints.map(point => (performanceMetric === 'timeWeighted' ? point.twrRate : point.amountRate)),
    [performanceMetric, performancePoints],
  );

  const pnlSeries = useMemo(
    () => performancePoints.map(point => point.pnl),
    [performancePoints],
  );

  const performanceSummary = useMemo(() => {
    if (performancePoints.length === 0) {
      return { profit: 0, rate: 0, avgInvestment: 0 };
    }
    const lastPoint = performancePoints[performancePoints.length - 1];
    const rate = performanceMetric === 'timeWeighted' ? lastPoint.twrRate : lastPoint.amountRate;
    const avgInvestment = performancePoints.reduce((sum, point) => sum + point.cumBuy, 0) / performancePoints.length;
    return {
      profit: lastPoint.pnl,
      rate,
      avgInvestment,
    };
  }, [performanceMetric, performancePoints]);

  const realizedPnl = useMemo(() => {
    const sorted = transactions
      .filter(tx => tx.txType === 'BUY' || tx.txType === 'SELL')
      .filter(tx => !Number.isNaN(new Date(tx.txDate).getTime()))
      .sort((a, b) => {
        const tDiff = new Date(a.txDate).getTime() - new Date(b.txDate).getTime();
        if (tDiff !== 0) return tDiff;
        return a.txId - b.txId;
      });

    const inventory = new Map<string, { qty: number; cost: number }>();
    const byCoinMap = new Map<string, RealizedByCoinRow>();
    let periodTotal = 0;
    let allTimeTotal = 0;

    sorted.forEach(tx => {
      const symbol = tx.assetType;
      const state = inventory.get(symbol) || { qty: 0, cost: 0 };

      if (tx.txType === 'BUY') {
        const buyQty = Math.max(toNumber(tx.amount), 0);
        const buyCost = Math.max(toNumber(tx.totalValue) + toNumber(tx.fee), 0);
        state.qty += buyQty;
        state.cost += buyCost;
        inventory.set(symbol, state);
        return;
      }

      const sellQty = Math.max(toNumber(tx.amount), 0);
      const proceedsNet = Math.max(toNumber(tx.totalValue) - toNumber(tx.fee), 0);
      const avgCost = state.qty > 0 ? state.cost / state.qty : 0;
      const matchedQty = state.qty > 0 ? Math.min(state.qty, sellQty) : 0;
      const costBasisSold = avgCost * matchedQty;
      const realized = proceedsNet - costBasisSold;

      allTimeTotal += realized;

      if (matchedQty > 0) {
        state.qty -= matchedQty;
        state.cost -= costBasisSold;
        if (state.qty <= 0) {
          state.qty = 0;
          state.cost = 0;
        }
      }
      inventory.set(symbol, state);

      if (!selectedPeriodRange) return;
      const txTime = new Date(tx.txDate).getTime();
      if (txTime < selectedPeriodRange.start.getTime() || txTime > selectedPeriodRange.end.getTime()) return;

      periodTotal += realized;

      const current = byCoinMap.get(symbol) || {
        assetType: symbol,
        realizedPnl: 0,
        costBasisSold: 0,
        proceedsNet: 0,
        sellQty: 0,
      };
      current.realizedPnl += realized;
      current.costBasisSold += costBasisSold;
      current.proceedsNet += proceedsNet;
      current.sellQty += sellQty;
      byCoinMap.set(symbol, current);
    });

    const byCoin = [...byCoinMap.values()]
      .sort((a, b) => Math.abs(b.realizedPnl) - Math.abs(a.realizedPnl));

    return {
      periodTotal,
      allTimeTotal,
      byCoin,
    };
  }, [transactions, selectedPeriodRange]);

  const transferRequests = useMemo(
    () => transactions
      .filter(tx => tx.txType === 'DEPOSIT' || tx.txType === 'WITHDRAW')
      .sort((a, b) => new Date(b.txDate).getTime() - new Date(a.txDate).getTime()),
    [transactions],
  );

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

  const formatDetailKrw = (value: number) => {
    return toNumber(value).toLocaleString('ko-KR', { maximumFractionDigits: 4 });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatPeriodLabel = (key: string) => {
    if (performancePeriod === 'yearly') return `${key}년`;
    const [year, month] = key.split('-');
    return `${year}년 ${Number(month)}월`;
  };

  const formatCalendarDate = (date: Date) => (
    `${date.getFullYear()}년 ${String(date.getMonth() + 1).padStart(2, '0')}월 ${String(date.getDate()).padStart(2, '0')}일`
  );

  const performanceRangeText = selectedPeriodRange
    ? `${formatCalendarDate(selectedPeriodRange.start)} ~ ${formatCalendarDate(selectedPeriodRange.end)}의 투자손익`
    : '기간을 선택해 주세요.';

  const buildLinePath = (values: number[]) => {
    if (values.length === 0) return '';
    const width = 100;
    const height = 48;
    const padX = 4;
    const padY = 4;
    let min = Math.min(...values);
    let max = Math.max(...values);

    if (min === max) {
      min -= 1;
      max += 1;
    }

    return values.map((value, index) => {
      const x = values.length === 1
        ? width / 2
        : padX + (index * (width - (padX * 2))) / (values.length - 1);
      const y = height - padY - ((value - min) / (max - min)) * (height - (padY * 2));
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`;
    }).join(' ');
  };

  const buildZeroLineY = (values: number[]) => {
    const height = 48;
    const padY = 4;
    if (values.length === 0) return height / 2;
    let min = Math.min(...values);
    let max = Math.max(...values);
    if (min === max) {
      min -= 1;
      max += 1;
    }
    const ratio = (0 - min) / (max - min);
    const clamped = Math.max(0, Math.min(1, ratio));
    return height - padY - clamped * (height - (padY * 2));
  };

  const ratePath = buildLinePath(selectedRateSeries);
  const pnlPath = buildLinePath(pnlSeries);
  const rateZeroY = buildZeroLineY(selectedRateSeries);
  const pnlZeroY = buildZeroLineY(pnlSeries);
  const graphStartLabel = performancePoints[0]?.label ?? '-';
  const graphEndLabel = performancePoints[performancePoints.length - 1]?.label ?? '-';

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
          <StatCard $type={todayProfit > 0 ? 'positive' : todayProfit < 0 ? 'negative' : 'positive'}>
            <StatLabel>오늘의 수익</StatLabel>
            <StatValue>{todayProfit > 0 ? '+' : todayProfit < 0 ? '-' : '+'}≈ {Math.abs(Math.round(todayProfit)).toLocaleString()} KRW</StatValue>
            <StatChange>{todayProfit >= 0 ? '수익' : '손실'}</StatChange>
          </StatCard>
          <StatCard>
            <StatLabel>오늘의 거래금액</StatLabel>
            <StatValue>≈ {Math.round(todayTradeAmount).toLocaleString()} KRW</StatValue>
            <StatChange>{todayTrades.length}건 거래</StatChange>
          </StatCard>
          <StatCard>
            <StatLabel>총 보유 자산</StatLabel>
            <StatValue>≈ {Math.round(totalAssets).toLocaleString()} KRW</StatValue>
            <StatChange>현금 + 코인</StatChange>
          </StatCard>
          <StatCard>
            <StatLabel>총 수익률</StatLabel>
            <StatValue>{profitRate >= 0 ? '+' : ''}{profitRate.toFixed(2)}%</StatValue>
            <StatChange>누적 수익</StatChange>
          </StatCard>
        </StatsGrid>

        <SubHeader>
          {sectionTabs.map(tab => (
            <SubHeaderButton
              key={tab.key}
              type='button'
              $active={activeSection === tab.key}
              onClick={() => setActiveSection(tab.key)}
            >
              {tab.label}
            </SubHeaderButton>
          ))}
        </SubHeader>

        {activeSection === 'holdings' && (
          <Card>
            <CardHeader>
              <CardTitle>보유자산</CardTitle>
              <CardDescription>보유 KRW, 총 보유자산, 총매수, 총평가손익, 주문가능 금액을 확인합니다.</CardDescription>
            </CardHeader>

            <SummaryGrid>
              <SummaryItem>
                <SummaryLabel>보유 KRW</SummaryLabel>
                <SummaryValue>{Math.round(krwBalance).toLocaleString()} KRW</SummaryValue>
              </SummaryItem>
              <SummaryItem>
                <SummaryLabel>총 보유자산</SummaryLabel>
                <SummaryValue>{Math.round(totalAssets).toLocaleString()} KRW</SummaryValue>
              </SummaryItem>
              <SummaryItem>
                <SummaryLabel>총매수</SummaryLabel>
                <SummaryValue>{Math.round(totalCoinBuyAmount).toLocaleString()} KRW</SummaryValue>
              </SummaryItem>
              <SummaryItem>
                <SummaryLabel>총평가손익</SummaryLabel>
                <SummaryValue $tone={totalEvaluationProfit >= 0 ? 'up' : 'down'}>
                  {totalEvaluationProfit >= 0 ? '+' : ''}{Math.round(totalEvaluationProfit).toLocaleString()} KRW
                </SummaryValue>
              </SummaryItem>
              <SummaryItem>
                <SummaryLabel>주문가능 금액</SummaryLabel>
                <SummaryValue>{Math.round(orderableKrw).toLocaleString()} KRW</SummaryValue>
              </SummaryItem>
            </SummaryGrid>

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
                {holdingAssets.map(asset => {
                  const symbol = asset.assetType;
                  const market = symbol.startsWith('KRW-') ? symbol : `KRW-${symbol}`;
                  const balance = asset.balance;
                  const avgPrice = asset.averageBuyPrice || 0;
                  const coinInfo = coinPrices[symbol] || { price: 0, changePrice: 0 };
                  const currentPrice = coinInfo.price;
                  const valuation = balance * currentPrice;
                  const totalInvest = balance * avgPrice;
                  const profit = valuation - totalInvest;
                  const rowProfitRate = totalInvest > 0 ? (profit / totalInvest * 100) : 0;

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
                      <Td>{balance.toFixed(5)}</Td>
                      <Td>{formatAverageBuyPrice(avgPrice)}</Td>
                      <Td>{formatDetailKrw(currentPrice)} KRW</Td>
                      <Td>{formatDetailKrw(valuation)} KRW</Td>
                      <Td style={{ color: avgPrice > 0 ? (profit >= 0 ? '#d60000' : '#0051c7') : '#999' }}>
                        {avgPrice > 0 ? `${profit >= 0 ? '+' : ''}${formatDetailKrw(profit)} KRW` : '-'}
                      </Td>
                      <Td style={{ color: avgPrice > 0 ? (rowProfitRate >= 0 ? '#d60000' : '#0051c7') : '#999' }}>
                        {avgPrice > 0 ? `${rowProfitRate >= 0 ? '+' : ''}${rowProfitRate.toFixed(2)}%` : '-'}
                      </Td>
                    </Tr>
                  );
                })}
                {holdingAssets.length === 0 && (
                  <Tr>
                    <Td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                      보유 중인 코인이 없습니다.
                    </Td>
                  </Tr>
                )}
              </Tbody>
            </Table>
          </Card>
        )}

        {activeSection === 'performance' && (
          <Card>
            <CardHeader>
              <CardTitle>투자손익</CardTitle>
              <CardDescription>투자손익 탭에서 제공하는 정보는 참고용 자료입니다.</CardDescription>
            </CardHeader>

            <PerformanceNotice>
              <strong style={{ color: '#0b3e91', marginRight: 10 }}>안내</strong>
              투자손익에서 제공하는 정보는 참고용 자료입니다.
            </PerformanceNotice>

            <PerformanceControls>
              <MetricTabs>
                <MetricTabButton
                  type='button'
                  $active={performanceMetric === 'amountWeighted'}
                  onClick={() => setPerformanceMetric('amountWeighted')}
                >
                  금액가중수익률
                </MetricTabButton>
                <MetricTabButton
                  type='button'
                  $active={performanceMetric === 'timeWeighted'}
                  onClick={() => setPerformanceMetric('timeWeighted')}
                >
                  시간가중수익률
                </MetricTabButton>
                <MetricTabButton
                  type='button'
                  $active={performanceMetric === 'simple'}
                  onClick={() => setPerformanceMetric('simple')}
                >
                  단순수익률
                </MetricTabButton>
              </MetricTabs>

              <PeriodControlGroup>
                <PeriodModeTabs>
                  <PeriodModeButton
                    type='button'
                    $active={performancePeriod === 'monthly'}
                    onClick={() => setPerformancePeriod('monthly')}
                  >
                    월별
                  </PeriodModeButton>
                  <PeriodModeButton
                    type='button'
                    $active={performancePeriod === 'yearly'}
                    onClick={() => setPerformancePeriod('yearly')}
                  >
                    연도별
                  </PeriodModeButton>
                </PeriodModeTabs>
                <PeriodSelect
                  value={selectedPerformanceKey}
                  onChange={e => setSelectedPerformanceKey(e.target.value)}
                >
                  {(performancePeriod === 'monthly' ? performancePeriodOptions.monthly : performancePeriodOptions.yearly)
                    .map(key => (
                      <option key={key} value={key}>{formatPeriodLabel(key)}</option>
                    ))}
                </PeriodSelect>
              </PeriodControlGroup>
            </PerformanceControls>

            <PeriodRangeText>{performanceRangeText}</PeriodRangeText>

            <PerformanceSummaryBar>
              <PerformanceSummaryItem>
                <PerformanceSummaryLabel>기간 누적 손익</PerformanceSummaryLabel>
                <PerformanceSummaryValue $positive={performanceSummary.profit >= 0}>
                  {performanceSummary.profit >= 0 ? '+' : ''}{Math.round(performanceSummary.profit).toLocaleString()} KRW
                </PerformanceSummaryValue>
              </PerformanceSummaryItem>
              <PerformanceSummaryItem>
                <PerformanceSummaryLabel>기간 누적 수익률</PerformanceSummaryLabel>
                <PerformanceSummaryValue $positive={performanceSummary.rate >= 0}>
                  {performanceSummary.rate >= 0 ? '+' : ''}{performanceSummary.rate.toFixed(2)}%
                </PerformanceSummaryValue>
              </PerformanceSummaryItem>
              <PerformanceSummaryItem>
                <PerformanceSummaryLabel>기간 평균 투자금액</PerformanceSummaryLabel>
                <PerformanceSummaryValue>
                  {Math.round(performanceSummary.avgInvestment).toLocaleString()} KRW
                </PerformanceSummaryValue>
              </PerformanceSummaryItem>
            </PerformanceSummaryBar>

            <RealizedSection>
              <RealizedHeader>실현손익 (매도 체결 기준)</RealizedHeader>
              <RealizedSummaryGrid>
                <RealizedSummaryItem>
                  <RealizedSummaryLabel>기간 실현손익</RealizedSummaryLabel>
                  <RealizedSummaryValue $positive={realizedPnl.periodTotal >= 0}>
                    {realizedPnl.periodTotal >= 0 ? '+' : ''}
                    {Math.round(realizedPnl.periodTotal).toLocaleString()} KRW
                  </RealizedSummaryValue>
                </RealizedSummaryItem>
                <RealizedSummaryItem>
                  <RealizedSummaryLabel>누적 실현손익</RealizedSummaryLabel>
                  <RealizedSummaryValue $positive={realizedPnl.allTimeTotal >= 0}>
                    {realizedPnl.allTimeTotal >= 0 ? '+' : ''}
                    {Math.round(realizedPnl.allTimeTotal).toLocaleString()} KRW
                  </RealizedSummaryValue>
                </RealizedSummaryItem>
              </RealizedSummaryGrid>

              {realizedPnl.byCoin.length > 0 ? (
                <Table>
                  <Thead>
                    <Tr>
                      <Th>코인</Th>
                      <Th>실현손익</Th>
                      <Th>매도수량</Th>
                      <Th>실현수익률</Th>
                      <Th>순매도금액</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {realizedPnl.byCoin.map(row => {
                      const realizedRate = row.costBasisSold > 0
                        ? (row.realizedPnl / row.costBasisSold) * 100
                        : 0;
                      return (
                        <Tr key={row.assetType}>
                          <Td><strong>{row.assetType}</strong></Td>
                          <Td style={{ color: row.realizedPnl >= 0 ? '#d60000' : '#0051c7' }}>
                            {row.realizedPnl >= 0 ? '+' : ''}{formatDetailKrw(row.realizedPnl)} KRW
                          </Td>
                          <Td>{row.sellQty.toFixed(5)}</Td>
                          <Td style={{ color: realizedRate >= 0 ? '#d60000' : '#0051c7' }}>
                            {realizedRate >= 0 ? '+' : ''}{realizedRate.toFixed(2)}%
                          </Td>
                          <Td>{formatDetailKrw(row.proceedsNet)} KRW</Td>
                        </Tr>
                      );
                    })}
                  </Tbody>
                </Table>
              ) : (
                <EmptyState style={{ padding: '26px 20px' }}>선택 기간의 코인별 실현손익 데이터가 없습니다.</EmptyState>
              )}
            </RealizedSection>

            <PerformanceGraphSection>
              <PerformanceGraphTitle>투자손익 그래프</PerformanceGraphTitle>
              <GraphGrid>
                <GraphCard>
                  <GraphCardHeader>
                    <span>누적 수익률</span>
                    <span>단위: %</span>
                  </GraphCardHeader>
                  <GraphPlotArea>
                    <GraphSvg viewBox='0 0 100 48' preserveAspectRatio='none'>
                      <line x1='4' y1={rateZeroY} x2='96' y2={rateZeroY} stroke='#d1d5db' strokeDasharray='2 2' />
                      {ratePath && <path d={ratePath} stroke='#d60000' strokeWidth='1.5' fill='none' />}
                    </GraphSvg>
                    <GraphAxisLabels>
                      <span>{graphStartLabel}</span>
                      <span>{graphEndLabel}</span>
                    </GraphAxisLabels>
                  </GraphPlotArea>
                </GraphCard>

                <GraphCard>
                  <GraphCardHeader>
                    <span>손익</span>
                    <span>단위: KRW</span>
                  </GraphCardHeader>
                  <GraphPlotArea>
                    <GraphSvg viewBox='0 0 100 48' preserveAspectRatio='none'>
                      <line x1='4' y1={pnlZeroY} x2='96' y2={pnlZeroY} stroke='#d1d5db' strokeDasharray='2 2' />
                      {pnlPath && <path d={pnlPath} stroke='#0b3e91' strokeWidth='1.5' fill='none' />}
                    </GraphSvg>
                    <GraphAxisLabels>
                      <span>{graphStartLabel}</span>
                      <span>{graphEndLabel}</span>
                    </GraphAxisLabels>
                  </GraphPlotArea>
                </GraphCard>
              </GraphGrid>
            </PerformanceGraphSection>
          </Card>
        )}

        {activeSection === 'history' && (
          <Card>
            <CardHeader>
              <CardTitle>거래내역</CardTitle>
              <CardDescription>헤더 클릭으로 정렬할 수 있습니다.</CardDescription>
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
                          {tx.txType === 'BUY' ? <><TrendingUp size={14} /> 매수</> :
                            tx.txType === 'SELL' ? <><TrendingDown size={14} /> 매도</> :
                              tx.txType === 'DEPOSIT' ? <><Download size={14} /> 입금</> : <><Upload size={14} /> 출금</>}
                        </Badge>
                      </Td>
                      <Td><strong>{tx.assetType}</strong></Td>
                      <Td>{tx.amount.toFixed(5)}</Td>
                      <Td>
                        {(tx.txType === 'DEPOSIT' || tx.txType === 'WITHDRAW') ? '-' : `${formatDetailKrw(tx.price)} KRW`}
                      </Td>
                      <Td>{formatDetailKrw(tx.totalValue)} KRW</Td>
                      <Td>
                        {tx.txType === 'DEPOSIT' || tx.txType === 'WITHDRAW'
                          ? (tx.assetType === 'KRW'
                            ? `${tx.bankName || '가상은행'} ${tx.accountNumber || ''}`
                            : (tx.txType === 'WITHDRAW' ? `To: ${tx.toAddress || '외부'}` : `From: ${tx.fromAddress || '외부'}`)
                          )
                          : (tx.fee > 0 ? `수수료 ${formatDetailKrw(tx.fee)} KRW` : '-')}
                      </Td>
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
        )}

        {activeSection === 'openOrders' && (
          <Card>
            <CardHeader>
              <CardTitle>미체결</CardTitle>
              <CardDescription>지정가 매수/매도 주문의 가격, 수량, 미체결량을 확인합니다.</CardDescription>
            </CardHeader>

            {openOrders.length > 0 ? (
              <Table>
                <Thead>
                  <Tr>
                    <Th>주문일시</Th>
                    <Th>거래종류</Th>
                    <Th>코인</Th>
                    <Th>주문가격</Th>
                    <Th>주문수량</Th>
                    <Th>체결수량</Th>
                    <Th>미체결량</Th>
                    <Th>상태</Th>
                    <Th>취소</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {openOrders.map(order => {
                    const unfilled = Math.max(order.amount - order.filledAmount, 0);
                    return (
                      <Tr key={order.orderId}>
                        <Td>{formatDate(order.createdAt)}</Td>
                        <Td>
                          <Badge type={order.orderType}>
                            {order.orderType === 'BUY' ? <><TrendingUp size={14} /> 지정가 매수</> : <><TrendingDown size={14} /> 지정가 매도</>}
                          </Badge>
                        </Td>
                        <Td><strong>{order.assetType}</strong></Td>
                        <Td>{formatDetailKrw(order.price)} KRW</Td>
                        <Td>{order.amount.toFixed(8).replace(/\.?0+$/, '')}</Td>
                        <Td>{order.filledAmount.toFixed(8).replace(/\.?0+$/, '')}</Td>
                        <Td>{unfilled.toFixed(8).replace(/\.?0+$/, '')}</Td>
                        <Td><StatusPill $color='blue'>{order.status || 'PENDING'}</StatusPill></Td>
                        <Td>
                          <PageButton
                            type='button'
                            onClick={() => handleCancelOpenOrder(order.orderId)}
                            disabled={cancelingOrderId === order.orderId}
                          >
                            취소
                          </PageButton>
                        </Td>
                      </Tr>
                    );
                  })}
                </Tbody>
              </Table>
            ) : (
              <EmptyState>현재 미체결 주문이 없습니다.</EmptyState>
            )}
          </Card>
        )}

        {activeSection === 'pendingTransfers' && (
          <Card>
            <CardHeader>
              <CardTitle>입출금 내역</CardTitle>
              <CardDescription>가상계좌 이체 및 다른 지갑 간의 코인 입출금 내역을 모두 조회할 수 있습니다.</CardDescription>
            </CardHeader>

            {transferRequests.length > 0 ? (
              <Table>
                <Thead>
                  <Tr>
                    <Th>요청일시</Th>
                    <Th>구분</Th>
                    <Th>자산</Th>
                    <Th>요청수량</Th>
                    <Th>상태</Th>
                    <Th>비고</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {transferRequests.map(tx => (
                    <Tr key={tx.txId}>
                      <Td>{formatDate(tx.txDate)}</Td>
                      <Td>
                        <Badge type={tx.txType}>{tx.txType === 'DEPOSIT' ? '입금' : '출금'}</Badge>
                      </Td>
                      <Td><strong>{tx.assetType}</strong></Td>
                      <Td>{tx.amount.toFixed(5)}</Td>
                      <Td><StatusPill $color='green'>{tx.status === 'PENDING' ? '대기중' : '완료'}</StatusPill></Td>
                      <Td>{tx.assetType === 'KRW' ? tx.bankName : (tx.txType === 'WITHDRAW' ? tx.toAddress : tx.fromAddress) || '-'}</Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            ) : (
              <EmptyState>입출금 요청 내역이 없습니다.</EmptyState>
            )}
          </Card>
        )}
      </Main>
      <Footer />
    </Container>
  );
};

export default Investments;
