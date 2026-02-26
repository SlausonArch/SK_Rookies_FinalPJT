import axios from 'axios';

const UPBIT_API = 'https://api.upbit.com/v1';
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
  try {
    const { data } = await axios.get<UpbitMarket[]>(`${PROXY_API}/all`);
    return data.filter(m => m.market.startsWith('KRW-'));
  } catch {
    const { data } = await axios.get<UpbitMarket[]>(`${UPBIT_API}/market/all`);
    return data.filter(m => m.market.startsWith('KRW-'));
  }
}

export async function fetchTickers(markets: string[]): Promise<UpbitTicker[]> {
  if (markets.length === 0) return [];
  try {
    const { data } = await axios.get<UpbitTicker[]>(`${PROXY_API}/ticker`, {
      params: { markets: markets.join(',') },
    });
    return data;
  } catch {
    const { data } = await axios.get<UpbitTicker[]>(
      `${UPBIT_API}/ticker?markets=${markets.join(',')}`
    );
    return data;
  }
}

export async function fetchMinuteCandles(
  market: string,
  unit: number = 1,
  count: number = 200
): Promise<UpbitCandle[]> {
  try {
    const { data } = await axios.get<UpbitCandle[]>(`${PROXY_API}/candles/minutes/${unit}`, {
      params: { market, count },
    });
    return data.reverse();
  } catch {
    const { data } = await axios.get<UpbitCandle[]>(
      `${UPBIT_API}/candles/minutes/${unit}?market=${market}&count=${count}`
    );
    return data.reverse();
  }
}

export async function fetchDayCandles(
  market: string,
  count: number = 200
): Promise<UpbitCandle[]> {
  try {
    const { data } = await axios.get<UpbitCandle[]>(`${PROXY_API}/candles/days`, {
      params: { market, count },
    });
    return data.reverse();
  } catch {
    const { data } = await axios.get<UpbitCandle[]>(
      `${UPBIT_API}/candles/days?market=${market}&count=${count}`
    );
    return data.reverse();
  }
}
