import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import Header from '../components/Header';
import Footer from '../components/Footer';
import TopTickerBar from '../components/TopTickerBar';
import type { NoticePost, NewsItem } from '../components/TopTickerBar';
import { fetchKRWMarkets, fetchTickers } from '../services/upbitApi';
import type { UpbitMarket, UpbitTicker } from '../services/upbitApi';
import { useUpbitTicker } from '../hooks/useUpbitWebSocket';
import axios from 'axios';

const API_BASE = 'http://localhost:8080';

const MainContainer = styled.div`
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: #f5f6f7;
`;

const ContentWrapper = styled.div`
  max-width: clamp(960px, 78vw, 1100px);
  margin: 0 auto;
  width: 100%;
  padding: 24px 20px;
  flex: 1;
`;

const Card = styled.section`
  background: #fff;
  border: 1px solid #dfe7f6;
  border-radius: 14px;
  box-shadow: 0 10px 26px rgba(17, 32, 62, 0.08);
  overflow: hidden;
`;

const HeroSection = styled.section`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 48px 34px;
  margin-bottom: 28px;
  color: #fff;
  border-radius: 14px;

  background:
    radial-gradient(700px 280px at 75% 35%, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 60%),
    linear-gradient(135deg, #093687 0%, #1a5bc4 100%);

  border: 1px solid rgba(255,255,255,0.12);
  box-shadow: 0 18px 48px rgba(9, 54, 135, 0.28);
`;

const HeroText = styled.div`
  h2 {
    font-size: 36px;
    font-weight: 300;
    line-height: 1.25;
    margin: 0 0 10px;
    letter-spacing: -0.6px;
    strong { font-weight: 800; }
  }
  p {
    font-size: 15px;
    opacity: 0.85;
    margin: 0;
  }
`;

const HeroActions = styled.div`
  width: 220px;
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const CTAButton = styled(Link)`
  width: 100%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 14px 32px;
  background: #fff;
  color: #093687;
  font-size: 15px;
  font-weight: 800;
  border-radius: 10px;
  text-decoration: none;
  transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;

  &:hover {
    background: #f3f6ff;
    transform: translateY(-2px);
    box-shadow: 0 12px 28px rgba(0,0,0,0.18);
  }
`;

const LoginButton = styled(Link)`
  width: 100%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 14px 32px;
  background: rgba(255,255,255,0.06);
  color: #fff;
  font-size: 15px;
  font-weight: 700;
  border-radius: 10px;
  text-decoration: none;
  border: 1px solid rgba(255,255,255,0.22);
  transition: transform 0.15s ease, background 0.15s ease;

  &:hover {
    background: rgba(255,255,255,0.10);
    transform: translateY(-1px);
  }
`;

const SectionHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 6px 0 14px;
`;

const SectionTitle = styled.h3`
  font-size: 20px;
  font-weight: 800;
  letter-spacing: -0.3px;
  color: #111;
  margin: 0;
  cursor: default;
  user-select: none;
`;

const MoreLink = styled(Link)`
  font-size: 14px;
  color: #093687;
  text-decoration: none;
  font-weight: 700;
  &:hover { text-decoration: underline; }
`;

const TabContainer = styled.div`
  display: flex;
  gap: 26px;
  border-bottom: 1px solid #e8ecf6;
  margin-bottom: 14px;
  padding: 0 2px;
`;

const TabButton = styled.button<{ active: boolean }>`
  background: none;
  border: none;
  padding: 12px 0;
  font-size: 15px;
  font-weight: ${({ active }) => (active ? 800 : 600)};
  color: ${({ active }) => (active ? '#111' : '#7a8699')};
  cursor: pointer;
  position: relative;
  letter-spacing: -0.2px;

  &::after {
    content: '';
    position: absolute;
    left: 0;
    bottom: -1px;
    width: 100%;
    height: 2px;
    background-color: ${({ active }) => (active ? '#111' : 'transparent')};
    transition: all 0.2s ease;
    border-radius: 999px;
  }

  &:hover { color: #111; }
`;

