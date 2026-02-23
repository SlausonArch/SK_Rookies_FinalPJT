import React, { useMemo } from 'react';
import styled from 'styled-components';
import type { OrderbookWS } from '../../hooks/useUpbitWebSocket';

interface Props {
  orderbook: OrderbookWS | null;
  onPriceClick: (price: number) => void;
}

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow-y: auto;
`;

const Title = styled.div`
  padding: 10px 12px;
  font-size: 13px;
  font-weight: 700;
  color: #333;
  border-bottom: 1px solid #eee;
`;

const OrderbookTable = styled.div`
  flex: 1;
  overflow-y: auto;
`;

const Row = styled.div<{ $type: 'ask' | 'bid' }>`
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  padding: 3px 12px;
  font-size: 11px;
  cursor: pointer;
  position: relative;
  &:hover { background: #f5f6f7; }
`;

const SizeBar = styled.div<{ $type: 'ask' | 'bid'; $width: number }>`
  position: absolute;
  top: 0;
  bottom: 0;
  ${p => p.$type === 'ask' ? 'right: 0' : 'left: 0'};
  width: ${p => Math.min(p.$width, 100)}%;
  background: ${p => p.$type === 'ask' ? 'rgba(0, 81, 199, 0.08)' : 'rgba(214, 0, 0, 0.08)'};
  z-index: 0;
`;

const AskSize = styled.div`
  text-align: left;
  color: #0051c7;
  font-weight: 500;
  z-index: 1;
`;

const Price = styled.div<{ $type: 'ask' | 'bid' }>`
  text-align: center;
  font-weight: 700;
  color: ${p => p.$type === 'ask' ? '#0051c7' : '#d60000'};
  z-index: 1;
  padding: 0 8px;
`;

const BidSize = styled.div`
  text-align: right;
  color: #d60000;
  font-weight: 500;
  z-index: 1;
`;

const Divider = styled.div`
  padding: 6px 12px;
  text-align: center;
  font-size: 11px;
  color: #999;
  border-top: 1px solid #eee;
  border-bottom: 1px solid #eee;
  background: #f9fafc;
`;

function formatSize(n: number): string {
  if (n >= 1) return n.toFixed(4);
  return n.toFixed(6);
}

function formatPrice(n: number): string {
  if (n >= 100) return n.toLocaleString('ko-KR', { maximumFractionDigits: 0 });
  if (n >= 1) return n.toLocaleString('ko-KR', { maximumFractionDigits: 2 });
  return n.toLocaleString('ko-KR', { maximumFractionDigits: 4 });
}

const Orderbook: React.FC<Props> = ({ orderbook, onPriceClick }) => {
  const { asks, bids, maxSize } = useMemo(() => {
    if (!orderbook || !orderbook.orderbook_units) {
      return { asks: [], bids: [], maxSize: 1 };
    }

    const units = orderbook.orderbook_units;
    const asks = units.map(u => ({ price: u.ask_price, size: u.ask_size })).reverse();
    const bids = units.map(u => ({ price: u.bid_price, size: u.bid_size }));
    const allSizes = [...asks.map(a => a.size), ...bids.map(b => b.size)];
    const maxSize = Math.max(...allSizes, 1);

    return { asks, bids, maxSize };
  }, [orderbook]);

  if (!orderbook) {
    return (
      <Container>
        <Title>호가</Title>
        <div style={{ padding: 20, textAlign: 'center', color: '#999', fontSize: 12 }}>
          호가 데이터를 불러오는 중...
        </div>
      </Container>
    );
  }

  return (
    <Container>
      <Title>호가</Title>
      <OrderbookTable>
        {asks.map((item, i) => (
          <Row key={`ask-${i}`} $type="ask" onClick={() => onPriceClick(item.price)}>
            <SizeBar $type="ask" $width={(item.size / maxSize) * 100} />
            <AskSize>{formatSize(item.size)}</AskSize>
            <Price $type="ask">{formatPrice(item.price)}</Price>
            <div />
          </Row>
        ))}
        <Divider>
          {asks.length > 0 && bids.length > 0
            ? formatPrice(asks[asks.length - 1]?.price ?? 0)
            : '---'}
        </Divider>
        {bids.map((item, i) => (
          <Row key={`bid-${i}`} $type="bid" onClick={() => onPriceClick(item.price)}>
            <SizeBar $type="bid" $width={(item.size / maxSize) * 100} />
            <div />
            <Price $type="bid">{formatPrice(item.price)}</Price>
            <BidSize>{formatSize(item.size)}</BidSize>
          </Row>
        ))}
      </OrderbookTable>
    </Container>
  );
};

export default Orderbook;
