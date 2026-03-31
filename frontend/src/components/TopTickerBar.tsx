'use client'

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import styled from 'styled-components';

export interface NoticePost {
  postId: number;
  title: string;
  createdAt: string | null;
  viewCount: number;
}

export interface NewsItem {
  title: string;
  link: string;
  source: string;
  pubDate: string;
}

type TopTickerItem =
  | { key: string; kind: 'notice'; title: string; href: string; rightText: string }
  | { key: string; kind: 'news'; title: string; href: string; rightText: string };

interface TopTickerBarProps {
  notices: NoticePost[];
  news: NewsItem[];
  noticeLimit?: number;     // default 5
  newsLimit?: number;       // default 5
  rowHeight?: number;       // default 44
  noticeIntervalMs?: number; // default 8000
  newsIntervalMs?: number;   // default 9000
  durationMs?: number;       // default 700
  emptyTextNotice?: string;  // default "등록된 공지사항이 없습니다."
  emptyTextNews?: string;    // default "뉴스를 불러오는 중..."
}

/* ───── styled ───── */

const Bar = styled.div`
  background: #fff;
  border: 1px solid #dfe7f6;
  border-radius: 14px;
  box-shadow: 0 8px 24px rgba(17, 32, 62, 0.06);
  overflow: hidden;
  margin-bottom: 18px;
`;

const RowLayout = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  align-items: center;

  @media (max-width: 768px) {
    grid-template-columns: 1fr; /* 모바일: 위아래 */
  }
`;

const Block = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 16px;
  min-height: 44px;

  &:first-child {
    border-right: 1px solid #f0f2f5;
  }

  @media (max-width: 768px) {
    &:first-child {
      border-right: none;
      border-bottom: 1px solid #f0f2f5;
    }
  }
`;

const Title = styled.span`
  font-size: 13px;
  font-weight: 800;
  color: #111;
  white-space: nowrap;
`;

const Wrap = styled.div<{ $rowHeight: number }>`
  height: ${({ $rowHeight }) => $rowHeight}px;
  overflow: hidden;
  flex: 1;
`;

const Track = styled.div<{ $y: number; $animate: boolean; $durationMs: number }>`
  transform: translateY(${({ $y }) => $y}px);
  transition: ${({ $animate, $durationMs }) => ($animate ? `transform ${$durationMs}ms ease` : 'none')};
`;

const Row = styled.div<{ $rowHeight: number }>`
  height: ${({ $rowHeight }) => $rowHeight}px;
  display: flex;
  align-items: center;
  gap: 12px;

  &:hover {
    background: #f8f9fa;
  }

  .tag {
    font-size: 12px;
    font-weight: 800;
    padding: 6px 10px;
    border-radius: 999px;
    background: #f0f2f5;
    color: #333;
    white-space: nowrap;
  }

  a {
    flex: 1;
    min-width: 0;
    color: #333;
    text-decoration: none;
    font-size: 14px;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;

    &:hover {
      color: #093687;
    }
  }

  .right {
    font-size: 12px;
    color: #999;
    margin-left: 16px;
    white-space: nowrap;
  }
`;

const InlineMsg = styled.span`
  font-size: 13px;
  color: #999;
`;

/* ───── helpers ───── */

function formatDate(val: string | null): string {
  if (!val) return '-';
  const d = new Date(val);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

/* ───── ticker unit ───── */

function OneLineRollingTicker({
  items,
  rowHeight,
  intervalMs,
  durationMs,
}: {
  items: TopTickerItem[];
  rowHeight: number;
  intervalMs: number;
  durationMs: number;
}) {
  const [idx, setIdx] = useState(0);
  const [animate, setAnimate] = useState(true);

  const viewItems = useMemo(() => {
    if (items.length === 0) return [];
    return [...items, items[0]]; // seamless loop
  }, [items]);

  useEffect(() => {
    setIdx(0);
    setAnimate(true);
  }, [items]);

  useEffect(() => {
    if (items.length <= 1) return;
    const t = window.setInterval(() => setIdx((prev) => prev + 1), intervalMs);
    return () => window.clearInterval(t);
  }, [items.length, intervalMs]);

  useEffect(() => {
    if (items.length === 0) return;
    if (idx === items.length) {
      const timer = window.setTimeout(() => {
        setAnimate(false);
        setIdx(0);
        requestAnimationFrame(() => setAnimate(true));
      }, durationMs + 20);
      return () => window.clearTimeout(timer);
    }
  }, [idx, items.length, durationMs]);

  if (items.length === 0) return null;

  const y = -idx * rowHeight;

  return (
    <Wrap $rowHeight={rowHeight}>
      <Track $y={y} $animate={animate} $durationMs={durationMs}>
        {viewItems.map((it, i) => (
          <Row key={`${it.key}-${i}`} $rowHeight={rowHeight}>
            <span className="tag">{it.kind === 'notice' ? '공지' : '뉴스'}</span>

            {it.kind === 'notice' ? (
              <Link href={it.href}>{it.title}</Link>
            ) : (
              <a href={it.href} target="_blank" rel="noopener noreferrer">
                {it.title}
              </a>
            )}

            <span className="right">{it.rightText}</span>
          </Row>
        ))}
      </Track>
    </Wrap>
  );
}

/* ───── main component ───── */

const TopTickerBar: React.FC<TopTickerBarProps> = ({
  notices,
  news,
  noticeLimit = 5,
  newsLimit = 5,
  rowHeight = 44,
  noticeIntervalMs = 8000,
  newsIntervalMs = 9000,
  durationMs = 700,
  emptyTextNotice = '등록된 공지사항이 없습니다.',
  emptyTextNews = '뉴스를 불러오는 중...',
}) => {
  const noticeItems = useMemo<TopTickerItem[]>(() => {
    return (notices ?? []).slice(0, noticeLimit).map((n) => ({
      key: `notice-${n.postId}`,
      kind: 'notice',
      title: n.title,
      href: `/community/${n.postId}`,
      rightText: formatDate(n.createdAt),
    }));
  }, [notices, noticeLimit]);

  const newsItems = useMemo<TopTickerItem[]>(() => {
    return (news ?? []).slice(0, newsLimit).map((n, idx) => ({
      key: `news-${idx}-${n.link}`,
      kind: 'news',
      title: n.title,
      href: n.link,
      rightText: n.pubDate,
    }));
  }, [news, newsLimit]);

  return (
    <Bar>
      <RowLayout>
        <Block>
          <Title>공지사항</Title>
          {noticeItems.length === 0 ? (
            <InlineMsg>{emptyTextNotice}</InlineMsg>
          ) : (
            <OneLineRollingTicker
              items={noticeItems}
              rowHeight={rowHeight}
              intervalMs={noticeIntervalMs}
              durationMs={durationMs}
            />
          )}
        </Block>

        <Block>
          <Title>코인뉴스</Title>
          {newsItems.length === 0 ? (
            <InlineMsg>{emptyTextNews}</InlineMsg>
          ) : (
            <OneLineRollingTicker
              items={newsItems}
              rowHeight={rowHeight}
              intervalMs={newsIntervalMs}
              durationMs={durationMs}
            />
          )}
        </Block>
      </RowLayout>
    </Bar>
  );
};

export default TopTickerBar;
