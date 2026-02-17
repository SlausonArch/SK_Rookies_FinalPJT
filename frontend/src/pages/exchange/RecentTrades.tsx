import React from 'react';
import styled from 'styled-components';
import type { TradeWS } from '../../hooks/useUpbitWebSocket';

interface Props {
  trades: TradeWS[];
}

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
`;

const Title = styled.div`
  padding: 10px 12px;
  font-size: 13px;
  font-weight: 700;
  color: #333;
  border-bottom: 1px solid #eee;
`;

const TableHeader = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  padding: 6px 12px;
  font-size: 10px;
  color: #999;
  border-bottom: 1px solid #f0f0f0;
`;

const TradeList = styled.div`
  flex: 1;
  overflow-y: auto;
`;

const TradeRow = styled.div<{ $type: 'ASK' | 'BID' }>`
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  padding: 4px 12px;
  font-size: 11px;
  border-bottom: 1px solid #fafafa;
`;

const PriceCell = styled.div<{ $type: 'ASK' | 'BID' }>`
  color: ${p => p.$type === 'BID' ? '#d60000' : '#0051c7'};
  font-weight: 600;
`;

const SizeCell = styled.div`
  text-align: right;
  color: #333;
`;

const TimeCell = styled.div`
  text-align: right;
  color: #999;
`;

const EmptyMessage = styled.div`
  padding: 24px;
  text-align: center;
  color: #999;
  font-size: 12px;
`;

function formatPrice(n: number): string {
  if (n >= 100) return n.toLocaleString('ko-KR', { maximumFractionDigits: 0 });
  if (n >= 1) return n.toLocaleString('ko-KR', { maximumFractionDigits: 2 });
  return n.toLocaleString('ko-KR', { maximumFractionDigits: 4 });
}

const RecentTrades: React.FC<Props> = ({ trades }) => {
  return (
    <Container>
      <Title>체결</Title>
      <TableHeader>
        <div>가격(KRW)</div>
        <div style={{ textAlign: 'right' }}>수량</div>
        <div style={{ textAlign: 'right' }}>시간</div>
      </TableHeader>
      <TradeList>
        {trades.length === 0 ? (
          <EmptyMessage>체결 데이터를 불러오는 중...</EmptyMessage>
        ) : (
          trades.map((t, i) => (
            <TradeRow key={`${t.sequential_id}-${i}`} $type={t.ask_bid}>
              <PriceCell $type={t.ask_bid}>{formatPrice(t.trade_price)}</PriceCell>
              <SizeCell>{t.trade_volume.toFixed(4)}</SizeCell>
              <TimeCell>{t.trade_time?.substring(0, 8) ?? ''}</TimeCell>
            </TradeRow>
          ))
        )}
      </TradeList>
    </Container>
  );
};

export default RecentTrades;
