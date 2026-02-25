import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import styled from 'styled-components';
import Header from '../components/Header';
import { fetchKRWMarkets, fetchTickers } from '../services/upbitApi';
import type { UpbitMarket } from '../services/upbitApi';
import { useUpbitTicker, useUpbitOrderbook, useUpbitTrades } from '../hooks/useUpbitWebSocket';
import CoinListSidebar from './exchange/CoinListSidebar';
import PriceChart from './exchange/PriceChart';
import Orderbook from './exchange/Orderbook';
import TradeForm from './exchange/TradeForm';
import RecentTrades from './exchange/RecentTrades';

import axios from 'axios';

const ExchangeContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  min-height: 700px;
  background: #f5f6f7;
  overflow-y: auto;
  overflow-x: hidden;
`;

const ExchangeBody = styled.div`
  display: grid;
  grid-template-columns: 260px 1fr 280px;
  grid-template-rows: 1fr 380px;

  flex: 1;
  gap: 16px;
  padding: 16px;
  background: transparent;
  min-height: 0;


  @media (max-width: 1200px) {
    grid-template-columns: 1fr 280px;
  }

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
`;

const SidebarPanel = styled.div`
  grid-column: 1 / 2;
  grid-row: 1 / 3;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 8px 30px rgba(0,0,0,0.04);
  overflow: hidden;
  display: flex;
  flex-direction: column;

  @media (max-width: 1200px) {
    display: none;
  }
`;

const ChartPanel = styled.div`
  grid-column: 2 / 3;
  grid-row: 1 / 2;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 8px 30px rgba(0,0,0,0.04);
  min-height: 0;
  overflow: hidden;

  @media (max-width: 1200px) {
    grid-column: 1 / 2;
  }
`;

const OrderbookPanel = styled.div`
  grid-column: 3 / 4;
  grid-row: 1 / 2;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 8px 30px rgba(0,0,0,0.04);
  overflow: hidden;

  @media (max-width: 1200px) {
    grid-column: 2 / 3;
  }
  @media (max-width: 900px) {
    display: none;
  }
`;

const RecentTradesPanel = styled.div`
  grid-column: 3 / 4;
  grid-row: 2 / 3;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 8px 30px rgba(0,0,0,0.04);
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;

  @media (max-width: 1200px) {
    grid-column: 2 / 3;
  }
  @media (max-width: 900px) {
    display: none;
  }
`;

const MarketInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 10px 16px;
  background: #fff;
  border-bottom: 1px solid #dfe7f6;
  min-width: max-content;
`;

const MarketName = styled.div`
  font-size: 18px;
  font-weight: 700;
  color: #333;
  span { font-size: 12px; color: #999; margin-left: 6px; }
`;

const CurrentPrice = styled.div<{ $change: string }>`
  font-size: 22px;
  font-weight: 700;
  color: ${(p: { $change: string }) => p.$change === 'RISE' ? '#d60000' : p.$change === 'FALL' ? '#0051c7' : '#333'};
`;

const ChangeRate = styled.div<{ $change: string }>`
  font-size: 13px;
  font-weight: 600;
  color: ${(p: { $change: string }) => p.$change === 'RISE' ? '#d60000' : p.$change === 'FALL' ? '#0051c7' : '#999'};
`;

const InfoItem = styled.div`
  font-size: 11px;
  color: #999;
  span { display: block; color: #333; font-size: 13px; font-weight: 600; }
`;

function formatPrice(n: number): string {
  if (n >= 100) return n.toLocaleString('ko-KR', { maximumFractionDigits: 0 });
  if (n >= 1) return n.toLocaleString('ko-KR', { maximumFractionDigits: 2 });
  return n.toLocaleString('ko-KR', { maximumFractionDigits: 4 });
}

function formatVolume(n: number): string {
  if (n >= 1_000_000_000_000) return (n / 1_000_000_000_000).toFixed(1) + '조';
  if (n >= 100_000_000) return (n / 100_000_000).toFixed(0) + '억';
  return n.toLocaleString('ko-KR', { maximumFractionDigits: 0 });
}

// ... (기존 import 유지)

const TradePanelContainer = styled.div`
  grid-column: 2 / 3;
  grid-row: 2 / 3;
  background: white;
  border-radius: 12px;
  box-shadow: 0 8px 30px rgba(0,0,0,0.04);
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;

  @media (max-width: 1200px) {
    grid-column: 1 / 2;
  }
`;

const TabHeader = styled.div`
  display: flex;
  border-bottom: 1px solid #dfe7f6;
  background: #f8f9fa;
`;

const TabButton = styled.button<{ $active: boolean }>`
  flex: 1;
  padding: 12px;
  border: none;
  background: ${(props: { $active: boolean }) => props.$active ? '#fff' : 'transparent'};
  font-weight: 600;
  color: ${(props: { $active: boolean }) => props.$active ? '#093687' : '#666'};
  border-bottom: ${(props: { $active: boolean }) => props.$active ? '2px solid #093687' : 'none'};
  cursor: pointer;
  font-size: 14px;

  &:hover {
    color: #093687;
  }
`;

