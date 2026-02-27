import React, { useState } from 'react';
import styled from 'styled-components';
import Header from '../components/Header';
import Footer from '../components/Footer';

// ───────────── Types ─────────────
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
type AuthLevel = 'none' | 'user' | 'admin';

interface Param {
  name: string;
  in: 'path' | 'query' | 'body' | 'formData';
  required: boolean;
  type: string;
  description: string;
}

interface Endpoint {
  method: HttpMethod;
  path: string;
  summary: string;
  auth: AuthLevel;
  params?: Param[];
  requestBody?: string;
  responseExample?: string;
}

interface ApiGroup {
  tag: string;
  description: string;
  baseUrl: string;
  endpoints: Endpoint[];
}

// ───────────── API Data ─────────────
const API_GROUPS: ApiGroup[] = [
  {
    tag: '인증',
    description: '로그인, 회원가입, 회원 정보 관리',
    baseUrl: '/api/auth',
    endpoints: [
      {
        method: 'POST', path: '/api/auth/test/login', summary: '일반 로그인',
        auth: 'none',
        params: [
          { name: 'email', in: 'body', required: true, type: 'string', description: '이메일' },
          { name: 'password', in: 'body', required: true, type: 'string', description: '비밀번호' },
        ],
        responseExample: '{ "accessToken": "...", "refreshToken": "...", "role": "USER", "email": "...", "name": "..." }',
      },
      {
        method: 'POST', path: '/api/auth/admin/login', summary: '관리자 로그인',
        auth: 'none',
        params: [
          { name: 'email', in: 'body', required: true, type: 'string', description: '관리자 이메일' },
          { name: 'password', in: 'body', required: true, type: 'string', description: '비밀번호' },
        ],
        responseExample: '{ "accessToken": "...", "role": "ADMIN", "email": "...", "name": "..." }',
      },
      {
        method: 'GET', path: '/api/auth/me', summary: '내 정보 조회',
        auth: 'user',
        responseExample: '{ "memberId": 1, "email": "...", "name": "...", "role": "USER", "status": "ACTIVE", "totalVolume": "0", "referralCode": "..." }',
      },
      {
        method: 'PUT', path: '/api/auth/me', summary: '내 정보 수정',
        auth: 'user',
        params: [
          { name: 'name', in: 'body', required: false, type: 'string', description: '이름' },
          { name: 'phoneNumber', in: 'body', required: false, type: 'string', description: '전화번호' },
          { name: 'address', in: 'body', required: false, type: 'string', description: '주소' },
          { name: 'bankName', in: 'body', required: false, type: 'string', description: '은행명' },
          { name: 'accountNumber', in: 'body', required: false, type: 'string', description: '계좌번호' },
          { name: 'accountHolder', in: 'body', required: false, type: 'string', description: '예금주' },
        ],
        responseExample: '{ "message": "회원 정보가 수정되었습니다." }',
      },
      {
        method: 'POST', path: '/api/auth/me/id-photo', summary: '신분증 제출',
        auth: 'user',
        params: [
          { name: 'file', in: 'formData', required: true, type: 'file', description: '신분증 이미지 파일' },
        ],
        responseExample: '{ "message": "신분증이 제출되었습니다.", "status": "LOCKED", "idPhotoUrl": "..." }',
      },
      {
        method: 'POST', path: '/api/auth/signup/complete', summary: '회원가입 완료 (추가 정보 입력)',
        auth: 'user',
        params: [
          { name: 'data', in: 'formData', required: true, type: 'SignupRequestDto', description: '회원 가입 정보 (JSON part)' },
          { name: 'file', in: 'formData', required: true, type: 'file', description: '신분증 파일' },
        ],
        responseExample: '"<accessToken>"',
      },
      {
        method: 'POST', path: '/api/auth/withdraw', summary: '회원 탈퇴',
        auth: 'user',
        responseExample: '{ "message": "회원 탈퇴가 완료되었습니다." }',
      },
    ],
  },
  {
    tag: '자산',
    description: '사용자 보유 자산 조회, 입출금',
    baseUrl: '/api/assets',
    endpoints: [
      {
        method: 'GET', path: '/api/assets', summary: '전체 자산 목록 조회',
        auth: 'user',
        responseExample: '[{ "assetType": "KRW", "balance": "1000000.00", "locked": "0.00" }, ...]',
      },
      {
        method: 'GET', path: '/api/assets/summary', summary: '자산 요약 (총 평가금액)',
        auth: 'user',
        responseExample: '{ "totalKrw": "1000000", "totalAssetValue": "2500000" }',
      },
      {
        method: 'GET', path: '/api/assets/{assetType}', summary: '특정 자산 조회',
        auth: 'user',
        params: [
          { name: 'assetType', in: 'path', required: true, type: 'string', description: '자산 종류 (예: KRW, BTC)' },
        ],
        responseExample: '{ "assetType": "BTC", "balance": "0.5", "locked": "0.1" }',
      },
      {
        method: 'POST', path: '/api/assets/deposit', summary: '입금',
        auth: 'user',
        params: [
          { name: 'assetType', in: 'body', required: true, type: 'string', description: '자산 종류' },
          { name: 'amount', in: 'body', required: true, type: 'number', description: '입금 금액' },
        ],
        responseExample: '{ "assetType": "KRW", "balance": "2000000.00", "locked": "0.00" }',
      },
      {
        method: 'POST', path: '/api/assets/withdraw', summary: '출금',
        auth: 'user',
        params: [
          { name: 'assetType', in: 'body', required: true, type: 'string', description: '자산 종류' },
          { name: 'amount', in: 'body', required: true, type: 'number', description: '출금 금액' },
        ],
        responseExample: '{ "assetType": "KRW", "balance": "500000.00", "locked": "0.00" }',
      },
    ],
  },
  {
    tag: '주문',
    description: '매수/매도 주문 생성, 조회, 취소',
    baseUrl: '/api/orders',
    endpoints: [
      {
        method: 'POST', path: '/api/orders', summary: '주문 생성 (매수/매도)',
        auth: 'user',
        params: [
          { name: 'assetType', in: 'body', required: true, type: 'string', description: '자산 종류 (예: BTC)' },
          { name: 'orderType', in: 'body', required: true, type: 'string', description: 'BUY | SELL' },
          { name: 'priceType', in: 'body', required: true, type: 'string', description: 'LIMIT | MARKET' },
          { name: 'price', in: 'body', required: false, type: 'number', description: '지정가 (LIMIT 주문 시 필수)' },
          { name: 'quantity', in: 'body', required: true, type: 'number', description: '주문 수량' },
        ],
        responseExample: '{ "orderId": 1, "assetType": "BTC", "orderType": "BUY", "status": "PENDING", ... }',
      },
      {
        method: 'GET', path: '/api/orders', summary: '전체 주문 내역 조회',
        auth: 'user',
        responseExample: '[{ "orderId": 1, "assetType": "BTC", "orderType": "BUY", "status": "FILLED", ... }]',
      },
      {
        method: 'GET', path: '/api/orders/open', summary: '미체결 주문 조회',
        auth: 'user',
        responseExample: '[{ "orderId": 2, "status": "PENDING", ... }]',
      },
      {
        method: 'DELETE', path: '/api/orders/{orderId}', summary: '주문 취소',
        auth: 'user',
        params: [
          { name: 'orderId', in: 'path', required: true, type: 'number', description: '취소할 주문 ID' },
        ],
        responseExample: '{ "orderId": 2, "status": "CANCELLED", ... }',
      },
    ],
  },
  {
    tag: '커뮤니티',
    description: '게시글, 댓글, 좋아요 기능',
    baseUrl: '/api/community',
    endpoints: [
      {
        method: 'GET', path: '/api/community/posts', summary: '게시글 목록 조회',
        auth: 'none',
        params: [
          { name: 'keyword', in: 'query', required: false, type: 'string', description: '검색 키워드' },
        ],
        responseExample: '[{ "postId": 1, "title": "...", "authorName": "...", "likeCount": 5, "commentCount": 3, "createdAt": "..." }]',
      },
      {
        method: 'GET', path: '/api/community/posts/{postId}', summary: '게시글 상세 조회',
        auth: 'none',
        params: [
          { name: 'postId', in: 'path', required: true, type: 'number', description: '게시글 ID' },
        ],
        responseExample: '{ "postId": 1, "title": "...", "content": "...", "likeCount": 5, "isLiked": false, ... }',
      },
      {
        method: 'POST', path: '/api/community/posts', summary: '게시글 작성',
        auth: 'user',
        params: [
          { name: 'title', in: 'body', required: true, type: 'string', description: '제목' },
          { name: 'content', in: 'body', required: true, type: 'string', description: '내용' },
          { name: 'attachmentUrl', in: 'body', required: false, type: 'string', description: '첨부파일 URL' },
        ],
        responseExample: '{ "postId": 10, "title": "...", ... }',
      },
      {
        method: 'PUT', path: '/api/community/posts/{postId}', summary: '게시글 수정',
        auth: 'user',
        params: [
          { name: 'postId', in: 'path', required: true, type: 'number', description: '게시글 ID' },
          { name: 'title', in: 'body', required: false, type: 'string', description: '수정할 제목' },
          { name: 'content', in: 'body', required: false, type: 'string', description: '수정할 내용' },
        ],
      },
      {
        method: 'DELETE', path: '/api/community/posts/{postId}', summary: '게시글 삭제',
        auth: 'user',
        params: [
          { name: 'postId', in: 'path', required: true, type: 'number', description: '게시글 ID' },
        ],
      },
      {
        method: 'GET', path: '/api/community/posts/{postId}/comments', summary: '댓글 목록 조회',
        auth: 'none',
        params: [
          { name: 'postId', in: 'path', required: true, type: 'number', description: '게시글 ID' },
        ],
        responseExample: '[{ "commentId": 1, "content": "...", "authorName": "...", "createdAt": "..." }]',
      },
      {
        method: 'POST', path: '/api/community/posts/{postId}/comments', summary: '댓글 작성',
        auth: 'user',
        params: [
          { name: 'postId', in: 'path', required: true, type: 'number', description: '게시글 ID' },
          { name: 'content', in: 'body', required: true, type: 'string', description: '댓글 내용' },
        ],
      },
      {
        method: 'DELETE', path: '/api/community/comments/{commentId}', summary: '댓글 삭제',
        auth: 'user',
        params: [
          { name: 'commentId', in: 'path', required: true, type: 'number', description: '댓글 ID' },
        ],
      },
      {
        method: 'POST', path: '/api/community/posts/{postId}/like', summary: '게시글 좋아요 토글',
        auth: 'user',
        params: [
          { name: 'postId', in: 'path', required: true, type: 'number', description: '게시글 ID' },
        ],
        responseExample: '{ "likeCount": 6 }',
      },
      {
        method: 'POST', path: '/api/community/uploads', summary: '첨부파일 업로드',
        auth: 'none',
        params: [
          { name: 'file', in: 'formData', required: true, type: 'file', description: '업로드할 파일' },
        ],
        responseExample: '{ "attachmentUrl": "/uploads/..." }',
      },
    ],
  },
  {
    tag: '시장',
    description: 'Upbit 시세 데이터 (마켓, 현재가, 캔들, 호가창, 체결)',
    baseUrl: '/api/market',
    endpoints: [
      {
        method: 'GET', path: '/api/market/all', summary: '전체 마켓 목록',
        auth: 'none',
        responseExample: '[{ "market": "KRW-BTC", "korean_name": "비트코인", "english_name": "Bitcoin" }, ...]',
      },
      {
        method: 'GET', path: '/api/market/ticker', summary: '현재가(Ticker) 조회',
        auth: 'none',
        params: [
          { name: 'markets', in: 'query', required: true, type: 'string', description: '마켓 코드 (예: KRW-BTC,KRW-ETH)' },
        ],
        responseExample: '[{ "market": "KRW-BTC", "trade_price": 95000000, "change_rate": 0.012, ... }]',
      },
      {
        method: 'GET', path: '/api/market/candles/minutes/{unit}', summary: '분봉 캔들 조회',
        auth: 'none',
        params: [
          { name: 'unit', in: 'path', required: true, type: 'number', description: '분 단위 (1, 3, 5, 10, 15, 30, 60, 240)' },
          { name: 'market', in: 'query', required: true, type: 'string', description: '마켓 코드 (예: KRW-BTC)' },
          { name: 'count', in: 'query', required: false, type: 'number', description: '개수 (기본 200)' },
        ],
        responseExample: '[{ "market": "KRW-BTC", "candle_date_time_utc": "...", "opening_price": 94000000, "high_price": 96000000, ... }]',
      },
      {
        method: 'GET', path: '/api/market/candles/days', summary: '일봉 캔들 조회',
        auth: 'none',
        params: [
          { name: 'market', in: 'query', required: true, type: 'string', description: '마켓 코드' },
          { name: 'count', in: 'query', required: false, type: 'number', description: '개수 (기본 200)' },
        ],
      },
      {
        method: 'GET', path: '/api/market/orderbook', summary: '호가창 조회',
        auth: 'none',
        params: [
          { name: 'markets', in: 'query', required: true, type: 'string', description: '마켓 코드' },
        ],
        responseExample: '[{ "market": "KRW-BTC", "orderbook_units": [...] }]',
      },
      {
        method: 'GET', path: '/api/market/trades/ticks', summary: '체결 내역 조회',
        auth: 'none',
        params: [
          { name: 'market', in: 'query', required: true, type: 'string', description: '마켓 코드' },
          { name: 'count', in: 'query', required: false, type: 'number', description: '개수 (기본 50)' },
        ],
      },
    ],
  },
  {
    tag: '뉴스',
    description: '최신 암호화폐 뉴스 조회',
    baseUrl: '/api/news',
    endpoints: [
      {
        method: 'GET', path: '/api/news', summary: '최신 뉴스 목록',
        auth: 'none',
        responseExample: '[{ "title": "...", "url": "...", "publishedAt": "..." }]',
      },
    ],
  },
  {
    tag: '지갑',
    description: '암호화폐 입금 주소 조회 및 내부 이체',
    baseUrl: '/api/wallets',
    endpoints: [
      {
        method: 'GET', path: '/api/wallets/{assetType}/address', summary: '입금 주소 조회 (없으면 생성)',
        auth: 'user',
        params: [
          { name: 'assetType', in: 'path', required: true, type: 'string', description: '자산 종류 (예: BTC, ETH)' },
        ],
        responseExample: '{ "address": "1A1zP1eP5QGefi2DMPTfTL5SLmv7Divf..." }',
      },
      {
        method: 'POST', path: '/api/wallets/transfer', summary: '내부 이체 (주소 기반)',
        auth: 'user',
        params: [
          { name: 'assetType', in: 'body', required: true, type: 'string', description: '자산 종류' },
          { name: 'toAddress', in: 'body', required: true, type: 'string', description: '수신 지갑 주소' },
          { name: 'amount', in: 'body', required: true, type: 'number', description: '이체 수량' },
          { name: 'currentPrice', in: 'body', required: true, type: 'number', description: '현재 시세 (KRW)' },
        ],
        responseExample: '{ "message": "이체가 성공적으로 완료되었습니다." }',
      },
    ],
  },
  {
    tag: '거래내역',
    description: '사용자 거래 이력 조회',
    baseUrl: '/api/transactions',
    endpoints: [
      {
        method: 'GET', path: '/api/transactions', summary: '거래내역 조회',
        auth: 'user',
        params: [
          { name: 'assetType', in: 'query', required: false, type: 'string', description: '자산으로 필터링 (예: BTC)' },
        ],
        responseExample: '[{ "txId": 1, "assetType": "BTC", "txType": "BUY", "quantity": "0.1", "price": "90000000", "createdAt": "..." }]',
      },
    ],
  },
  {
    tag: '고객지원',
    description: 'FAQ 조회, 1:1 문의 작성 및 조회',
    baseUrl: '/api/support',
    endpoints: [
      {
        method: 'GET', path: '/api/support/faqs', summary: 'FAQ 목록 조회',
        auth: 'none',
        responseExample: '[{ "faqId": 1, "category": "계정", "question": "...", "answer": "..." }]',
      },
      {
        method: 'GET', path: '/api/support/inquiries', summary: '내 1:1 문의 내역 조회',
        auth: 'user',
        responseExample: '[{ "inquiryId": 1, "title": "...", "status": "PENDING", "reply": null, "createdAt": "..." }]',
      },
      {
        method: 'POST', path: '/api/support/inquiries', summary: '1:1 문의 작성',
        auth: 'user',
        params: [
          { name: 'title', in: 'formData', required: true, type: 'string', description: '문의 제목' },
          { name: 'content', in: 'formData', required: true, type: 'string', description: '문의 내용' },
          { name: 'file', in: 'formData', required: false, type: 'file', description: '첨부파일 (최대 10MB)' },
        ],
        responseExample: '{ "inquiryId": 2, "title": "...", "status": "PENDING", ... }',
      },
    ],
  },
  {
    tag: '관리자',
    description: '관리자 전용 API — 회원/주문/자산/거래/문의 관리',
    baseUrl: '/api/admin',
    endpoints: [
      {
        method: 'GET', path: '/api/admin/members', summary: '전체 회원 목록',
        auth: 'admin',
        responseExample: '[{ "memberId": 1, "email": "...", "name": "...", "role": "USER", "status": "ACTIVE" }, ...]',
      },
      {
        method: 'GET', path: '/api/admin/members/search', summary: '회원 검색 (페이지네이션)',
        auth: 'admin',
        params: [
          { name: 'q', in: 'query', required: false, type: 'string', description: '이름/이메일 검색어' },
          { name: 'role', in: 'query', required: false, type: 'string', description: 'USER | ADMIN | GUEST' },
          { name: 'status', in: 'query', required: false, type: 'string', description: 'ACTIVE | LOCKED | WITHDRAWN' },
          { name: 'page', in: 'query', required: false, type: 'number', description: '페이지 번호 (기본 0)' },
          { name: 'size', in: 'query', required: false, type: 'number', description: '페이지 크기 (기본 20)' },
        ],
        responseExample: '{ "content": [...], "totalPages": 3, "totalElements": 50 }',
      },
      {
        method: 'PATCH', path: '/api/admin/members/{memberId}/status', summary: '회원 상태 변경',
        auth: 'admin',
        params: [
          { name: 'memberId', in: 'path', required: true, type: 'number', description: '회원 ID' },
          { name: 'status', in: 'body', required: true, type: 'string', description: 'ACTIVE | LOCKED | WITHDRAWN' },
        ],
      },
      {
        method: 'PATCH', path: '/api/admin/members/{memberId}/approve-id', summary: '신분증 승인',
        auth: 'admin',
        params: [
          { name: 'memberId', in: 'path', required: true, type: 'number', description: '회원 ID' },
        ],
        responseExample: '{ "memberId": 1, "status": "ACTIVE" }',
      },
      {
        method: 'PATCH', path: '/api/admin/members/{memberId}/assets/reclaim', summary: '회원 자산 회수',
        auth: 'admin',
        params: [
          { name: 'memberId', in: 'path', required: true, type: 'number', description: '회원 ID' },
          { name: 'assetType', in: 'body', required: true, type: 'string', description: '자산 종류' },
          { name: 'amount', in: 'body', required: true, type: 'number', description: '회수 금액' },
          { name: 'reason', in: 'body', required: true, type: 'string', description: '회수 사유' },
        ],
      },
      {
        method: 'GET', path: '/api/admin/orders', summary: '전체 주문 목록',
        auth: 'admin',
      },
      {
        method: 'GET', path: '/api/admin/assets', summary: '전체 자산 목록',
        auth: 'admin',
      },
      {
        method: 'GET', path: '/api/admin/transactions', summary: '전체 거래내역',
        auth: 'admin',
      },
      {
        method: 'GET', path: '/api/admin/stats', summary: '시스템 통계',
        auth: 'admin',
        responseExample: '{ "totalMembers": 120, "totalOrders": 3400, "totalVolume": "..." }',
      },
      {
        method: 'GET', path: '/api/admin/transactions/search', summary: '거래내역 검색 (페이지네이션)',
        auth: 'admin',
        params: [
          { name: 'memberEmail', in: 'query', required: false, type: 'string', description: '이메일로 필터' },
          { name: 'assetType', in: 'query', required: false, type: 'string', description: '자산 종류' },
          { name: 'txType', in: 'query', required: false, type: 'string', description: '거래 유형' },
          { name: 'from', in: 'query', required: false, type: 'string', description: '시작 날짜 (ISO 8601)' },
          { name: 'to', in: 'query', required: false, type: 'string', description: '종료 날짜 (ISO 8601)' },
          { name: 'page', in: 'query', required: false, type: 'number', description: '페이지 번호 (기본 0)' },
          { name: 'size', in: 'query', required: false, type: 'number', description: '페이지 크기 (기본 20)' },
        ],
      },
      {
        method: 'GET', path: '/api/admin/inquiries', summary: '전체 1:1 문의 목록',
        auth: 'admin',
      },
      {
        method: 'PATCH', path: '/api/admin/inquiries/{inquiryId}/reply', summary: '문의 답변 등록',
        auth: 'admin',
        params: [
          { name: 'inquiryId', in: 'path', required: true, type: 'number', description: '문의 ID' },
          { name: 'reply', in: 'body', required: true, type: 'string', description: '답변 내용' },
          { name: 'status', in: 'body', required: false, type: 'string', description: '상태 (기본 ANSWERED)' },
        ],
      },
    ],
  },
];