const CoinListSection = styled(Card)`
  overflow: auto;
  margin-bottom: 32px;
`;

const CoinTable = styled.table`
  width: 100%;
  border-collapse: collapse;

  th {
    background: #f9fafc;
    color: #667085;
    font-size: 12px;
    letter-spacing: -0.2px;
    padding: 12px 16px;
    text-align: right;
    border-bottom: 1px solid #eef1f6;
    &:first-child { text-align: left; padding-left: 20px; }
  }

  td {
    padding: 14px 16px;
    text-align: right;
    border-bottom: 1px solid #f3f4f6;
    font-size: 14px;
    color: #111;
    &:first-child { text-align: left; padding-left: 20px; }
  }

  tr {
    cursor: pointer;
    transition: background 0.12s ease;
    &:hover { background: #f7f9fc; }
  }
`;

const CoinName = styled.div`
  font-weight: 800;
  letter-spacing: -0.2px;
  span { font-size: 11px; color: #98a2b3; margin-left: 6px; font-weight: 700; }
`;

const ChangeCell = styled.td<{ $change: string }>`
  color: ${p => p.$change === 'RISE' ? '#d60000' : p.$change === 'FALL' ? '#0051c7' : '#111'} !important;
  font-weight: 700;
`;

const NoticeSection = styled(Card)`
  margin-bottom: 32px;
`;

