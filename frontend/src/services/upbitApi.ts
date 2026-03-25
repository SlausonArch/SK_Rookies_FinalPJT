import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
const PROXY_API = `${API_BASE}/api/market`;

export interface UpbitMarket {
  market: string;
  korean_name: string;
  english_name: string;
}

export interface UpbitTicker {
  market: string;
  trade_price: number;
  signed_change_rate: number;
  signed_change_price: number;
  acc_trade_price_24h: number;
  change: 'RISE' | 'EVEN' | 'FALL';
  opening_price: number;
  high_price: number;
  low_price: number;
  prev_closing_price: number;
}

export interface UpbitCandle {
  market: string;
  candle_date_time_kst: string;
  candle_date_time_utc: string;
  opening_price: number;
  high_price: number;
  low_price: number;
  trade_price: number;
  candle_acc_trade_volume: number;
  timestamp: number;
}

export async function fetchKRWMarkets(): Promise<UpbitMarket[]> {
  const { data } = await axios.get<UpbitMarket[]>(`${PROXY_API}/all`);
  return data.filter(m => m.market.startsWith('KRW-'));
}

export interface UpbitOrderbook {
  market: string;
  timestamp: number;
  total_ask_size: number;
  total_bid_size: number;
  orderbook_units: {
    ask_price: number;
    bid_price: number;
    ask_size: number;
    bid_size: number;
  }[];
}

export interface UpbitTradeTick {
  market: string;
  trade_price: number;
  trade_volume: number;
  ask_bid: 'ASK' | 'BID';
  timestamp: number;
  sequential_id: number;
  trade_date_utc?: string;
  trade_time_utc?: string;
}

const chunkMarkets = (markets: string[], size: number) => {
  const chunks: string[][] = [];
  for (let i = 0; i < markets.length; i += size) {
    chunks.push(markets.slice(i, i + size));
  }
  return chunks;
};

async function fetchTickersSingle(market: string): Promise<UpbitTicker | null> {
  try {
    const { data } = await axios.get<UpbitTicker[]>(`${PROXY_API}/ticker`, {
      params: { markets: market },
    });
    return data[0] ?? null;
  } catch {
    return null;
  }
}

export async function fetchTickers(markets: string[]): Promise<UpbitTicker[]> {
  if (markets.length === 0) return [];

  const chunks = chunkMarkets(markets, 100);
  const merged: UpbitTicker[] = [];

  for (const chunk of chunks) {
    try {
      const { data } = await axios.get<UpbitTicker[]>(`${PROXY_API}/ticker`, {
        params: { markets: chunk.join(',') },
      });
      merged.push(...data);
    } catch {
      // 배치 요청 실패 시 개별 조회로 폴백 (유효하지 않은 코인 무시)
      const results = await Promise.allSettled(chunk.map(m => fetchTickersSingle(m)));
      results.forEach(r => {
        if (r.status === 'fulfilled' && r.value) merged.push(r.value);
      });
    }
  }

  return merged;
}

export async function fetchMinuteCandles(
  market: string,
  unit: number = 1,
  count: number = 200
): Promise<UpbitCandle[]> {
  const { data } = await axios.get<UpbitCandle[]>(`${PROXY_API}/candles/minutes/${unit}`, {
    params: { market, count },
  });
  return data.reverse();
}

export async function fetchDayCandles(
  market: string,
  count: number = 200
): Promise<UpbitCandle[]> {
  const { data } = await axios.get<UpbitCandle[]>(`${PROXY_API}/candles/days`, {
    params: { market, count },
  });
  return data.reverse();
}

export async function fetchOrderbook(market: string): Promise<UpbitOrderbook | null> {
  if (!market) return null;

  const { data } = await axios.get<UpbitOrderbook[]>(`${PROXY_API}/orderbook`, {
    params: { markets: market },
  });
  return Array.isArray(data) && data.length > 0 ? data[0] : null;
}

export async function fetchTradeTicks(
  market: string,
  count: number = 50
): Promise<UpbitTradeTick[]> {
  if (!market) return [];

  const { data } = await axios.get<UpbitTradeTick[]>(`${PROXY_API}/trades/ticks`, {
    params: { market, count },
  });
  return Array.isArray(data) ? data : [];
}
