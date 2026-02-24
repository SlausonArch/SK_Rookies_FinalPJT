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
  font-weight: ${(p: { $active: boolean }) => p.$active ? 700 : 400};
  color: ${(p: { $active: boolean }) => p.$active ? '#fff' : '#666'};
  background: ${(p: { $active: boolean }) => p.$active ? '#093687' : '#f0f2f5'};
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
  return timeframeType === 'day' ? `${yy}${mm}${dd}` : `${hh}:${min}`;
};

const formatKstTooltipTime = (time: Time, timeframeType: Timeframe['type']): string => {
  const date = toChartDate(time);
  if (Number.isNaN(date.getTime())) return '';
  const { yy, mm, dd, hh, min } = extractKstParts(date);
  return timeframeType === 'day' ? `${yy}.${mm}.${dd}` : `${hh}:${min}`;
};

const toUtcTimestamp = (utcDateTime: string): Time => {
  return Math.floor(new Date(`${utcDateTime}Z`).getTime() / 1000) as Time;
};

const PriceChart: React.FC<Props> = ({ market }: Props) => {
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
        tickMarkFormatter: (time: Time) => formatKstAxisTime(time, timeframe.type),
      },
      localization: {
        locale: 'ko-KR',
        timeFormatter: (time: Time) => formatKstTooltipTime(time, timeframe.type),
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
          time: toUtcTimestamp(c.candle_date_time_utc),
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
