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

const PageContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #f5f6f7;
`;

const ExchangeBody = styled.div`
  display: grid;
  grid-template-columns: 260px 1fr 280px;
  grid-template-rows: 1fr auto;
  flex: 1;
  gap: 1px;
  background: #dfe7f6;
  min-height: 0;
`;

const SidebarPanel = styled.div`
  grid-row: 1 / 3;
  background: #fff;
  overflow: hidden;
  display: flex;
  flex-direction: column;
`;

const ChartPanel = styled.div`
  background: #fff;
  min-height: 0;
  overflow: hidden;
`;

const OrderbookPanel = styled.div`
  background: #fff;
  overflow: hidden;
`;

const TradeFormPanel = styled.div`
  background: #fff;
  min-height: 280px;
`;

const RecentTradesPanel = styled.div`
  background: #fff;
  min-height: 280px;
  overflow: hidden;
`;

const MarketInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 10px 16px;
  background: #fff;
  border-bottom: 1px solid #dfe7f6;
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
  color: ${p => p.$change === 'RISE' ? '#d60000' : p.$change === 'FALL' ? '#0051c7' : '#333'};
`;

const ChangeRate = styled.div<{ $change: string }>`
  font-size: 13px;
  font-weight: 600;
  color: ${p => p.$change === 'RISE' ? '#d60000' : p.$change === 'FALL' ? '#0051c7' : '#999'};
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

const Exchange: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [markets, setMarkets] = useState<UpbitMarket[]>([]);
  const [selectedMarket, setSelectedMarket] = useState('KRW-BTC');
  const [selectedPrice, setSelectedPrice] = useState<number | null>(null);

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
      const codes = data.map(m => m.market);
      fetchTickers(codes).catch(() => {});
    }).catch(() => {});
  }, []);

  // WebSocket 연결
  const marketCodes = useMemo(() => markets.map(m => m.market), [markets]);
  const wsTickers = useUpbitTicker(marketCodes);
  const orderbook = useUpbitOrderbook(selectedMarket);
  const trades = useUpbitTrades(selectedMarket);

  // 현재 선택된 코인 정보
  const currentTicker = wsTickers.get(selectedMarket);
  const currentMarket = markets.find(m => m.market === selectedMarket);
  const currentPrice = currentTicker?.trade_price ?? 0;
  const changeRate = currentTicker?.signed_change_rate ?? 0;
  const change = (currentTicker?.change ?? 'EVEN') as string;

  const handlePriceClick = (price: number) => {
    setSelectedPrice(price);
  };

  return (
    <PageContainer>
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

        <TradeFormPanel>
          <TradeForm
            market={selectedMarket}
            currentPrice={currentPrice}
            selectedPrice={selectedPrice}
          />
        </TradeFormPanel>

        <RecentTradesPanel>
          <RecentTrades trades={trades} />
        </RecentTradesPanel>
      </ExchangeBody>
    </PageContainer>
  );
};

export default Exchange;
