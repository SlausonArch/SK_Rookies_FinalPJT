import { useEffect, useRef, useState } from 'react';
import { fetchOrderbook, fetchTickers, fetchTradeTicks } from '../services/upbitApi';

export interface TickerWS {
  type: 'ticker';
  code: string;
  trade_price: number;
  signed_change_rate: number;
  signed_change_price: number;
  acc_trade_price_24h: number;
  change: 'RISE' | 'EVEN' | 'FALL';
  opening_price: number;
  high_price: number;
  low_price: number;
}

export interface OrderbookWS {
  type: 'orderbook';
  code: string;
  orderbook_units: {
    ask_price: number;
    bid_price: number;
    ask_size: number;
    bid_size: number;
  }[];
  total_ask_size: number;
  total_bid_size: number;
}

export interface TradeWS {
  type: 'trade';
  code: string;
  trade_price: number;
  trade_volume: number;
  ask_bid: 'ASK' | 'BID';
  trade_date: string;
  trade_time: string;
  trade_timestamp: number;
  sequential_id: number;
}

const decodeJson = (raw: unknown): Promise<unknown> => {
  try {
    if (typeof raw === 'string') return Promise.resolve(JSON.parse(raw));
    if (raw instanceof ArrayBuffer)
      return Promise.resolve(JSON.parse(new TextDecoder().decode(raw)));
    if (raw instanceof Blob)
      return raw.text().then((t) => JSON.parse(t));
  } catch {
    // ignore
  }
  return Promise.resolve(null);
};

export function useUpbitTicker(markets: string[]) {
  const [tickers, setTickers] = useState<Map<string, TickerWS>>(new Map());
  const wsRef = useRef<WebSocket | null>(null);
  const pendingRef = useRef<Map<string, TickerWS>>(new Map());
  const flushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const marketsKey = markets.join(',');

  useEffect(() => {
    if (markets.length === 0) return;

    let cancelled = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    // 300ms마다 누적된 변경을 한 번에 setState
    flushTimerRef.current = setInterval(() => {
      if (pendingRef.current.size === 0) return;
      const snapshot = new Map(pendingRef.current);
      pendingRef.current.clear();
      setTickers((prev) => {
        const next = new Map(prev);
        snapshot.forEach((v, k) => next.set(k, v));
        return next;
      });
    }, 300);

    const updateFromRest = async () => {
      try {
        const rows = await fetchTickers(markets);
        if (cancelled) return;
        setTickers(() => {
          const next = new Map<string, TickerWS>();
          rows.forEach((r) => {
            next.set(r.market, {
              type: 'ticker',
              code: r.market,
              trade_price: r.trade_price,
              signed_change_rate: r.signed_change_rate,
              signed_change_price: r.signed_change_price,
              acc_trade_price_24h: r.acc_trade_price_24h,
              change: r.change,
              opening_price: r.opening_price,
              high_price: r.high_price,
              low_price: r.low_price,
            });
          });
          return next;
        });
      } catch {
        // ignore
      }
    };

    const startPolling = () => {
      if (pollTimer) return;
      void updateFromRest();
      pollTimer = setInterval(() => void updateFromRest(), 5000);
    };

    const stopPolling = () => {
      if (!pollTimer) return;
      clearInterval(pollTimer);
      pollTimer = null;
    };

    const connect = () => {
      if (cancelled) return;

      const ws = new WebSocket('wss://api.upbit.com/websocket/v1');
      ws.binaryType = 'arraybuffer';
      wsRef.current = ws;

      ws.onopen = () => {
        stopPolling(); // WebSocket 연결 성공 시 폴링 중단
        ws.send(JSON.stringify([
          { ticket: 'vce-ticker' },
          { type: 'ticker', codes: markets.slice(0, 100) },
        ]));
      };

      ws.onmessage = async (event) => {
        try {
          const data = await decodeJson(event.data);
          if (!data) return;
          // 업비트 에러 응답(403 등) 무시
          if ((data as any).status === 'error' || (data as any).code != null && (data as any).type == null) return;
          if ((data as TickerWS).type !== 'ticker' || !(data as TickerWS).code) return;
          pendingRef.current.set((data as TickerWS).code, data as TickerWS);
        } catch {
          // ignore
        }
      };

      ws.onerror = () => startPolling();

      ws.onclose = () => {
        startPolling();
        if (cancelled) return;
        reconnectTimer = setTimeout(connect, 3000);
      };
    };

    startPolling();
    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      stopPolling();
      if (flushTimerRef.current) clearInterval(flushTimerRef.current);
      if (wsRef.current) wsRef.current.close();
      wsRef.current = null;
      pendingRef.current.clear();
    };
  }, [marketsKey]);

  return tickers;
}

