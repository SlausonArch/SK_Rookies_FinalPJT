import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import styled from 'styled-components';
import axios from 'axios';
import { createChart, CandlestickSeries } from 'lightweight-charts';
import type { IChartApi, ISeriesApi, CandlestickData, Time } from 'lightweight-charts';
import Header from '../components/Header';
import { fetchKRWMarkets, fetchMinuteCandles, fetchDayCandles } from '../services/upbitApi';
import type { UpbitMarket } from '../services/upbitApi';
import { useUpbitTicker } from '../hooks/useUpbitWebSocket';

/* ───── types ───── */

interface NewsItem {
  title: string;
  link: string;
  source: string;
  pubDate: string;
}

type SortKey = 'volume' | 'price' | 'rate';
type Timeframe = { label: string; unit: number; type: 'minute' | 'day' };

const TIMEFRAMES: Timeframe[] = [
  { label: '1분', unit: 1, type: 'minute' },
  { label: '5분', unit: 5, type: 'minute' },
  { label: '15분', unit: 15, type: 'minute' },
  { label: '1시간', unit: 60, type: 'minute' },
  { label: '일봉', unit: 1, type: 'day' },
];

const TOP_COINS = ['KRW-BTC', 'KRW-ETH', 'KRW-XRP', 'KRW-SOL', 'KRW-DOGE'];

/* ───── styled-components ───── */

const PageWrapper = styled.div`
  background: #f5f6f7;
  min-height: 100vh;
`;

const Container = styled.div`
  max-width: 1360px;
  margin: 0 auto;
  padding: 24px 20px;
`;

const PageTitle = styled.h1`
  font-size: 24px;
  font-weight: 700;
  color: #1a1a2e;
  margin: 0 0 20px 0;
`;

const TopCards = styled.div`
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12px;
  margin-bottom: 24px;

  @media (max-width: 900px) {
    grid-template-columns: repeat(3, 1fr);
  }
  @media (max-width: 600px) {
    grid-template-columns: repeat(2, 1fr);
  }
`;

const CoinCard = styled.div<{ $change: string; $selected: boolean }>`
  background: ${p => p.$selected ? '#f0f4ff' : '#fff'};
  border-radius: 10px;
  padding: 16px;
  cursor: pointer;
  border: 1px solid ${p => p.$selected ? '#093687' : '#e1e4e8'};
  transition: all 0.2s;
  &:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.08); }

  .name { font-size: 14px; font-weight: 600; color: #333; margin-bottom: 2px; }
  .code { font-size: 11px; color: #999; margin-bottom: 8px; }
  .price { font-size: 17px; font-weight: 700; color: ${p => p.$change === 'RISE' ? '#d60000' : p.$change === 'FALL' ? '#0051c7' : '#333'}; }
  .rate { font-size: 12px; color: ${p => p.$change === 'RISE' ? '#d60000' : p.$change === 'FALL' ? '#0051c7' : '#333'}; margin-top: 4px; }
`;

/* 2-column: chart+news (left), coin list (right) */
const MainGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 380px;
  gap: 20px;

  @media (max-width: 1100px) {
    grid-template-columns: 1fr;
  }
`;

const LeftColumn = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

const Panel = styled.div`
  background: #fff;
  border-radius: 10px;
  border: 1px solid #e1e4e8;
  overflow: hidden;