// ───────────── Styled Components ─────────────
const Page = styled.div`
  min-height: 100vh;
  background: #f5f6f7;
  display: flex;
  flex-direction: column;
`;

const Body = styled.div`
  flex: 1;
  display: flex;
  max-width: 1200px;
  width: 100%;
  margin: 32px auto;
  padding: 0 20px;
  gap: 24px;
  align-items: flex-start;
`;

const Sidebar = styled.nav`
  width: 220px;
  flex-shrink: 0;
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  padding: 20px 0;
  position: sticky;
  top: 84px;
`;

const SidebarTitle = styled.div`
  font-size: 11px;
  font-weight: 700;
  color: #aaa;
  text-transform: uppercase;
  letter-spacing: 1px;
  padding: 0 20px 12px;
  border-bottom: 1px solid #f0f0f0;
  margin-bottom: 8px;
`;

const SidebarItem = styled.a<{ $active: boolean }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 20px;
  font-size: 14px;
  font-weight: ${p => p.$active ? 700 : 500};
  color: ${p => p.$active ? '#093687' : '#555'};
  background: ${p => p.$active ? '#eef2ff' : 'transparent'};
  text-decoration: none;
  cursor: pointer;
  transition: all 0.15s;
  border-left: 3px solid ${p => p.$active ? '#093687' : 'transparent'};
  &:hover {
    background: #f0f4ff;
    color: #093687;
  }