const TabContent = styled.div`
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
`;

// 내 거래내역 컴포넌트 (Exchange 내부용)
const MyHistory = ({ market }: { market: string }) => {
  const [data, setData] = useState<any[]>([]);
  const [openOrders, setOpenOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [cancellingOrderId, setCancellingOrderId] = useState<number | null>(null);

  const assetType = market.replace('KRW-', '');

  useEffect(() => {
    const fetchHistory = async () => {
      const token = localStorage.getItem('accessToken');
      if (!token) return;

      setLoading(true);
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const [txRes, openRes] = await Promise.all([
          axios.get(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'}/api/transactions?assetType=${assetType}`, {
            headers,
          }),
          axios.get(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'}/api/orders/open`, {
            headers,
          }),
        ]);

        setData(txRes.data || []);
        const allOpen = Array.isArray(openRes.data) ? openRes.data : [];
        setOpenOrders(allOpen.filter((o: any) => o.assetType === assetType));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [assetType, market]);

  const handleCancelOrder = async (orderId: number) => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      alert('로그인이 필요합니다.');
      return;
    }

    if (!window.confirm('해당 지정가 주문을 취소하시겠습니까?')) return;

    setCancellingOrderId(orderId);
    try {
      await axios.delete(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'}/api/orders/${orderId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setOpenOrders(prev => prev.filter((o: any) => o.orderId !== orderId));
      alert('주문이 취소되었습니다.');
    } catch (err: any) {
      alert(err?.response?.data?.message || err?.response?.data || '주문 취소에 실패했습니다.');
    } finally {
      setCancellingOrderId(null);
    }
  };

  if (loading) return <div style={{ padding: '20px', textAlign: 'center' }}>로딩 중...</div>;
  if (data.length === 0 && openOrders.length === 0) {
    return <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>거래 내역과 미체결 주문이 없습니다.</div>;
  }

  return (
    <div style={{ fontSize: '12px' }}>
      <div style={{ fontWeight: 700, padding: '10px 8px', color: '#1a2e57' }}>미체결 지정가 주문</div>
      {openOrders.length === 0 ? (
        <div style={{ padding: '0 8px 12px', color: '#999' }}>현재 미체결 주문이 없습니다.</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '10px' }}>
          <thead>
            <tr style={{ background: '#f8f9fa', color: '#666', borderBottom: '1px solid #eee' }}>
              <th style={{ padding: '8px', textAlign: 'left' }}>주문시간</th>
              <th style={{ padding: '8px', textAlign: 'center' }}>구분</th>
              <th style={{ padding: '8px', textAlign: 'right' }}>주문가</th>
              <th style={{ padding: '8px', textAlign: 'right' }}>미체결</th>
              <th style={{ padding: '8px', textAlign: 'center' }}>관리</th>
            </tr>
          </thead>
          <tbody>
            {openOrders.map((order: any) => {
              const remaining = Math.max(Number(order.amount || 0) - Number(order.filledAmount || 0), 0);
              return (
                <tr key={order.orderId} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ padding: '8px', color: '#666' }}>
                    {new Date(order.createdAt).toLocaleDateString()}<br />
                    {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td style={{ padding: '8px', textAlign: 'center', fontWeight: 700, color: order.orderType === 'BUY' ? '#d60000' : '#0051c7' }}>
                    {order.orderType === 'BUY' ? '매수' : '매도'}
                  </td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>{Math.round(Number(order.price || 0)).toLocaleString()}</td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>{remaining.toFixed(8).replace(/\.?0+$/, '')}</td>
                  <td style={{ padding: '8px', textAlign: 'center' }}>
                    <button
                      type="button"
                      onClick={() => handleCancelOrder(Number(order.orderId))}
                      disabled={cancellingOrderId === Number(order.orderId)}
                      style={{
                        border: '1px solid #d9dee8',
                        background: '#fff',
                        color: '#444',
                        borderRadius: '6px',
                        padding: '4px 8px',
                        cursor: cancellingOrderId === Number(order.orderId) ? 'not-allowed' : 'pointer',
                        opacity: cancellingOrderId === Number(order.orderId) ? 0.6 : 1
                      }}
                    >
                      취소
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <div style={{ fontWeight: 700, padding: '10px 8px', color: '#1a2e57' }}>체결 거래 내역</div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#f8f9fa', color: '#666', borderBottom: '1px solid #eee' }}>
            <th style={{ padding: '8px', textAlign: 'left' }}>시간</th>
            <th style={{ padding: '8px', textAlign: 'center' }}>종류</th>
            <th style={{ padding: '8px', textAlign: 'right' }}>가격</th>
            <th style={{ padding: '8px', textAlign: 'right' }}>수량</th>
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={4} style={{ padding: '14px', textAlign: 'center', color: '#999' }}>체결 내역이 없습니다.</td>
            </tr>
          ) : (
            data.map((tx: any) => (
              <tr key={tx.txId} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={{ padding: '8px', color: '#666' }}>
                  {new Date(tx.txDate).toLocaleDateString()}<br />
                  {new Date(tx.txDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </td>
                <td style={{ padding: '8px', textAlign: 'center' }}>
                  <span style={{
                    color: tx.txType === 'BUY' ? '#d60000' : tx.txType === 'SELL' ? '#0051c7' : '#333',
                    fontWeight: 'bold'
                  }}>
                    {tx.txType === 'BUY' ? '매수' : tx.txType === 'SELL' ? '매도' : tx.txType === 'DEPOSIT' ? '입금' : '출금'}
                  </span>
                </td>
                <td style={{ padding: '8px', textAlign: 'right' }}>{(tx.txType === 'DEPOSIT' || tx.txType === 'WITHDRAW') ? '-' : `${Math.round(tx.price).toLocaleString()}`}</td>
                <td style={{ padding: '8px', textAlign: 'right' }}>{Number(tx.amount).toFixed(8).replace(/\.?0+$/, '')}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

const Exchange: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [markets, setMarkets] = useState<UpbitMarket[]>([]);
  const [selectedMarket, setSelectedMarket] = useState('KRW-BTC');
  const [selectedPrice, setSelectedPrice] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'buy' | 'sell' | 'history'>('buy');

  // URL 파라미터에서 마켓 설정
  useEffect(() => {
    const m = searchParams.get('market');
    if (m) setSelectedMarket(m);
  }, [searchParams]);

  // 마켓 목록 로드
  useEffect(() => {
    fetchKRWMarkets().then(data => {
      setMarkets(data);
      // 초기 시세 로드도 함께
      const codes = data.map((m: UpbitMarket) => m.market);
      fetchTickers(codes).catch(() => { });
    }).catch(() => { });
  }, []);

  // WebSocket 연결
  const marketCodes = useMemo(() => markets.map((m: UpbitMarket) => m.market), [markets]);
  const wsTickers = useUpbitTicker(marketCodes);
  const orderbook = useUpbitOrderbook(selectedMarket);
  const trades = useUpbitTrades(selectedMarket);

  // 현재 선택된 코인 정보
  const currentTicker = wsTickers.get(selectedMarket);
  const currentMarket = markets.find((m: UpbitMarket) => m.market === selectedMarket);
  const currentPrice = currentTicker?.trade_price ?? 0;
  const changeRate = currentTicker?.signed_change_rate ?? 0;
  const change = (currentTicker?.change ?? 'EVEN') as string;

  const handlePriceClick = (price: number) => {
    setSelectedPrice(price);
  };

  return (
    <ExchangeContainer>
      <Header />
      <MarketInfo>
        <MarketName>
          {currentMarket?.korean_name ?? selectedMarket.replace('KRW-', '')}
          <span>{selectedMarket}</span>
        </MarketName>
        <CurrentPrice $change={change}>
          {formatPrice(currentPrice)}
        </CurrentPrice>
        <ChangeRate $change={change}>
          {changeRate > 0 ? '+' : ''}{(changeRate * 100).toFixed(2)}%
        </ChangeRate>
        <InfoItem>
          고가
          <span style={{ color: '#d60000' }}>{formatPrice(currentTicker?.high_price ?? 0)}</span>
        </InfoItem>
        <InfoItem>
          저가
          <span style={{ color: '#0051c7' }}>{formatPrice(currentTicker?.low_price ?? 0)}</span>
        </InfoItem>
        <InfoItem>
          거래대금(24H)
          <span>{formatVolume(currentTicker?.acc_trade_price_24h ?? 0)}</span>
        </InfoItem>
      </MarketInfo>

      <ExchangeBody>
        <SidebarPanel>
          <CoinListSidebar
            markets={markets}
            tickers={wsTickers}
            selectedMarket={selectedMarket}
            onSelectMarket={setSelectedMarket}
          />
        </SidebarPanel>

        <ChartPanel>
          <PriceChart market={selectedMarket} />
        </ChartPanel>

        <OrderbookPanel>
          <Orderbook orderbook={orderbook} onPriceClick={handlePriceClick} />
        </OrderbookPanel>

        <TradePanelContainer>
          <TabHeader>
            <TabButton
              $active={activeTab === 'buy'}
              onClick={() => setActiveTab('buy')}
            >
              매수
            </TabButton>
            <TabButton
              $active={activeTab === 'sell'}
              onClick={() => setActiveTab('sell')}
            >
              매도
            </TabButton>
            <TabButton
              $active={activeTab === 'history'}
              onClick={() => setActiveTab('history')}
            >
              거래내역
            </TabButton>
          </TabHeader>
          <TabContent>
            {activeTab === 'history' ? (
              <MyHistory market={selectedMarket} />
            ) : (
              <TradeForm
                market={selectedMarket}
                currentPrice={currentPrice}
                selectedPrice={selectedPrice}
                tradeType={activeTab}
              />
            )}
          </TabContent>
        </TradePanelContainer>

        <RecentTradesPanel>
          <RecentTrades trades={trades} />
        </RecentTradesPanel>
      </ExchangeBody>
    </ExchangeContainer>
  );
};

export default Exchange;
