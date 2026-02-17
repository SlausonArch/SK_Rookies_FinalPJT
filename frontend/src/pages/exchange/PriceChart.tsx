import React, { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { createChart, CandlestickSeries } from 'lightweight-charts';
import type { IChartApi, ISeriesApi, CandlestickData, Time } from 'lightweight-charts';
import { fetchMinuteCandles, fetchDayCandles } from '../../services/upbitApi';

interface Props {
  market: string;
}

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
`;

const TimeframeTabs = styled.div`
  display: flex;
  gap: 4px;
  padding: 8px 12px;
  border-bottom: 1px solid #eee;
`;

const TimeframeBtn = styled.button<{ $active: boolean }>`
  padding: 4px 10px;
  font-size: 11px;
  font-weight: ${p => p.$active ? 700 : 400};
  color: ${p => p.$active ? '#fff' : '#666'};
  background: ${p => p.$active ? '#093687' : '#f0f2f5'};
  border: none;
  border-radius: 4px;
  cursor: pointer;
  &:hover { opacity: 0.8; }
`;

const ChartContainer = styled.div`
  flex: 1;
  min-height: 0;
  overflow: hidden;
`;

type Timeframe = { label: string; unit: number; type: 'minute' | 'day' };

const TIMEFRAMES: Timeframe[] = [
  { label: '1분', unit: 1, type: 'minute' },
  { label: '5분', unit: 5, type: 'minute' },
  { label: '15분', unit: 15, type: 'minute' },
  { label: '1시간', unit: 60, type: 'minute' },
  { label: '4시간', unit: 240, type: 'minute' },
  { label: '일봉', unit: 1, type: 'day' },
];

const PriceChart: React.FC<Props> = ({ market }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick', Time> | null>(null);
  const [timeframe, setTimeframe] = useState<Timeframe>(TIMEFRAMES[0]);

  // Chart 초기화
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight || 400,
      layout: {
        background: { color: '#ffffff' },
        textColor: '#333',
      },
      grid: {
        vertLines: { color: '#f0f0f0' },
        horzLines: { color: '#f0f0f0' },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        mode: 0,
      },
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

    const resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          chart.applyOptions({ width, height });
          chart.timeScale().fitContent();
        }
      }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  // 데이터 로드
  useEffect(() => {
    if (!seriesRef.current || !market) return;

    const loadData = async () => {
      try {
        let candles;
        if (timeframe.type === 'day') {
          candles = await fetchDayCandles(market, 200);
        } else {
          candles = await fetchMinuteCandles(market, timeframe.unit, 200);
        }

        const data: CandlestickData<Time>[] = candles.map(c => ({
          time: (Math.floor(new Date(c.candle_date_time_utc).getTime() / 1000)) as Time,
          open: c.opening_price,
          high: c.high_price,
          low: c.low_price,
          close: c.trade_price,
        }));

        seriesRef.current?.setData(data);
        chartRef.current?.timeScale().fitContent();
      } catch {
        // 데이터 로드 실패 시 무시
      }
    };

    loadData();
  }, [market, timeframe]);

  return (
    <Container>
      <TimeframeTabs>
        {TIMEFRAMES.map(tf => (
          <TimeframeBtn
            key={tf.label}
            $active={tf.label === timeframe.label}
            onClick={() => setTimeframe(tf)}
          >
            {tf.label}
          </TimeframeBtn>
        ))}
      </TimeframeTabs>
      <ChartContainer ref={containerRef} />
    </Container>
  );
};

export default PriceChart;
