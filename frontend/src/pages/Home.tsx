import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { fetchKRWMarkets, fetchTickers } from '../services/upbitApi';
import type { UpbitMarket, UpbitTicker } from '../services/upbitApi';
import { useUpbitTicker } from '../hooks/useUpbitWebSocket';
import axios from 'axios';

const API_BASE = 'http://localhost:8080';

interface NoticePost {
  postId: number;
  title: string;
  createdAt: string | null;
  viewCount: number;
}

const MainContainer = styled.div`
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: #f5f6f7;
`;

const ContentWrapper = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
  padding: 20px 16px;
  flex: 1;
`;

const HeroSection = styled.section`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 48px 40px;
  background: linear-gradient(135deg, #093687 0%, #1a5bc4 100%);
  border-radius: 14px;
  margin-bottom: 32px;
  color: #fff;
`;

const HeroText = styled.div`
  h2 {
    font-size: 32px;
    font-weight: 300;
    line-height: 1.4;
    margin: 0 0 8px;
    strong { font-weight: 700; }
  }
  p {
    font-size: 16px;
    opacity: 0.85;
    margin: 0;
  }
`;

const CTAButton = styled(Link)`
  display: inline-block;
  padding: 14px 32px;
  background: #fff;
  color: #093687;
  font-size: 16px;
  font-weight: 700;
  border-radius: 8px;
  text-decoration: none;
  transition: background 0.2s;
  &:hover { background: #e8edf5; }
`;

const SectionHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
`;

const SectionTitle = styled.h3`
  font-size: 20px;
  font-weight: 700;
  color: #333;
  margin: 0;
  cursor: default;
  user-select: none;
`;

const MoreLink = styled(Link)`
  font-size: 14px;
  color: #093687;
  text-decoration: none;
  font-weight: 600;
  &:hover { text-decoration: underline; }
`;

const CoinListSection = styled.section`
  background: #fff;
  border: 1px solid #dfe7f6;
  border-radius: 14px;
  box-shadow: 0 8px 24px rgba(17, 32, 62, 0.06);
  overflow: hidden;
  margin-bottom: 32px;
`;

const CoinTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  th {
    background: #f9fafc;
    color: #666;
    font-size: 13px;
    padding: 12px 16px;
    text-align: right;
    border-bottom: 1px solid #eee;
    &:first-child { text-align: left; padding-left: 20px; }
  }
  td {
    padding: 14px 16px;
    text-align: right;
    border-bottom: 1px solid #f4f4f4;
    font-size: 14px;
    color: #333;
    &:first-child { text-align: left; padding-left: 20px; }
  }
  tr {
    cursor: pointer;
    &:hover { background: #f8f9fa; }
  }
`;

const CoinName = styled.div`
  font-weight: 700;
  span { font-size: 11px; color: #999; margin-left: 6px; }
`;

const ChangeCell = styled.td<{ $change: string }>`
  color: ${p => p.$change === 'RISE' ? '#d60000' : p.$change === 'FALL' ? '#0051c7' : '#333'} !important;
  font-weight: 600;
`;

const NoticeSection = styled.section`
  background: #fff;
  border: 1px solid #dfe7f6;
  border-radius: 14px;
  box-shadow: 0 8px 24px rgba(17, 32, 62, 0.06);
  overflow: hidden;
  margin-bottom: 32px;
`;

const NoticeList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
`;

const NoticeItem = styled.li`
  padding: 14px 20px;
  border-bottom: 1px solid #f4f4f4;
  display: flex;
  justify-content: space-between;
  align-items: center;
  &:last-child { border-bottom: none; }
  &:hover { background: #f8f9fa; }
  a {
    color: #333;
    text-decoration: none;
    font-size: 14px;
    font-weight: 500;
    flex: 1;
    &:hover { color: #093687; }
  }
`;

const NoticeDate = styled.span`
  font-size: 12px;
  color: #999;
  margin-left: 16px;
  white-space: nowrap;
`;

const EmptyMessage = styled.div`
  padding: 32px;
  text-align: center;
  color: #999;
  font-size: 14px;
`;

function formatPrice(n: number): string {
  if (n >= 100) return n.toLocaleString('ko-KR', { maximumFractionDigits: 0 });
  if (n >= 1) return n.toLocaleString('ko-KR', { maximumFractionDigits: 2 });
  return n.toLocaleString('ko-KR', { maximumFractionDigits: 4 });
}

function formatVolume(n: number): string {
  if (n >= 1_000_000_000_000) return (n / 1_000_000_000_000).toFixed(1) + '조';
  if (n >= 100_000_000) return (n / 100_000_000).toFixed(0) + '억';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(0) + '백만';
  return n.toLocaleString('ko-KR', { maximumFractionDigits: 0 });
}

function formatDate(val: string | null): string {
  if (!val) return '-';
  const d = new Date(val);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

const Home: React.FC = () => {
  const [markets, setMarkets] = useState<UpbitMarket[]>([]);
  const [initialTickers, setInitialTickers] = useState<UpbitTicker[]>([]);
  const [notices, setNotices] = useState<NoticePost[]>([]);

  useEffect(() => {
    fetchKRWMarkets().then(setMarkets).catch(() => { });
  }, []);

  useEffect(() => {
    if (markets.length === 0) return;
    const codes = markets.map(m => m.market);
    fetchTickers(codes).then(setInitialTickers).catch(() => { });
  }, [markets]);

  useEffect(() => {
    axios.get(`${API_BASE}/api/community/posts`)
      .then(res => {
        const noticeList = (res.data as any[])
          .filter((p: any) => p.notice === true)
          .slice(0, 5);
        setNotices(noticeList);
      })
      .catch(() => { });
  }, []);

  const marketCodes = useMemo(() => markets.map(m => m.market), [markets]);
  const wsTickers = useUpbitTicker(marketCodes);

  const topCoins = useMemo(() => {
    const merged = markets.map(m => {
      const ws = wsTickers.get(m.market);
      const init = initialTickers.find(t => t.market === m.market);
      return {
        market: m.market,
        koreanName: m.korean_name,
        symbol: m.market.replace('KRW-', ''),
        tradePrice: ws?.trade_price ?? init?.trade_price ?? 0,
        changeRate: ws?.signed_change_rate ?? init?.signed_change_rate ?? 0,
        change: (ws?.change ?? init?.change ?? 'EVEN') as string,
        volume24h: ws?.acc_trade_price_24h ?? init?.acc_trade_price_24h ?? 0,
      };
    });
    return merged
      .sort((a, b) => b.volume24h - a.volume24h)
      .slice(0, 10);
  }, [markets, initialTickers, wsTickers]);

  const handleSecretDeposit = async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      alert('로그인이 필요합니다.');
      return;
    }

    try {
      const response = await axios.post(
        `${API_BASE}/api/assets/deposit`,
        {
          assetType: 'KRW',
          amount: 10000000
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      console.log('입금 성공:', response);

      if (response.status === 200) {
        alert('💰 1천만원이 입금되었습니다!\n입출금 페이지에서 확인하세요.');
        // 5초 후 입출금 페이지로 이동
        setTimeout(() => {
          window.location.href = '/balances';
        }, 1000);
      }
    } catch (error: any) {
      console.error('입금 실패:', error);
      console.error('응답 데이터:', error.response?.data);
      console.error('응답 상태:', error.response?.status);
      alert(`입금에 실패했습니다.\n오류: ${error.response?.data?.message || error.message}`);
    }
  };

  return (
    <MainContainer>
      <Header />
      <ContentWrapper>
        <HeroSection>
          <HeroText>
            <h2>
              대한민국<br />
              <strong>가장 신뢰받는<br />디지털 자산 거래소</strong>
            </h2>
            <p>실시간 시세 확인부터 안전한 거래까지</p>
          </HeroText>
          <CTAButton to="/exchange">거래소 둘러보기</CTAButton>
        </HeroSection>

        <SectionHeader>
          <SectionTitle onClick={handleSecretDeposit}>실시간 인기 코인</SectionTitle>
          <MoreLink to="/exchange">전체 보기 &gt;</MoreLink>
        </SectionHeader>
        <CoinListSection>
          <CoinTable>
            <thead>
              <tr>
                <th>코인명</th>
                <th>현재가(KRW)</th>
                <th>전일대비</th>
                <th>거래대금(24H)</th>
              </tr>
            </thead>
            <tbody>
              {topCoins.length === 0 ? (
                <tr><td colSpan={4} style={{ textAlign: 'center', color: '#999' }}>시세를 불러오는 중...</td></tr>
              ) : (
                topCoins.map(coin => (
                  <tr key={coin.market} onClick={() => window.location.href = `/exchange?market=${coin.market}`}>
                    <td>
                      <CoinName>
                        {coin.koreanName}
                        <span>{coin.symbol}/KRW</span>
                      </CoinName>
                    </td>
                    <td style={{ fontWeight: 600 }}>{formatPrice(coin.tradePrice)}</td>
                    <ChangeCell $change={coin.change}>
                      {coin.changeRate > 0 ? '+' : ''}{(coin.changeRate * 100).toFixed(2)}%
                    </ChangeCell>
                    <td>{formatVolume(coin.volume24h)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </CoinTable>
        </CoinListSection>

        <SectionHeader>
          <SectionTitle>공지사항</SectionTitle>
          <MoreLink to="/community">전체 보기 &gt;</MoreLink>
        </SectionHeader>
        <NoticeSection>
          {notices.length === 0 ? (
            <EmptyMessage>공지사항이 없습니다.</EmptyMessage>
          ) : (
            <NoticeList>
              {notices.map(n => (
                <NoticeItem key={n.postId}>
                  <Link to={`/community/${n.postId}`}>{n.title}</Link>
                  <NoticeDate>{formatDate(n.createdAt)}</NoticeDate>
                </NoticeItem>
              ))}
            </NoticeList>
          )}
        </NoticeSection>
      </ContentWrapper>
      <Footer />
    </MainContainer>
  );
};

export default Home;