`;

const PanelHeader = styled.div`
  padding: 16px 20px;
  border-bottom: 1px solid #e1e4e8;
  display: flex;
  align-items: center;
  justify-content: space-between;
  h3 { margin: 0; font-size: 16px; font-weight: 600; color: #1a1a2e; }
`;

/* ── Chart ── */

const ChartPanel = styled(Panel)`
  display: flex;
  flex-direction: column;
`;

const ChartTitleBar = styled.div`
  padding: 16px 20px 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;

  .coin-info {
    display: flex;
    align-items: baseline;
    gap: 12px;
    h3 { margin: 0; font-size: 18px; font-weight: 700; color: #1a1a2e; }
  }
`;

const PriceDisplay = styled.span<{ $change: string }>`
  font-size: 22px;
  font-weight: 700;
  color: ${p => p.$change === 'RISE' ? '#d60000' : p.$change === 'FALL' ? '#0051c7' : '#333'};
`;

const RateDisplay = styled.span<{ $change: string }>`
  font-size: 13px;
  font-weight: 500;
  color: ${p => p.$change === 'RISE' ? '#d60000' : p.$change === 'FALL' ? '#0051c7' : '#333'};
  margin-left: 8px;
`;

const TimeframeTabs = styled.div`
  display: flex;
  gap: 4px;
  padding: 4px 20px 12px;
  border-bottom: 1px solid #f0f0f0;
`;

const TabBtn = styled.button<{ $active: boolean }>`
  padding: 4px 12px;
  font-size: 11px;
  font-weight: ${p => p.$active ? 700 : 400};
  color: ${p => p.$active ? '#fff' : '#666'};
  background: ${p => p.$active ? '#093687' : '#f0f2f5'};
  border: none;
  border-radius: 4px;
  cursor: pointer;
  &:hover { opacity: 0.8; }
`;

const ChartArea = styled.div`
  flex: 1;
  min-height: 360px;
`;

/* ── News ── */

const NewsPanel = styled(Panel)``;

const NewsList = styled.div`
  max-height: 480px;
  overflow-y: auto;
`;

const NewsRow = styled.a`
  display: block;
  padding: 14px 20px;
  border-bottom: 1px solid #f5f5f5;
  text-decoration: none;
  transition: background 0.15s;
  &:hover { background: #fafbfc; }

  .news-title {
    font-size: 14px;
    font-weight: 500;
    color: #1a1a2e;
    line-height: 1.5;
    margin-bottom: 6px;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .news-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: #999;
  }
  .news-source {
    color: #093687;
    font-weight: 500;
  }
`;

const NewsEmpty = styled.div`
  padding: 40px 20px;
  text-align: center;
  color: #999;
  font-size: 14px;
`;

/* ── Coin List (right sidebar) ── */

const SidePanel = styled(Panel)`
  display: flex;
  flex-direction: column;
  max-height: calc(360px + 480px + 20px + 40px + 40px); /* match left column height */
`;

const SearchInput = styled.input`
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 13px;
  width: 140px;
  &:focus { outline: none; border-color: #093687; }
`;

const SortTabs = styled.div`
  display: flex;
  gap: 4px;
  padding: 8px 16px;
  border-bottom: 1px solid #f0f0f0;
`;

const CoinList = styled.div`
  flex: 1;
  overflow-y: auto;
`;

const CoinRow = styled.div<{ $selected: boolean }>`
  display: grid;
  grid-template-columns: 1.2fr 1fr 0.7fr;
  align-items: center;
  padding: 9px 16px;
  font-size: 12px;
  cursor: pointer;
  background: ${p => p.$selected ? '#f0f4ff' : 'transparent'};
  border-bottom: 1px solid #f8f8f8;
  &:hover { background: ${p => p.$selected ? '#f0f4ff' : '#fafafa'}; }

  .name-col {
    .kr { font-weight: 500; color: #333; font-size: 13px; }
    .code { font-size: 10px; color: #999; }
  }
  .price-col { text-align: right; font-weight: 600; font-size: 13px; }
  .rate-col { text-align: right; font-weight: 500; }
`;

const ListHeader = styled.div`
  display: grid;
  grid-template-columns: 1.2fr 1fr 0.7fr;
  padding: 8px 16px;
  font-size: 11px;
  font-weight: 600;
  color: #999;
  border-bottom: 1px solid #f0f0f0;
  .price-col { text-align: right; }
  .rate-col { text-align: right; }
`;

/* ───── helpers ───── */

const formatPrice = (price: number) => {
  if (price >= 100) return price.toLocaleString('ko-KR', { maximumFractionDigits: 0 });
  if (price >= 1) return price.toLocaleString('ko-KR', { maximumFractionDigits: 2 });
  return price.toLocaleString('ko-KR', { maximumFractionDigits: 4 });
};

const formatVolume = (vol: number) => {
  if (vol >= 1_000_000_000_000) return `${(vol / 1_000_000_000_000).toFixed(1)}조`;
  if (vol >= 100_000_000) return `${(vol / 100_000_000).toFixed(0)}억`;
  if (vol >= 10_000) return `${(vol / 10_000).toFixed(0)}만`;
  return vol.toLocaleString('ko-KR', { maximumFractionDigits: 0 });
};

const changeColor = (change: string) =>
  change === 'RISE' ? '#d60000' : change === 'FALL' ? '#0051c7' : '#333';

/* ───── component ───── */

const KST_TIMEZONE = 'Asia/Seoul';
const kstDateTimePartsFormatter = new Intl.DateTimeFormat('ko-KR', {
  timeZone: KST_TIMEZONE,
  year: '2-digit',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const toChartDate = (time: Time): Date => {
  if (typeof time === 'number') return new Date(time * 1000);
  if (typeof time === 'string') return new Date(`${time}T00:00:00Z`);
  return new Date(Date.UTC(time.year, time.month - 1, time.day));
};

const extractKstParts = (date: Date) => {
  const parts = kstDateTimePartsFormatter.formatToParts(date);
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find(p => p.type === type)?.value ?? '00';
  return {
    yy: pick('year'),
    mm: pick('month'),
    dd: pick('day'),
    hh: pick('hour'),
    min: pick('minute'),
  };
};

const formatKstAxisTime = (time: Time, timeframeType: Timeframe['type']): string => {
  const date = toChartDate(time);
  if (Number.isNaN(date.getTime())) return '';
  const { yy, mm, dd, hh, min } = extractKstParts(date);
  return timeframeType === 'day' ? `${yy}${mm}${dd}` : `${hh}.${min}`;
};

const formatKstTooltipTime = (time: Time, timeframeType: Timeframe['type']): string => {
  const date = toChartDate(time);
  if (Number.isNaN(date.getTime())) return '';
  const { yy, mm, dd, hh, min } = extractKstParts(date);
  return timeframeType === 'day' ? `${yy}.${mm}.${dd}` : `${hh}.${min}`;
};

const toUtcTimestamp = (utcDateTime: string): Time => {
  return Math.floor(new Date(`${utcDateTime}Z`).getTime() / 1000) as Time;
};

const Trends: React.FC = () => {
  const [markets, setMarkets] = useState<UpbitMarket[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('volume');
  const [selectedMarket, setSelectedMarket] = useState('KRW-BTC');
  const [timeframe, setTimeframe] = useState<Timeframe>(TIMEFRAMES[0]);

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick', Time> | null>(null);

  // fetch markets
  useEffect(() => {
    fetchKRWMarkets().then(setMarkets).catch(() => {});
  }, []);

  // fetch news
  const loadNews = useCallback(async () => {
    try {
      const { data } = await axios.get<NewsItem[]>('http://localhost:8080/api/news');
      setNews(data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    loadNews();
    const interval = setInterval(loadNews, 10 * 60 * 1000); // 10분마다 갱신
    return () => clearInterval(interval);
  }, [loadNews]);

  const marketCodes = useMemo(() => markets.map(m => m.market), [markets]);
  const tickers = useUpbitTicker(marketCodes);

  const marketMap = useMemo(() => {
    const map = new Map<string, UpbitMarket>();
    markets.forEach(m => map.set(m.market, m));
    return map;
  }, [markets]);

  // filtered + sorted list
  const sortedMarkets = useMemo(() => {
    let filtered = markets;
    if (search) {
      const q = search.toLowerCase();
      filtered = markets.filter(m =>
        m.korean_name.toLowerCase().includes(q) ||
        m.market.toLowerCase().includes(q) ||
        m.english_name.toLowerCase().includes(q)
      );
    }
    return [...filtered].sort((a, b) => {
      const ta = tickers.get(a.market);
      const tb = tickers.get(b.market);
      if (!ta || !tb) return 0;
      if (sortKey === 'volume') return tb.acc_trade_price_24h - ta.acc_trade_price_24h;
      if (sortKey === 'price') return tb.trade_price - ta.trade_price;
      return Math.abs(tb.signed_change_rate) - Math.abs(ta.signed_change_rate);
    });
  }, [markets, tickers, search, sortKey]);

  // chart init
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight || 360,
      layout: { background: { color: '#ffffff' }, textColor: '#333' },
      grid: { vertLines: { color: '#f0f0f0' }, horzLines: { color: '#f0f0f0' } },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        tickMarkFormatter: (time: Time) => formatKstAxisTime(time, timeframe.type),
      },
      localization: {
        locale: 'ko-KR',
        timeFormatter: (time: Time) => formatKstTooltipTime(time, timeframe.type),
      },
      crosshair: { mode: 0 },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#d60000',
      downColor: '#0051c7',
      borderUpColor: '#d60000',
      borderDownColor: '#0051c7',
      wickUpColor: '#d60000',
      wickDownColor: '#0051c7',
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const ro = new ResizeObserver(entries => {
      for (const e of entries) {
        const { width, height } = e.contentRect;
        if (width > 0 && height > 0) {
          chart.applyOptions({ width, height });
          chart.timeScale().fitContent();
        }
      }
    });
    ro.observe(chartContainerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  // load candle data
  useEffect(() => {
    if (!seriesRef.current || !selectedMarket) return;

    const load = async () => {
      try {
        const candles = timeframe.type === 'day'
          ? await fetchDayCandles(selectedMarket, 200)
          : await fetchMinuteCandles(selectedMarket, timeframe.unit, 200);

        const data: CandlestickData<Time>[] = candles.map(c => ({
          time: toUtcTimestamp(c.candle_date_time_utc),
          open: c.opening_price,
          high: c.high_price,
          low: c.low_price,
          close: c.trade_price,
        }));

        seriesRef.current?.setData(data);
        chartRef.current?.timeScale().fitContent();
      } catch { /* ignore */ }
    };

    load();
  }, [selectedMarket, timeframe]);

  useEffect(() => {
    if (!chartRef.current) return;
    chartRef.current.applyOptions({
      timeScale: {
        tickMarkFormatter: (time: Time) => formatKstAxisTime(time, timeframe.type),
      },
      localization: {
        locale: 'ko-KR',
        timeFormatter: (time: Time) => formatKstTooltipTime(time, timeframe.type),
      },
    });
  }, [timeframe]);

  const selectedInfo = marketMap.get(selectedMarket);
  const selectedTicker = tickers.get(selectedMarket);

  return (
    <PageWrapper>
      <Header />
      <Container>
        <PageTitle>코인 동향</PageTitle>

        {/* Top summary cards */}
        <TopCards>
          {TOP_COINS.map(code => {
            const info = marketMap.get(code);
            const t = tickers.get(code);
            if (!info || !t) return null;
            return (
              <CoinCard
                key={code}
                $change={t.change}
                $selected={code === selectedMarket}
                onClick={() => setSelectedMarket(code)}
              >
                <div className="name">{info.korean_name}</div>
                <div className="code">{code.replace('KRW-', '')}</div>
                <div className="price">{formatPrice(t.trade_price)}원</div>
                <div className="rate">
                  {t.signed_change_rate >= 0 ? '+' : ''}
                  {(t.signed_change_rate * 100).toFixed(2)}%
                </div>
              </CoinCard>
            );
          })}
        </TopCards>

        <MainGrid>
          {/* Left: chart + news */}
          <LeftColumn>
            {/* Chart */}
            <ChartPanel>
              <ChartTitleBar>
                <div className="coin-info">
                  <h3>{selectedInfo?.korean_name || selectedMarket}</h3>
                  {selectedTicker && (
                    <>
                      <PriceDisplay $change={selectedTicker.change}>
                        {formatPrice(selectedTicker.trade_price)}원
                      </PriceDisplay>
                      <RateDisplay $change={selectedTicker.change}>
                        {selectedTicker.signed_change_rate >= 0 ? '+' : ''}
                        {(selectedTicker.signed_change_rate * 100).toFixed(2)}%
                      </RateDisplay>
                    </>
                  )}
                </div>
              </ChartTitleBar>
              <TimeframeTabs>
                {TIMEFRAMES.map(tf => (
                  <TabBtn
                    key={tf.label}
                    $active={tf.label === timeframe.label}
                    onClick={() => setTimeframe(tf)}
                  >
                    {tf.label}
                  </TabBtn>
                ))}
              </TimeframeTabs>
              <ChartArea ref={chartContainerRef} />
            </ChartPanel>

            {/* News */}
            <NewsPanel>
              <PanelHeader>
                <h3>코인 뉴스</h3>
                <span style={{ fontSize: 12, color: '#999' }}>Google News 제공</span>
              </PanelHeader>
              <NewsList>
                {news.length === 0 ? (
                  <NewsEmpty>뉴스를 불러오는 중...</NewsEmpty>
                ) : (
                  news.map((item, idx) => (
                    <NewsRow key={idx} href={item.link} target="_blank" rel="noopener noreferrer">
                      <div className="news-title">{item.title}</div>
                      <div className="news-meta">
                        {item.source && <span className="news-source">{item.source}</span>}
                        <span>{item.pubDate}</span>
                      </div>
                    </NewsRow>
                  ))
                )}
              </NewsList>
            </NewsPanel>
          </LeftColumn>

          {/* Right: coin list sidebar */}
          <SidePanel>
            <PanelHeader>
              <h3>전체 시세</h3>
              <SearchInput
                placeholder="코인 검색..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </PanelHeader>
            <SortTabs>
              <TabBtn $active={sortKey === 'volume'} onClick={() => setSortKey('volume')}>거래대금</TabBtn>
              <TabBtn $active={sortKey === 'price'} onClick={() => setSortKey('price')}>현재가</TabBtn>
              <TabBtn $active={sortKey === 'rate'} onClick={() => setSortKey('rate')}>변동률</TabBtn>
            </SortTabs>
            <ListHeader>
              <div>코인명</div>
              <div className="price-col">현재가</div>
              <div className="rate-col">변동률</div>
            </ListHeader>
            <CoinList>
              {sortedMarkets.map(m => {
                const t = tickers.get(m.market);
                if (!t) return null;
                return (
                  <CoinRow
                    key={m.market}
                    $selected={m.market === selectedMarket}
                    onClick={() => setSelectedMarket(m.market)}
                  >
                    <div className="name-col">
                      <div className="kr">{m.korean_name}</div>
                      <div className="code">{m.market.replace('KRW-', '')} · {formatVolume(t.acc_trade_price_24h)}</div>
                    </div>
                    <div className="price-col" style={{ color: changeColor(t.change) }}>
                      {formatPrice(t.trade_price)}
                    </div>
                    <div className="rate-col" style={{ color: changeColor(t.change) }}>
                      {t.signed_change_rate >= 0 ? '+' : ''}
                      {(t.signed_change_rate * 100).toFixed(2)}%
                    </div>
                  </CoinRow>
                );
              })}
            </CoinList>
          </SidePanel>
        </MainGrid>
      </Container>
    </PageWrapper>
  );
};

export default Trends;
