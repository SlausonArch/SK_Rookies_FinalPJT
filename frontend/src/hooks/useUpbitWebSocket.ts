import { useEffect, useRef, useState } from 'react';

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

export function useUpbitTicker(markets: string[]) {
  const [tickers, setTickers] = useState<Map<string, TickerWS>>(new Map());
  const wsRef = useRef<WebSocket | null>(null);
  const marketsKey = markets.join(',');

  useEffect(() => {
    if (markets.length === 0) return;

    const ws = new WebSocket('wss://api.upbit.com/websocket/v1');
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify([
        { ticket: 'vce-ticker' },
        { type: 'ticker', codes: markets }
      ]));
    };

    ws.onmessage = async (event) => {
      try {
        const text = event.data instanceof Blob
          ? await event.data.text()
          : event.data;
        const data: TickerWS = JSON.parse(text);
        setTickers(prev => {
          const next = new Map(prev);
          next.set(data.code, data);
          return next;
        });
      } catch { /* ignore parse errors */ }
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [marketsKey]);

  return tickers;
}

export function useUpbitOrderbook(market: string) {
  const [orderbook, setOrderbook] = useState<OrderbookWS | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!market) return;

    const ws = new WebSocket('wss://api.upbit.com/websocket/v1');
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify([
        { ticket: 'vce-orderbook' },
        { type: 'orderbook', codes: [market] }
      ]));
    };

    ws.onmessage = async (event) => {
      try {
        const text = event.data instanceof Blob
          ? await event.data.text()
          : event.data;
        const data: OrderbookWS = JSON.parse(text);
        setOrderbook(data);
      } catch { /* ignore */ }
    };

    return () => {
      ws.close();
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

    const ws = new WebSocket('wss://api.upbit.com/websocket/v1');
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify([
        { ticket: 'vce-trade' },
        { type: 'trade', codes: [market] }
      ]));
    };

    ws.onmessage = async (event) => {
      try {
        const text = event.data instanceof Blob
          ? await event.data.text()
          : event.data;
        const data: TradeWS = JSON.parse(text);
        setTrades(prev => [data, ...prev].slice(0, 50));
      } catch { /* ignore */ }
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [market]);

  return trades;
}
