import React, { useState, useMemo } from 'react';
import styled from 'styled-components';
import type { UpbitMarket } from '../../services/upbitApi';
import type { TickerWS } from '../../hooks/useUpbitWebSocket';

interface Props {
  markets: UpbitMarket[];
  tickers: Map<string, TickerWS>;
  selectedMarket: string;
  onSelectMarket: (market: string) => void;
}

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
`;

const SearchBox = styled.div`
  padding: 10px 12px;
  border-bottom: 1px solid #eee;
`;

const SearchInput = styled.input`
  width: 100%;
  border: 1px solid #dfe7f6;
  border-radius: 4px;
  padding: 8px 10px;
  font-size: 12px;
  outline: none;
  box-sizing: border-box;
  &:focus { border-color: #093687; }
`;

const SortTabs = styled.div`
  display: flex;
  border-bottom: 1px solid #eee;
`;

const SortTab = styled.button<{ $active: boolean }>`
  flex: 1;
  padding: 8px 0;
  font-size: 11px;
  font-weight: ${p => p.$active ? 700 : 400};
  color: ${p => p.$active ? '#093687' : '#999'};
  background: ${p => p.$active ? '#f0f4ff' : 'transparent'};
  border: none;
  border-bottom: ${p => p.$active ? '2px solid #093687' : '2px solid transparent'};
  cursor: pointer;
`;

const CoinList = styled.div`
  flex: 1;
  overflow-y: auto;
`;

const CoinRow = styled.div<{ $active: boolean }>`
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 4px;
  padding: 8px 12px;
  cursor: pointer;
  background: ${p => p.$active ? '#f0f4ff' : 'transparent'};
  border-left: ${p => p.$active ? '3px solid #093687' : '3px solid transparent'};
  &:hover { background: #f8f9fa; }
`;

const CoinInfo = styled.div`
  min-width: 0;
`;

const CoinNameText = styled.div`
  font-size: 12px;
  font-weight: 700;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const CoinSymbol = styled.div`
  font-size: 10px;
  color: #999;
`;

const PriceInfo = styled.div`
  text-align: right;
`;

const PriceText = styled.div`
  font-size: 12px;
  font-weight: 600;
  color: #333;
`;

const ChangeText = styled.div<{ $change: string }>`
  font-size: 10px;
  font-weight: 600;
  color: ${p => p.$change === 'RISE' ? '#d60000' : p.$change === 'FALL' ? '#0051c7' : '#999'};
`;

type SortKey = 'volume' | 'price' | 'change';

function formatPrice(n: number): string {
  if (n >= 100) return n.toLocaleString('ko-KR', { maximumFractionDigits: 0 });
  if (n >= 1) return n.toLocaleString('ko-KR', { maximumFractionDigits: 2 });
  return n.toLocaleString('ko-KR', { maximumFractionDigits: 4 });
}

const CoinListSidebar: React.FC<Props> = ({ markets, tickers, selectedMarket, onSelectMarket }) => {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('volume');

  const sortedCoins = useMemo(() => {
    const list = markets
      .map(m => {
        const t = tickers.get(m.market);
        return {
          market: m.market,
          koreanName: m.korean_name,
          symbol: m.market.replace('KRW-', ''),
          tradePrice: t?.trade_price ?? 0,
          changeRate: t?.signed_change_rate ?? 0,
          change: (t?.change ?? 'EVEN') as string,
          volume24h: t?.acc_trade_price_24h ?? 0,
        };
      })
      .filter(c =>
        c.koreanName.includes(search) ||
        c.symbol.toLowerCase().includes(search.toLowerCase())
      );

    if (sortBy === 'volume') list.sort((a, b) => b.volume24h - a.volume24h);
    else if (sortBy === 'price') list.sort((a, b) => b.tradePrice - a.tradePrice);
    else list.sort((a, b) => Math.abs(b.changeRate) - Math.abs(a.changeRate));

    return list;
  }, [markets, tickers, search, sortBy]);

  return (
    <Container>
      <SearchBox>
        <SearchInput
          placeholder="코인명/심볼 검색"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </SearchBox>
      <SortTabs>
        <SortTab $active={sortBy === 'volume'} onClick={() => setSortBy('volume')}>거래대금</SortTab>
        <SortTab $active={sortBy === 'price'} onClick={() => setSortBy('price')}>현재가</SortTab>
        <SortTab $active={sortBy === 'change'} onClick={() => setSortBy('change')}>변동률</SortTab>
      </SortTabs>
      <CoinList>
        {sortedCoins.map(coin => (
          <CoinRow
            key={coin.market}
            $active={coin.market === selectedMarket}
            onClick={() => onSelectMarket(coin.market)}
          >
            <CoinInfo>
              <CoinNameText>{coin.koreanName}</CoinNameText>
              <CoinSymbol>{coin.symbol}/KRW</CoinSymbol>
            </CoinInfo>
            <PriceInfo>
              <PriceText>{formatPrice(coin.tradePrice)}</PriceText>
              <ChangeText $change={coin.change}>
                {coin.changeRate > 0 ? '+' : ''}{(coin.changeRate * 100).toFixed(2)}%
              </ChangeText>
            </PriceInfo>
          </CoinRow>
        ))}
      </CoinList>
    </Container>
  );
};

export default CoinListSidebar;