export function useUpbitOrderbook(market: string) {
  const [orderbook, setOrderbook] = useState<OrderbookWS | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!market) return;

    let cancelled = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    const updateFromRest = async () => {
      try {
        const data = await fetchOrderbook(market);
        if (cancelled || !data) return;
        setOrderbook({
          type: 'orderbook',
          code: data.market,
          orderbook_units: data.orderbook_units,
          total_ask_size: data.total_ask_size,
          total_bid_size: data.total_bid_size,
        });
      } catch {
        // ignore
      }
    };

    const startPolling = () => {
      if (pollTimer) return;
      void updateFromRest();
      pollTimer = setInterval(() => void updateFromRest(), 3000);
    };

    const stopPolling = () => {
      if (!pollTimer) return;
      clearInterval(pollTimer);
      pollTimer = null;
    };

    const connect = () => {
      if (cancelled) return;

      const ws = new WebSocket('wss://api.upbit.com/websocket/v1');
      ws.binaryType = 'arraybuffer';
      wsRef.current = ws;

      ws.onopen = () => {
        stopPolling();
        ws.send(JSON.stringify([
          { ticket: 'vce-orderbook' },
          { type: 'orderbook', codes: [market] },
        ]));
      };

      ws.onmessage = async (event) => {
        try {
          const data = await decodeJson(event.data);
          if (!data) return;
          if ((data as any).status === 'error' || (data as any).code != null && (data as any).type == null) return;
          if ((data as OrderbookWS).type !== 'orderbook') return;
          setOrderbook(data as OrderbookWS);
        } catch {
          // ignore
        }
      };

      ws.onerror = () => startPolling();

      ws.onclose = () => {
        startPolling();
        if (cancelled) return;
        reconnectTimer = setTimeout(connect, 3000);
      };
    };

    startPolling();
    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      stopPolling();
      if (wsRef.current) wsRef.current.close();
      wsRef.current = null;
    };
  }, [market]);

  return orderbook;
}

export function useUpbitTrades(market: string) {
  const [trades, setTrades] = useState<TradeWS[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!market) return;
    setTrades([]);

    let cancelled = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    const updateFromRest = async () => {
      try {
        const rows = await fetchTradeTicks(market, 50);
        if (cancelled) return;
        setTrades(rows.map((row) => ({
          type: 'trade',
          code: row.market,
          trade_price: row.trade_price,
          trade_volume: row.trade_volume,
          ask_bid: row.ask_bid,
          trade_date: row.trade_date_utc || '',
          trade_time: row.trade_time_utc || '',
          trade_timestamp: row.timestamp,
          sequential_id: row.sequential_id,
        })));
      } catch {
        // ignore
      }
    };

    const startPolling = () => {
      if (pollTimer) return;
      void updateFromRest();
      pollTimer = setInterval(() => void updateFromRest(), 3000);
    };

    const stopPolling = () => {
      if (!pollTimer) return;
      clearInterval(pollTimer);
      pollTimer = null;
    };

    const connect = () => {
      if (cancelled) return;

      const ws = new WebSocket('wss://api.upbit.com/websocket/v1');
      ws.binaryType = 'arraybuffer';
      wsRef.current = ws;

      ws.onopen = () => {
        stopPolling();
        ws.send(JSON.stringify([
          { ticket: 'vce-trade' },
          { type: 'trade', codes: [market] },
        ]));
      };

      ws.onmessage = async (event) => {
        try {
          const data = await decodeJson(event.data);
          if (!data) return;
          if ((data as any).status === 'error' || (data as any).code != null && (data as any).type == null) return;
          if ((data as TradeWS).type !== 'trade') return;
          setTrades((prev) => [data as TradeWS, ...prev].slice(0, 50));
        } catch {
          // ignore
        }
      };

      ws.onerror = () => startPolling();

      ws.onclose = () => {
        startPolling();
        if (cancelled) return;
        reconnectTimer = setTimeout(connect, 3000);
      };
    };

    startPolling();
    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      stopPolling();
      if (wsRef.current) wsRef.current.close();
      wsRef.current = null;
    };
  }, [market]);

  return trades;
}