const NoticeList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
`;

const NoticeItem = styled.li`
  padding: 14px 20px;
  border-bottom: 1px solid #f3f4f6;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: background 0.12s ease;

  &:last-child { border-bottom: none; }
  &:hover { background: #f7f9fc; }

  a {
    color: #111;
    text-decoration: none;
    font-size: 14px;
    font-weight: 600;
    flex: 1;
    letter-spacing: -0.2px;
    &:hover { color: #093687; }
  }
`;

const NoticeDate = styled.span`
  font-size: 12px;
  color: #98a2b3;
  margin-left: 16px;
  white-space: nowrap;
  font-weight: 600;
`;

const EmptyMessage = styled.div`
  padding: 32px;
  text-align: center;
  color: #98a2b3;
  font-size: 14px;
  font-weight: 600;
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

type RankingTab = 'popular' | 'rising' | 'falling' | 'volume' | 'new';

const Home: React.FC = () => {
  const [markets, setMarkets] = useState<UpbitMarket[]>([]);
  const [initialTickers, setInitialTickers] = useState<UpbitTicker[]>([]);
  const [notices, setNotices] = useState<NoticePost[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [activeTab, setActiveTab] = useState<RankingTab>('popular');
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(!!localStorage.getItem('accessToken'));

  const RANKING_TABS: { key: RankingTab; label: string }[] = [
    { key: 'popular', label: '인기' },
    { key: 'rising', label: '급등' },
    { key: 'falling', label: '급락' },
    { key: 'volume', label: '거래량' },
    { key: 'new', label: '신규상장' },
  ];
  const activeTabLabel = RANKING_TABS.find(tab => tab.key === activeTab)?.label ?? '인기';

  useEffect(() => {
    const handleStorage = () => setIsLoggedIn(!!localStorage.getItem('accessToken'));
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  useEffect(() => {
    fetchKRWMarkets().then(setMarkets).catch(() => {});
  }, []);

  useEffect(() => {
    if (markets.length === 0) return;
    const codes = markets.map(m => m.market);
    fetchTickers(codes).then(setInitialTickers).catch(() => {});
  }, [markets]);

  useEffect(() => {
    axios.get(`${API_BASE}/api/community/posts`)
      .then(res => {
        const noticeList = (res.data as any[])
          .filter((p: any) => p.notice === true)
          .slice(0, 10);
        setNotices(noticeList);
      })
      .catch(() => {});
  }, []);

  const loadNews = useCallback(async () => {
    try {
      const { data } = await axios.get<NewsItem[]>(`${API_BASE}/api/news`);
      setNews(data);
    } catch {}
  }, []);

  useEffect(() => {
    loadNews();
    const interval = setInterval(loadNews, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadNews]);

  const marketCodes = useMemo(() => markets.map(m => m.market), [markets]);
  const wsTickers = useUpbitTicker(marketCodes);

  const mergedCoins = useMemo(() => {
    return markets.map(m => {
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
  }, [markets, initialTickers, wsTickers]);

  const rankedCoins = useMemo(() => {
    if (!mergedCoins || mergedCoins.length === 0) return [];
    const copied = [...mergedCoins];
    switch (activeTab) {
      case 'rising':  return copied.sort((a, b) => b.changeRate - a.changeRate).slice(0, 10);
      case 'falling': return copied.sort((a, b) => a.changeRate - b.changeRate).slice(0, 10);
      case 'volume':  return copied.sort((a, b) => b.volume24h - a.volume24h).slice(0, 10);
      case 'new':
        return copied
          .sort((a, b) => {
            const aIdx = markets.findIndex(m => m.market === a.market);
            const bIdx = markets.findIndex(m => m.market === b.market);
            return bIdx - aIdx;
          })
          .slice(0, 10);
      default:
        return copied.sort((a, b) => b.volume24h - a.volume24h).slice(0, 10);
    }
  }, [mergedCoins, markets, activeTab]);

  const handleSecretDeposit = async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      alert('로그인이 필요합니다.');
      return;
    }

    try {
      const response = await axios.post(
        `${API_BASE}/api/assets/deposit`,
        { assetType: 'KRW', amount: 10000000 },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.status === 200) {
        alert('💰 1천만원이 입금되었습니다!\n입출금 페이지에서 확인하세요.');
        setTimeout(() => {
          window.location.href = '/balances';
        }, 1000);
      }
    } catch (error: any) {
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

          <HeroActions>
            <CTAButton to="/exchange">거래소 둘러보기</CTAButton>
            {!isLoggedIn && <LoginButton to="/login">로그인</LoginButton>}
          </HeroActions>
        </HeroSection>

        <TopTickerBar
          notices={notices}
          news={news}
          noticeIntervalMs={8000}
          newsIntervalMs={9000}
          durationMs={700}
          emptyTextNotice={notices.length === 0 ? '등록된 공지사항이 없습니다.' : '불러오는 중...'}
          emptyTextNews={'뉴스를 불러오는 중...'}
        />

        <SectionHeader>
          <SectionTitle onClick={handleSecretDeposit}>
            실시간 {activeTabLabel} 코인
          </SectionTitle>
          <MoreLink to="/exchange">전체 보기 &gt;</MoreLink>
        </SectionHeader>

        <TabContainer>
          {RANKING_TABS.map(tab => (
            <TabButton
              key={tab.key}
              active={activeTab === tab.key}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </TabButton>
          ))}
        </TabContainer>

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
              {rankedCoins.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', color: '#98a2b3', fontWeight: 600 }}>
                    시세를 불러오는 중...
                  </td>
                </tr>
              ) : (
                rankedCoins.map(coin => (
                  <tr
                    key={coin.market}
                    onClick={() => window.location.href = `/exchange?market=${coin.market}`}
                  >
                    <td>
                      <CoinName>
                        {coin.koreanName}
                        <span>{coin.symbol}/KRW</span>
                      </CoinName>
                    </td>
                    <td style={{ fontWeight: 700 }}>{formatPrice(coin.tradePrice)}</td>
                    <ChangeCell $change={coin.change}>
                      {coin.changeRate > 0 ? '+' : ''}
                      {(coin.changeRate * 100).toFixed(2)}%
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
              {notices.slice(0, 5).map(n => (
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