`;

const SidebarCount = styled.span`
  margin-left: auto;
  background: #e8ecf5;
  color: #667;
  font-size: 11px;
  font-weight: 700;
  border-radius: 10px;
  padding: 2px 7px;
`;

const Main = styled.main`
  flex: 1;
  min-width: 0;
`;

const PageHeader = styled.div`
  background: linear-gradient(135deg, #093687 0%, #1a5bc4 100%);
  border-radius: 16px;
  padding: 32px 36px;
  margin-bottom: 28px;
  color: white;
`;

const PageTitle = styled.h1`
  font-size: 26px;
  font-weight: 800;
  margin: 0 0 8px;
`;

const PageSubtitle = styled.p`
  font-size: 14px;
  opacity: 0.8;
  margin: 0;
`;

const SearchBox = styled.input`
  width: 100%;
  padding: 11px 16px;
  border: 1.5px solid #dde3ee;
  border-radius: 10px;
  font-size: 14px;
  margin-bottom: 24px;
  outline: none;
  background: white;
  box-sizing: border-box;
  &:focus {
    border-color: #093687;
    box-shadow: 0 0 0 3px rgba(9,54,135,0.08);
  }
`;

const GroupSection = styled.section`
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  margin-bottom: 24px;
  overflow: hidden;
`;

const GroupHeader = styled.div`
  padding: 20px 24px;
  border-bottom: 1px solid #eef0f5;
  display: flex;
  align-items: center;
  gap: 12px;
`;

const GroupTag = styled.h2`
  font-size: 17px;
  font-weight: 800;
  color: #1a2e57;
  margin: 0;
`;

const GroupBaseUrl = styled.code`
  font-size: 12px;
  color: #667;
  background: #f4f6fb;
  padding: 3px 8px;
  border-radius: 6px;
`;

const GroupDesc = styled.p`
  font-size: 13px;
  color: #888;
  margin: 0 0 0 auto;
`;

const EndpointRow = styled.div<{ $open: boolean }>`
  border-bottom: 1px solid #f4f6fb;
  &:last-child { border-bottom: none; }
`;

const EndpointHeader = styled.div<{ $method: HttpMethod }>`
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 24px;
  cursor: pointer;
  transition: background 0.15s;
  &:hover { background: #fafbff; }
`;

const METHOD_COLORS: Record<HttpMethod, { bg: string; color: string }> = {
  GET:    { bg: '#e8f5e9', color: '#2e7d32' },
  POST:   { bg: '#e3f2fd', color: '#1565c0' },
  PUT:    { bg: '#fff8e1', color: '#f57f17' },
  PATCH:  { bg: '#fce4ec', color: '#c62828' },
  DELETE: { bg: '#fbe9e7', color: '#bf360c' },
};

const MethodBadge = styled.span<{ $method: HttpMethod }>`
  font-size: 11px;
  font-weight: 800;
  padding: 4px 10px;
  border-radius: 6px;
  background: ${p => METHOD_COLORS[p.$method].bg};
  color: ${p => METHOD_COLORS[p.$method].color};
  min-width: 60px;
  text-align: center;
  flex-shrink: 0;
`;

const EndpointPath = styled.code`
  font-size: 14px;
  color: #333;
  font-family: 'Consolas', 'Fira Code', monospace;
`;

const EndpointSummary = styled.span`
  font-size: 13px;
  color: #777;
  margin-left: 4px;
`;

const AUTH_LABELS: Record<AuthLevel, { label: string; bg: string; color: string }> = {
  none:  { label: '공개', bg: '#f5f5f5', color: '#888' },
  user:  { label: '로그인 필요', bg: '#e8f0fe', color: '#1a73e8' },
  admin: { label: '관리자 전용', bg: '#fde8f0', color: '#c62828' },
};

const AuthBadge = styled.span<{ $auth: AuthLevel }>`
  font-size: 11px;
  font-weight: 700;
  padding: 3px 9px;
  border-radius: 20px;
  background: ${p => AUTH_LABELS[p.$auth].bg};
  color: ${p => AUTH_LABELS[p.$auth].color};
  margin-left: auto;
  flex-shrink: 0;
`;

const ChevronIcon = styled.span<{ $open: boolean }>`
  color: #aaa;
  font-size: 12px;
  flex-shrink: 0;
  transform: ${p => p.$open ? 'rotate(180deg)' : 'rotate(0)'};
  transition: transform 0.2s;
`;

const EndpointDetail = styled.div`
  padding: 0 24px 20px 24px;
  background: #fafbff;
  border-top: 1px solid #eef0f5;
`;

const DetailSection = styled.div`
  margin-top: 16px;
`;

const DetailLabel = styled.div`
  font-size: 12px;
  font-weight: 700;
  color: #093687;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
`;

const ParamTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
`;

const ParamTh = styled.th`
  text-align: left;
  padding: 7px 12px;
  background: #eef0f5;
  color: #555;
  font-weight: 600;
  font-size: 12px;
  &:first-child { border-radius: 6px 0 0 6px; }
  &:last-child { border-radius: 0 6px 6px 0; }
`;

const ParamTd = styled.td`
  padding: 7px 12px;
  border-bottom: 1px solid #f0f2f7;
  color: #444;
  vertical-align: top;
`;

const RequiredMark = styled.span`
  color: #c62828;
  font-weight: 700;
  margin-left: 2px;
`;

const ParamIn = styled.code`
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  background: #e8ecf5;
  color: #555;
`;

const CodeBlock = styled.pre`
  background: #1e2535;
  color: #a8d8a8;
  padding: 14px 18px;
  border-radius: 8px;
  font-size: 12px;
  overflow-x: auto;
  margin: 0;
  font-family: 'Consolas', 'Fira Code', monospace;
  line-height: 1.5;
`;

const StatsBanner = styled.div`
  display: flex;
  gap: 16px;
  margin-top: 16px;
  flex-wrap: wrap;
`;

const StatItem = styled.div`
  background: rgba(255,255,255,0.15);
  border-radius: 10px;
  padding: 12px 20px;
  text-align: center;
`;

const StatNum = styled.div`
  font-size: 22px;
  font-weight: 800;
`;

const StatDesc = styled.div`
  font-size: 12px;
  opacity: 0.8;
  margin-top: 2px;
`;

// ───────────── Component ─────────────
const ApiDocs: React.FC = () => {
  const [openEndpoint, setOpenEndpoint] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [activeTag, setActiveTag] = useState('인증');

  const totalEndpoints = API_GROUPS.reduce((s, g) => s + g.endpoints.length, 0);

  const filteredGroups = API_GROUPS.map(group => ({
    ...group,
    endpoints: group.endpoints.filter(ep => {
      if (!search) return true;
      const q = search.toLowerCase();
      return ep.path.toLowerCase().includes(q) || ep.summary.toLowerCase().includes(q);
    }),
  })).filter(g => g.endpoints.length > 0);

  const scrollToTag = (tag: string) => {
    const el = document.getElementById(`group-${tag}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActiveTag(tag);
  };

  return (
    <Page>
      <Header />
      <Body>
        {/* Sidebar */}
        <Sidebar>
          <SidebarTitle>API 그룹</SidebarTitle>
          {API_GROUPS.map(g => (
            <SidebarItem
              key={g.tag}
              $active={activeTag === g.tag}
              onClick={() => scrollToTag(g.tag)}
            >
              {g.tag}
              <SidebarCount>{g.endpoints.length}</SidebarCount>
            </SidebarItem>
          ))}
        </Sidebar>

        {/* Main Content */}
        <Main>
          <PageHeader>
            <PageTitle>API 명세</PageTitle>
            <PageSubtitle>VCE (Virtual Crypto Exchange) — 백엔드 REST API 문서</PageSubtitle>
            <StatsBanner>
              <StatItem><StatNum>{API_GROUPS.length}</StatNum><StatDesc>API 그룹</StatDesc></StatItem>
              <StatItem><StatNum>{totalEndpoints}</StatNum><StatDesc>전체 엔드포인트</StatDesc></StatItem>
              <StatItem>
                <StatNum style={{ fontSize: '14px', paddingTop: '4px' }}>
                  <span style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 6, padding: '2px 8px', marginRight: 4 }}>JWT</span>
                  Bearer Token
                </StatNum>
                <StatDesc>인증 방식</StatDesc>
              </StatItem>
            </StatsBanner>
          </PageHeader>

          <SearchBox
            placeholder="엔드포인트 경로 또는 설명으로 검색..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />

          {filteredGroups.map(group => (
            <GroupSection key={group.tag} id={`group-${group.tag}`}>
              <GroupHeader>
                <GroupTag>{group.tag}</GroupTag>
                <GroupBaseUrl>{group.baseUrl}</GroupBaseUrl>
                <GroupDesc>{group.description}</GroupDesc>
              </GroupHeader>

              {group.endpoints.map(ep => {
                const key = `${ep.method}-${ep.path}`;
                const isOpen = openEndpoint === key;

                return (
                  <EndpointRow key={key} $open={isOpen}>
                    <EndpointHeader
                      $method={ep.method}
                      onClick={() => setOpenEndpoint(isOpen ? null : key)}
                    >
                      <MethodBadge $method={ep.method}>{ep.method}</MethodBadge>
                      <EndpointPath>{ep.path}</EndpointPath>
                      <EndpointSummary>— {ep.summary}</EndpointSummary>
                      <AuthBadge $auth={ep.auth}>{AUTH_LABELS[ep.auth].label}</AuthBadge>
                      <ChevronIcon $open={isOpen}>▼</ChevronIcon>
                    </EndpointHeader>

                    {isOpen && (
                      <EndpointDetail>
                        {ep.auth !== 'none' && (
                          <DetailSection>
                            <DetailLabel>인증 헤더</DetailLabel>
                            <CodeBlock>{`Authorization: Bearer <accessToken>`}</CodeBlock>
                          </DetailSection>
                        )}

                        {ep.params && ep.params.length > 0 && (
                          <DetailSection>
                            <DetailLabel>파라미터</DetailLabel>
                            <ParamTable>
                              <thead>
                                <tr>
                                  <ParamTh>이름</ParamTh>
                                  <ParamTh>위치</ParamTh>
                                  <ParamTh>타입</ParamTh>
                                  <ParamTh>필수</ParamTh>
                                  <ParamTh>설명</ParamTh>
                                </tr>
                              </thead>
                              <tbody>
                                {ep.params.map(p => (
                                  <tr key={p.name}>
                                    <ParamTd>
                                      <code>{p.name}</code>
                                      {p.required && <RequiredMark>*</RequiredMark>}
                                    </ParamTd>
                                    <ParamTd><ParamIn>{p.in}</ParamIn></ParamTd>
                                    <ParamTd><code>{p.type}</code></ParamTd>
                                    <ParamTd>{p.required ? '필수' : '선택'}</ParamTd>
                                    <ParamTd>{p.description}</ParamTd>
                                  </tr>
                                ))}
                              </tbody>
                            </ParamTable>
                          </DetailSection>
                        )}

                        {ep.responseExample && (
                          <DetailSection>
                            <DetailLabel>응답 예시</DetailLabel>
                            <CodeBlock>{ep.responseExample}</CodeBlock>
                          </DetailSection>
                        )}
                      </EndpointDetail>
                    )}
                  </EndpointRow>
                );
              })}
            </GroupSection>
          ))}

          {filteredGroups.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#aaa', fontSize: '15px' }}>
              검색 결과가 없습니다.
            </div>
          )}
        </Main>
      </Body>
      <Footer />
    </Page>
  );
};

export default ApiDocs;
