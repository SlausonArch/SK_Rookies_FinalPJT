import { useState, useEffect, useCallback, useMemo, useRef, type ElementType } from 'react';
import styled, { createGlobalStyle } from 'styled-components';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import type { Post } from '../community/common';
import {
  LayoutDashboard,
  Users,
  BadgeCheck,
  ArrowLeftRight,
  Wallet,
  Banknote,
  MessageSquareText,
  Headset,
  Settings,
} from 'lucide-react';
import {
  clearAdminSession,
  getAdminAccessToken,
  getAdminName,
  getAdminRole,
  ADMIN_ACCESS_TOKEN_KEY,
} from '../../utils/auth';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

const COLORS = {
  appBg: '#F1F4F8',
  surface: '#FFFFFF',
  surface2: '#F7F9FC',
  border: '#D9E1EA',
  border2: '#E6EDF5',

  text: '#1F2A37',
  text2: '#334155',
  muted: '#64748B',
  muted2: '#94A3B8',

  sidebarBg: '#234C86',
  sidebarBg2: '#1F447A',
  sidebarBorder: 'rgba(255,255,255,0.12)',
  sidebarText: 'rgba(255,255,255,0.92)',
  sidebarTextMuted: 'rgba(255,255,255,0.62)',

  primary: '#2E6FB6',
  primaryHover: '#275F9B',
  primarySoft: '#E7F0FB',

  success: '#2CB67D',
  danger: '#E55353',
  warn: '#F0A202',
  info: '#2E6FB6',
};

const SHADOW = {
  topbar: '0 1px 8px rgba(31, 42, 55, 0.08)',
  card: '0 2px 10px rgba(31, 42, 55, 0.06)',
  panel: '0 1px 8px rgba(31, 42, 55, 0.06)',
  modal: '0 18px 50px rgba(15, 23, 42, 0.18)',
};

const GlobalStyle = createGlobalStyle`
  html, body, #root { height: 100%; }
  body { margin: 0; background: ${COLORS.appBg}; }
  * { box-sizing: border-box; }

  /* hide scrollbar (global) */
  * { scrollbar-width: none; -ms-overflow-style: none; }
  *::-webkit-scrollbar { width: 0; height: 0; }
`;

const Shell = styled.div`
  height: 100vh;
  background: ${COLORS.appBg};
  display: grid;
  grid-template-rows: 64px 1fr;
`;

const TopBar = styled.header`
  height: 64px;
  background: ${COLORS.surface};
  color: ${COLORS.text};
  box-shadow: ${SHADOW.topbar};
  border-bottom: 1px solid ${COLORS.border};
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 22px;
`;

const Brand = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  font-weight: 900;
  letter-spacing: -0.2px;
  min-width: 0;
`;

const BrandMark = styled.div`
  width: 34px;
  height: 34px;
  border-radius: 10px;
  background: ${COLORS.primarySoft};
  border: 1px solid rgba(30, 94, 255, 0.18);
  display: grid;
  place-items: center;
  font-weight: 950;
  color: ${COLORS.primary};
`;

const BrandText = styled.div`
  display: flex;
  flex-direction: column;
  line-height: 1.05;
  min-width: 0;
`;

const BrandTitle = styled.div`
  font-size: 16px;
  font-weight: 950;
`;





const TopBtn = styled.button`
  height: 36px;
  padding: 0 12px;
  border-radius: 10px;
  border: 1px solid ${COLORS.border};
  background: ${COLORS.surface};
  color: ${COLORS.text2};
  font-weight: 950;
  font-size: 12px;
  cursor: pointer;

  &:hover {
    background: ${COLORS.surface2};
  }
`;



const ToggleBtn = styled(TopBtn)`
  width: 36px;
  padding: 0;
  display: grid;
  place-items: center;
  font-size: 14px;
  font-weight: 950;
`;

const Body = styled.div<{ $collapsed: boolean }>`
  display: grid;
  grid-template-columns: ${p => (p.$collapsed ? '84px 1fr' : '260px 1fr')};
  min-height: 0;
  transition: grid-template-columns 180ms ease;
`;

const Sidebar = styled.aside<{ $collapsed: boolean }>`
  background: linear-gradient(180deg, ${COLORS.sidebarBg} 0%, ${COLORS.sidebarBg2} 100%);
  border-right: 1px solid ${COLORS.sidebarBorder};
  display: flex;
  flex-direction: column;
  min-height: 0;
  width: 100%;
  transition: width 180ms ease;
`;



const SideNav = styled.nav`
  padding: 12px 10px;
  overflow-y: auto;
`;

const SideSection = styled.div`
  margin-bottom: 14px;
`;

const SideSectionTitle = styled.div<{ $collapsed?: boolean }>`
  padding: 8px 10px 6px;
  font-size: 11px;
  font-weight: 950;
  color: ${COLORS.sidebarTextMuted};
  text-transform: uppercase;
  letter-spacing: 0.6px;
  ${p => (p.$collapsed ? 'opacity: 0; height: 0; padding: 0; margin: 0; overflow: hidden;' : '')}
`;

const SideItem = styled.div<{ $active?: boolean; $collapsed?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;

  padding: 11px 12px;
  margin: 4px 6px;
  border-radius: 12px;
  cursor: pointer;

  color: ${p => (p.$active ? '#FFFFFF' : COLORS.sidebarText)};
  background: ${p => (p.$active ? 'rgba(255, 255, 255, 0.14)' : 'transparent')};
  border: 1px solid ${p => (p.$active ? 'rgba(255, 255, 255, 0.22)' : 'transparent')};

  &:hover {
    background: ${p => (p.$active ? 'rgba(255, 255, 255, 0.14)' : 'rgba(255,255,255,0.10)')};
  }

  ${p => (p.$collapsed ? 'justify-content: center; padding: 11px 10px;' : '')}
`;

const SideLeft = styled.div<{ $collapsed?: boolean }>`
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  ${p => (p.$collapsed ? 'justify-content: center;' : '')}
`;

const SideIcon = styled.div<{ $active?: boolean }>`
  width: 28px;
  height: 28px;
  border-radius: 10px;
  display: grid;
  place-items: center;

  background: ${p => (p.$active ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.12)')};
  border: 1px solid ${p => (p.$active ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.18)')};

  color: rgba(255, 255, 255, 0.95);
  font-weight: 950;
  font-size: 12px;
`;

const SideText = styled.div<{ $collapsed?: boolean }>`
  display: flex;
  flex-direction: column;
  min-width: 0;
  ${p => (p.$collapsed ? 'display: none;' : '')}
`;

const SideLabel = styled.div`
  font-size: 13px;
  font-weight: 950;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const SideDesc = styled.div`
  margin-top: 2px;
  font-size: 11px;
  font-weight: 800;
  color: ${COLORS.sidebarTextMuted};
`;

/* ✅ (필수 수정) 빨간 알림 뱃지 */
const SideBadge = styled.div<{ $show?: boolean; $collapsed?: boolean }>`
  min-width: 22px;
  height: 22px;
  padding: 0 8px;
  border-radius: 999px;

  background: rgba(229, 83, 83, 0.95);
  border: 1px solid rgba(229, 83, 83, 0.85);
  color: #fff;

  font-size: 12px;
  font-weight: 950;

  display: ${p => (p.$show ? 'grid' : 'none')};
  place-items: center;

  ${p =>
    p.$collapsed
      ? `
        position: absolute;
        right: 10px;
        top: 10px;
        min-width: 20px;
        height: 20px;
        padding: 0 6px;
        font-size: 11px;
      `
      : ''}
`;

const SideFooter = styled.div<{ $collapsed: boolean }>`
  padding: 12px 12px;
  border-top: 1px solid ${COLORS.sidebarBorder};
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  ${p => (p.$collapsed ? 'justify-content: center; padding: 12px 10px;' : '')}
`;

const SideFooterUser = styled.div<{ $collapsed: boolean }>`
  display: flex;
  flex-direction: column;
  min-width: 0;
  ${p => (p.$collapsed ? 'display: none;' : '')}
`;

const SideFooterName = styled.div`
  color: rgba(255, 255, 255, 0.95);
  font-size: 13px;
  font-weight: 950;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const SideFooterRole = styled.div`
  margin-top: 2px;
  color: ${COLORS.sidebarTextMuted};
  font-size: 11px;
  font-weight: 800;
`;

const SideLogout = styled.button<{ $collapsed?: boolean }>`
  height: 34px;
  padding: 0 10px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.22);
  background: rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.95);
  font-weight: 950;
  font-size: 12px;
  cursor: pointer;

  &:hover {
    background: rgba(255, 255, 255, 0.16);
  }

  ${p => (p.$collapsed ? 'width: 34px; padding: 0; display: grid; place-items: center;' : '')}
`;

const Content = styled.main`
  min-height: 0;
  overflow-y: auto;
  padding: 18px 18px 26px;
`;

const Breadcrumb = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  color: ${COLORS.muted};
  font-size: 12px;
  font-weight: 800;
  margin-bottom: 12px;
`;

const PrimaryButton = styled.button`
  height: 38px;
  padding: 0 14px;
  background: ${COLORS.primary};
  color: #fff;
  border: 1px solid ${COLORS.primary};
  border-radius: 10px;
  font-size: 13px;
  font-weight: 950;
  cursor: pointer;

  &:hover {
    background: ${COLORS.primaryHover};
    border-color: ${COLORS.primaryHover};
  }
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const GhostButton = styled.button`
  height: 38px;
  padding: 0 14px;
  background: ${COLORS.surface};
  color: ${COLORS.text2};
  border: 1px solid ${COLORS.border};
  border-radius: 10px;
  font-size: 13px;
  font-weight: 900;
  cursor: pointer;

  &:hover {
    background: ${COLORS.surface2};
  }
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 14px;

  @media (max-width: 1100px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  @media (max-width: 720px) {
    grid-template-columns: 1fr;
  }
`;

const StatCard = styled.div`
  background: ${COLORS.surface};
  border: 1px solid ${COLORS.border};
  border-radius: 16px;
  box-shadow: ${SHADOW.card};
  padding: 14px;
`;

const StatTop = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
`;

const StatLabel = styled.div`
  font-size: 12px;
  color: ${COLORS.muted};
  font-weight: 900;
`;

const StatValue = styled.div`
  margin-top: 10px;
  font-size: 26px;
  color: ${COLORS.text};
  font-weight: 950;
  letter-spacing: -0.3px;
`;

const StatChip = styled.div`
  height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  background: ${COLORS.primarySoft};
  border: 1px solid rgba(46, 111, 182, 0.18);
  color: ${COLORS.primary};
  display: grid;
  place-items: center;
  font-size: 12px;
  font-weight: 950;
`;

const Card = styled.section`
  background: ${COLORS.surface};
  border: 1px solid ${COLORS.border};
  border-radius: 16px;
  box-shadow: ${SHADOW.card};
  padding: 16px;
  margin-bottom: 14px;
`;

const CardTitle = styled.div`
  font-size: 15px;
  color: ${COLORS.text};
  font-weight: 950;
  margin-bottom: 12px;
`;

const EmptyState = styled.div`
  padding: 46px 12px;
  text-align: center;
  color: ${COLORS.muted};
  font-weight: 800;
`;

const FilterRow = styled.div`
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items: center;
  margin-bottom: 12px;
`;

const ImageModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
`;

const ImageModalContent = styled.div`
  position: relative;
  background: #fff;
  padding: 8px;
  border-radius: 12px;
  max-width: 90vw;
  max-height: 90vh;
  box-shadow: 0 20px 40px rgba(0,0,0,0.2);
  
  img {
    max-width: 100%;
    max-height: calc(90vh - 16px);
    object-fit: contain;
    border-radius: 8px;
  }
`;

const CloseButton = styled.button`
  position: absolute;
  top: -16px;
  right: -16px;
  width: 32px;
  height: 32px;
  border-radius: 16px;
  background: #fff;
  border: none;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #333;
  
  &:hover {
    background: #f0f0f0;
  }
`;
const Input = styled.input`
  height: 38px;
  padding: 0 12px;
  background: ${COLORS.surface};
  border: 1px solid ${COLORS.border};
  border-radius: 10px;
  color: ${COLORS.text2};
  font-size: 13px;
  font-weight: 800;

  &::placeholder {
    color: ${COLORS.muted2};
    font-weight: 700;
  }

  &:focus {
    outline: none;
    border-color: rgba(46, 111, 182, 0.55);
    box-shadow: 0 0 0 3px rgba(46, 111, 182, 0.12);
  }
`;

const Select = styled.select`
  height: 38px;
  padding: 0 12px;
  background: ${COLORS.surface};
  border: 1px solid ${COLORS.border};
  border-radius: 10px;
  color: ${COLORS.text2};
  font-size: 13px;
  font-weight: 900;
  cursor: pointer;

  &:focus {
    outline: none;
    border-color: rgba(46, 111, 182, 0.55);
    box-shadow: 0 0 0 3px rgba(46, 111, 182, 0.12);
  }
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  border: 1px solid ${COLORS.border2};
  border-radius: 14px;
  overflow: hidden;

  th {
    text-align: left;
    padding: 12px;
    font-size: 12px;
    font-weight: 950;
    color: ${COLORS.muted};
    background: ${COLORS.surface2};
    border-bottom: 1px solid ${COLORS.border};
    white-space: nowrap;
  }
  td {
    padding: 12px;
    font-size: 13px;
    font-weight: 800;
    color: ${COLORS.text2};
    border-bottom: 1px solid ${COLORS.border2};
    vertical-align: middle;
  }
  tr:hover td {
    background: ${COLORS.surface2};
  }
`;

const Badge = styled.span<{ $tone: 'success' | 'danger' | 'warn' | 'info' | 'neutral' }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 6px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 950;

  border: 1px solid
    ${p =>
    p.$tone === 'success'
      ? 'rgba(44,182,125,0.25)'
      : p.$tone === 'danger'
        ? 'rgba(229,83,83,0.25)'
        : p.$tone === 'warn'
          ? 'rgba(240,162,2,0.25)'
          : p.$tone === 'info'
            ? 'rgba(46,111,182,0.25)'
            : 'rgba(100,116,139,0.25)'};

  background: ${p =>
    p.$tone === 'success'
      ? 'rgba(44,182,125,0.12)'
      : p.$tone === 'danger'
        ? 'rgba(229,83,83,0.12)'
        : p.$tone === 'warn'
          ? 'rgba(240,162,2,0.12)'
          : p.$tone === 'info'
            ? 'rgba(46,111,182,0.12)'
            : 'rgba(100,116,139,0.10)'};

  color: ${p =>
    p.$tone === 'success'
      ? COLORS.success
      : p.$tone === 'danger'
        ? COLORS.danger
        : p.$tone === 'warn'
          ? COLORS.warn
          : p.$tone === 'info'
            ? COLORS.info
            : COLORS.muted};
`;

const LinkCell = styled.div`
  max-width: 340px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
  color: ${COLORS.primary};
  font-weight: 950;
`;

const PaginationRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 12px;
  gap: 10px;
`;

const PageInfo = styled.div`
  color: ${COLORS.muted};
  font-size: 12px;
  font-weight: 900;
`;

const PageButtons = styled.div`
  display: flex;
  gap: 8px;
`;

const Msg = styled.div<{ $ok: boolean }>`
  padding: 10px 12px;
  border-radius: 14px;
  font-size: 13px;
  margin-bottom: 12px;
  font-weight: 950;

  border: 1px solid ${p => (p.$ok ? 'rgba(44,182,125,0.25)' : 'rgba(229,83,83,0.25)')};
  background: ${p => (p.$ok ? 'rgba(44,182,125,0.12)' : 'rgba(229,83,83,0.12)')};
  color: ${p => (p.$ok ? COLORS.success : COLORS.danger)};
`;

const ModalOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.58);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  padding: 18px;
`;

const ModalContainer = styled.div`
  background: ${COLORS.surface};
  border: 1px solid ${COLORS.border};
  border-radius: 18px;
  width: 560px;
  max-width: 100%;
  padding: 18px;
  box-shadow: ${SHADOW.modal};
`;

const ModalTitle = styled.h2`
  font-size: 16px;
  color: ${COLORS.text};
  margin: 0 0 10px 0;
  font-weight: 950;
`;

const ModalMeta = styled.div`
  margin-bottom: 12px;
  font-size: 12px;
  color: ${COLORS.muted};
  font-weight: 900;
`;


const ModalButtonGroup = styled.div`
  display: flex;
  gap: 10px;
  justify-content: flex-end;
`;

const ModalButton = styled.button<{ $variant?: 'primary' | 'danger' | 'ghost' }>`
  height: 38px;
  padding: 0 14px;
  border-radius: 10px;
  font-weight: 950;
  font-size: 13px;
  cursor: pointer;

  ${p => {
    if (p.$variant === 'primary') {
      return `
        background: ${COLORS.primary};
        border: 1px solid ${COLORS.primary};
        color: #fff;
        &:hover { background: ${COLORS.primaryHover}; border-color: ${COLORS.primaryHover}; }
      `;
    }
    if (p.$variant === 'danger') {
      return `
        background: ${COLORS.danger};
        border: 1px solid ${COLORS.danger};
        color: #fff;
        &:hover { filter: brightness(0.96); }
      `;
    }
    return `
      background: ${COLORS.surface};
      border: 1px solid ${COLORS.border};
      color: ${COLORS.text2};
      &:hover { background: ${COLORS.surface2}; }
    `;
  }}
`;

const Textarea = styled.textarea`
  width: 100%;
  padding: 12px 12px;
  background: ${COLORS.surface};
  color: ${COLORS.text2};
  border: 1px solid ${COLORS.border};
  border-radius: 14px;
  min-height: 120px;
  font-size: 13px;
  font-weight: 800;
  resize: vertical;

  &::placeholder {
    color: ${COLORS.muted2};
    font-weight: 700;
  }

  &:focus {
    outline: none;
    border-color: rgba(46, 111, 182, 0.55);
    box-shadow: 0 0 0 3px rgba(46, 111, 182, 0.12);
  }
`;

const FormGrid = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 10px;
  margin-bottom: 14px;
`;

const FieldLabel = styled.label`
  display: flex;
  flex-direction: column;
  gap: 6px;
  color: ${COLORS.text2};
  font-size: 12px;
  font-weight: 900;
`;

const InlineActions = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
`;

const UploadMeta = styled.div`
  color: ${COLORS.muted};
  font-size: 12px;
  font-weight: 800;
`;

interface MemberRow {
  memberId: number;
  email: string;
  name: string;
  phoneNumber: string | null;
  role: string;
  status: string;
  hasIdPhoto?: boolean;
  idPhotoUrl?: string;
  createdAt: string | null;
}
interface OrderRow {
  orderId: number;
  memberEmail: string;
  memberName: string;
  orderType: string;
  assetType: string;
  price: number;
  amount: number;
  filledAmount: number;
  status: string;
  createdAt: string | null;
}
interface AssetRow {
  assetId: number;
  memberId: number;
  memberEmail: string;
  memberName: string;
  assetType: string;
  balance: number;
  lockedBalance: number;
}
interface TxRow {
  txId: number;
  memberEmail: string;
  memberName: string;
  txType: string;
  assetType: string;
  amount: number;
  price: number | null;
  totalValue: number | null;
  fee: number | null;
  txDate: string | null;
}
interface InquiryRow {
  inquiryId: number;
  memberEmail: string;
  memberName: string;
  title: string;
  content: string;
  status: string;
  reply: string | null;
  attachmentUrl: string | null;
  createdAt: string | null;
}
interface Stats {
  totalMembers: number;
  activeMembers: number;
  totalOrders: number;
  totalKrwBalance: number;
  totalTransactions: number;
}

type Paged<T> = {
  content: T[];
  totalElements: number;
  totalPages: number;
  page: number;
};

function fmt(n: number, d = 0) {
  return n.toLocaleString('ko-KR', { maximumFractionDigits: d });
}
function fmtDate(v: string | null) {
  if (!v) return '-';
  // Java LocalDateTime은 타임존 없이 직렬화됨 → 'Z' 추가로 UTC 파싱 후 KST(+9) 변환
  const utcStr = v.endsWith('Z') ? v : v + 'Z';
  return new Date(utcStr).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
}

function toneFromStatus(s: string): 'success' | 'danger' | 'warn' | 'info' | 'neutral' {
  if (s === 'ACTIVE') return 'success';
  if (s === 'LOCKED') return 'danger';
  if (s === 'AUTH_FAILED') return 'danger';
  if (s === 'WITHDRAWN') return 'neutral';
  if (s === 'PENDING') return 'warn';
  if (s === 'ANSWERED') return 'success';
  if (s === 'OPEN') return 'info';
  return 'warn';
}
function toneFromRole(r: string): 'info' | 'neutral' {
  return r === 'VCESYS_CORE' ? 'info' : 'neutral';
}
function toneFromOrderType(t: string): 'danger' | 'info' {
  return t === 'BUY' ? 'danger' : 'info';
}
// /uploads/uuid.jpg → /api/files/id-photo/uuid.jpg (인증 필요 엔드포인트)
function toIdPhotoUrl(raw: string): string {
  if (!raw) return '';
  if (raw.startsWith('http')) return raw;
  const filename = raw.split('/').pop() ?? '';
  return `${API_BASE}/api/files/id-photo/${filename}`;
}

function toneFromTxType(t: string): 'success' | 'danger' | 'warn' | 'info' | 'neutral' {
  if (t === 'BUY') return 'danger';
  if (t === 'SELL') return 'info';
  if (t === 'DEPOSIT') return 'success';
  if (t === 'WITHDRAW') return 'warn';
  if (t === 'ADMIN_RECLAIM') return 'danger';
  return 'neutral';
}

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [activeMenu, setActiveMenu] = useState<
    'dashboard' | 'members' | 'idApprovals' | 'orders' | 'assets' | 'deposits' | 'community' | 'inquiries' | 'settings'
  >('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const userName = getAdminName() || '관리자';
  const [token, setToken] = useState<string | null>(getAdminAccessToken);

  const [stats, setStats] = useState<Stats | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [idApprovalMembers, setIdApprovalMembers] = useState<MemberRow[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [transactions, setTransactions] = useState<TxRow[]>([]);
  const [inquiries, setInquiries] = useState<InquiryRow[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [noticeForm, setNoticeForm] = useState({ title: '', content: '', attachmentUrl: '' });
  const [noticeMsg, setNoticeMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [savingNotice, setSavingNotice] = useState(false);
  const [uploadingNoticeAttachment, setUploadingNoticeAttachment] = useState(false);

  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [selectedInquiry, setSelectedInquiry] = useState<InquiryRow | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const currentBlobUrl = useRef<string | null>(null);

  const openIdPhoto = useCallback(async (raw: string) => {
    const url = toIdPhotoUrl(raw);
    if (!url) return;
    try {
      const token = getAdminAccessToken();
      const res = await axios.get(url, {
        responseType: 'blob',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (currentBlobUrl.current) URL.revokeObjectURL(currentBlobUrl.current);
      const blobUrl = URL.createObjectURL(res.data);
      currentBlobUrl.current = blobUrl;
      setSelectedImage(blobUrl);
    } catch {
      alert('이미지를 불러올 수 없습니다.');
    }
  }, []);

  const closeIdPhoto = useCallback(() => {
    if (currentBlobUrl.current) {
      URL.revokeObjectURL(currentBlobUrl.current);
      currentBlobUrl.current = null;
    }
    setSelectedImage(null);
  }, []);
  const [reclaimTarget, setReclaimTarget] = useState<AssetRow | null>(null);
  const [reclaimAmount, setReclaimAmount] = useState('');
  const [reclaimReason, setReclaimReason] = useState('');
  const [isReclaiming, setIsReclaiming] = useState(false);

  const [selectedMemberDetails, setSelectedMemberDetails] = useState<any | null>(null);
  // V-05: 게시글 댓글 상태 (Stored XSS 실습용)
  const [postComments, setPostComments] = useState<any[]>([]);

  const [settingsMsg, setSettingsMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [newPw, setNewPw] = useState('');

  // 직원 관리 상태
  const [staffList, setStaffList] = useState<Array<{
    memberId: number;
    email: string;
    name: string;
    role: string;
    status: string;
    createdAt: string;
    passwordNeedsUpdate: boolean;
  }>>([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffForm, setStaffForm] = useState({ email: '', password: '', name: '', role: 'VCESYS_EMP' });
  const [staffMsg, setStaffMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [staffDeleteConfirm, setStaffDeleteConfirm] = useState<number | null>(null);

  const [memberQuery, setMemberQuery] = useState({ q: '', role: '', status: '', page: 0, size: 20 });
  const [memberTotal, setMemberTotal] = useState(0);
  const [memberTotalPages, setMemberTotalPages] = useState(0);

  const [txQuery, setTxQuery] = useState({
    memberEmail: '',
    assetType: '',
    txType: '',
    from: '',
    to: '',
    page: 0,
    size: 20,
  });
  const [txTotal, setTxTotal] = useState(0);
  const [txTotalPages, setTxTotalPages] = useState(0);

  // 마운트 시 인증 확인 + 다른 탭 로그아웃 감지
  useEffect(() => {
    const isAllowedRole = (r: string | null) =>
      r === 'VCESYS_CORE' || r === 'VCESYS_MGMT' || r === 'VCESYS_EMP';

    const checkAuth = () => {
      const currentToken = getAdminAccessToken();
      const r = getAdminRole();
      if (!currentToken || !isAllowedRole(r)) {
        navigate('/admin/login', { replace: true });
        return;
      }
      setToken(currentToken);
      // EMP는 접근 가능한 첫 메뉴(community)로 기본 진입
      if (r === 'VCESYS_EMP') {
        setActiveMenu('community');
      }
    };

    checkAuth();

    const handleStorage = (e: Event) => {
      if (e instanceof StorageEvent) {
        // 다른 탭에서 발생한 네이티브 이벤트: admin 토큰 키 변경 시에만 인증 확인
        if (e.key === null || e.key === ADMIN_ACCESS_TOKEN_KEY) {
          checkAuth();
        }
        return;
      }
      // dispatchAuthChange()가 발생시킨 합성 이벤트:
      // 토큰이 실제로 없을 때만 로그인으로 이동 (토큰 동기화 중 오탐 방지)
      const currentToken = getAdminAccessToken();
      if (!currentToken) {
        navigate('/admin/login', { replace: true });
        return;
      }
      const r = getAdminRole();
      if (isAllowedRole(r)) {
        setToken(currentToken);
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [navigate]);

  // 30분 유휴 시 자동 로그아웃
  useEffect(() => {
    const IDLE_MS = 30 * 60 * 1000;
    let timer: ReturnType<typeof setTimeout>;

    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        clearAdminSession(true);
        navigate('/admin/login', { replace: true });
      }, IDLE_MS);
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(e => window.addEventListener(e, reset));
    reset();

    return () => {
      clearTimeout(timer);
      events.forEach(e => window.removeEventListener(e, reset));
    };
  }, [navigate]);


  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const fetchData = useCallback(() => {
    if (!token) return;
    const h = { Authorization: `Bearer ${token}` };

    if (activeMenu === 'dashboard') {
      axios.get(`${API_BASE}/api/admin/stats`, { headers: h }).then(r => setStats(r.data)).catch(() => { });
      return;
    }

    if (activeMenu === 'members') {
      axios
        .get<Paged<MemberRow>>(`${API_BASE}/api/admin/members/search`, {
          headers: h,
          params: {
            q: memberQuery.q || undefined,
            role: memberQuery.role || undefined,
            status: memberQuery.status || undefined,
            page: memberQuery.page,
            size: memberQuery.size,
          },
        })
        .then(r => {
          setMembers(r.data.content);
          setMemberTotal(r.data.totalElements);
          setMemberTotalPages(r.data.totalPages);
        })
        .catch(() => { });
      return;
    }

    if (activeMenu === 'idApprovals') {
      axios
        .get<MemberRow[]>(`${API_BASE}/api/admin/members`, { headers: h })
        .then(r => setIdApprovalMembers(r.data))
        .catch(() => { });
      return;
    }

    if (activeMenu === 'orders') {
      axios.get(`${API_BASE}/api/admin/orders`, { headers: h }).then(r => setOrders(r.data)).catch(() => { });
      return;
    }

    if (activeMenu === 'assets') {
      axios.get(`${API_BASE}/api/admin/assets`, { headers: h }).then(r => setAssets(r.data)).catch(() => { });
      return;
    }

    if (activeMenu === 'deposits') {
      axios
        .get<Paged<TxRow>>(`${API_BASE}/api/admin/transactions/search`, {
          headers: h,
          params: {
            memberEmail: txQuery.memberEmail || undefined,
            assetType: txQuery.assetType || undefined,
            txType: txQuery.txType || undefined,
            from: txQuery.from || undefined,
            to: txQuery.to || undefined,
            page: txQuery.page,
            size: txQuery.size,
          },
        })
        .then(r => {
          setTransactions(r.data.content);
          setTxTotal(r.data.totalElements);
          setTxTotalPages(r.data.totalPages);
        })
        .catch(() => { });
      return;
    }

    if (activeMenu === 'inquiries') {
      axios.get(`${API_BASE}/api/admin/inquiries`, { headers: h }).then(r => setInquiries(r.data)).catch(() => { });
      return;
    }

    if (activeMenu === 'community') {
      axios.get(`${API_BASE}/api/community/posts`).then(r => setPosts(r.data.content || r.data)).catch(() => { });
    }

    if (activeMenu === 'settings') {
      setStaffLoading(true);
      axios
        .get(`${API_BASE}/api/admin/staff`, { headers: h })
        .then(r => setStaffList(r.data))
        .catch(() => { })
        .finally(() => setStaffLoading(false));

    }
  }, [activeMenu, token, txQuery, memberQuery]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleStatusChange = async (memberId: number, newStatus: string) => {
    try {
      await axios.patch(`${API_BASE}/api/admin/members/${memberId}/status`, { status: newStatus }, { headers });
      setMembers(prev => prev.map(m => (m.memberId === memberId ? { ...m, status: newStatus } : m)));
    } catch {
      alert('상태 변경 실패');
    }
  };

  const handleViewMemberDetails = async (memberId: number) => {
    try {
      const res = await axios.get(`${API_BASE}/api/admin/members/${memberId}`, { headers });
      setSelectedMemberDetails(res.data);
    } catch (err: any) {
      alert(err?.response?.data?.message || '회원 상세 정보 조회 실패');
    }
  };

  const handleUnmask = async (memberId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const role = getAdminRole();
    if (role !== 'VCESYS_CORE') {
      alert('ADMIN 권한만 마스킹 해제가 가능합니다.');
      return;
    }

    const isCurrentlyUnmasked = members.some(m => m.memberId === memberId && (m as any)._unmasked) ||
      orders.some(o => (o as any).memberId === memberId && (o as any)._unmasked) ||
      assets.some(a => a.memberId === memberId && (a as any)._unmasked) ||
      transactions.some(t => (t as any).memberId === memberId && (t as any)._unmasked) ||
      inquiries.some(i => (i as any).memberId === memberId && (i as any)._unmasked);

    if (isCurrentlyUnmasked) {
      // 재마스킹: 마스킹된 데이터로 복원
      try {
        const res = await axios.get(`${API_BASE}/api/admin/members/${memberId}`, { headers });
        const data = res.data;
        const revertData = (prev: any[]) =>
          prev.map(item =>
            item.memberId === memberId
              ? { ...item, email: data.email, memberEmail: data.email, name: data.name, memberName: data.name, phoneNumber: data.phoneNumber, _unmasked: false }
              : item
          );
        setMembers(revertData);
        setIdApprovalMembers(revertData);
        setOrders(revertData);
        setAssets(revertData);
        setTransactions(revertData);
        setInquiries(revertData);
      } catch {
        const revertData = (prev: any[]) =>
          prev.map(item => item.memberId === memberId ? { ...item, _unmasked: false } : item);
        setMembers(revertData);
        setIdApprovalMembers(revertData);
        setOrders(revertData);
        setAssets(revertData);
        setTransactions(revertData);
        setInquiries(revertData);
      }
      return;
    }

    try {
      const res = await axios.get(`${API_BASE}/api/admin/members/${memberId}/unmask`, { headers });
      const data = res.data;

      const updateData = (prev: any[]) =>
        prev.map(item =>
          item.memberId === memberId
            ? {
              ...item,
              email: data.email,
              memberEmail: data.email,
              name: data.name,
              memberName: data.name,
              phoneNumber: data.phoneNumber,
              _unmasked: true,
            }
            : item
        );

      setMembers(updateData);
      setIdApprovalMembers(updateData);
      setOrders(updateData);
      setAssets(updateData);
      setTransactions(updateData);
      setInquiries(updateData);
    } catch (err: any) {
      alert(err?.response?.data?.message || '마스킹 해제 실패');
    }
  };

  // V-05: 어드민이 게시글을 열 때 댓글을 조회합니다.
  // 취약점: 댓글 내용이 dangerouslySetInnerHTML로 화면에 출력되므로 Stored XSS 가능
  const fetchPostComments = async (postId: number) => {
    try {
      const res = await axios.get(`${API_BASE}/api/community/posts/${postId}/comments`, { headers });
      setPostComments(res.data || []);
    } catch {
      setPostComments([]);
    }
  };

  const handleApproveIdPhoto = async (memberId: number) => {
    try {
      await axios.patch(`${API_BASE}/api/admin/members/${memberId}/approve-id`, {}, { headers });
      setIdApprovalMembers(prev => prev.map(m => (m.memberId === memberId ? { ...m, status: 'ACTIVE' } : m)));
      setMembers(prev => prev.map(m => (m.memberId === memberId ? { ...m, status: 'ACTIVE' } : m)));
      alert('신분증 승인 완료: 회원 상태가 ACTIVE로 변경되었습니다.');
    } catch (err: any) {
      alert(err?.response?.data?.message || '신분증 승인 처리에 실패했습니다.');
    }
  };

  const openReclaimModal = (asset: AssetRow) => {
    setReclaimTarget(asset);
    setReclaimAmount('');
    setReclaimReason('');
  };

  const closeReclaimModal = () => {
    if (isReclaiming) return;
    setReclaimTarget(null);
    setReclaimAmount('');
    setReclaimReason('');
  };

  const handleReclaimAsset = async () => {
    if (!reclaimTarget) return;

    const parsedAmount = Number(reclaimAmount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      alert('회수 수량은 0보다 커야 합니다.');
      return;
    }
    if (!reclaimReason.trim()) {
      alert('회수 사유를 입력해 주세요.');
      return;
    }

    try {
      setIsReclaiming(true);
      const response = await axios.patch(
        `${API_BASE}/api/admin/members/${reclaimTarget.memberId}/assets/reclaim`,
        {
          assetType: reclaimTarget.assetType,
          amount: reclaimAmount,
          reason: reclaimReason.trim(),
        },
        { headers }
      );

      setReclaimTarget(null);
      setReclaimAmount('');
      setReclaimReason('');
      fetchData();
      alert(response?.data?.message || '자산 회수가 완료되었습니다.');
    } catch (err: any) {
      alert(err?.response?.data?.message || '자산 회수에 실패했습니다.');
    } finally {
      setIsReclaiming(false);
    }
  };

  const handleDeletePost = async (postId: number) => {
    if (!confirm('게시글을 삭제하시겠습니까?')) return;
    try {
      await axios.delete(`${API_BASE}/api/community/posts/${postId}`, { headers });
      setPosts(prev => prev.filter((p: any) => p.postId !== postId));
    } catch {
      alert('삭제 실패');
    }
  };

  const handleNoticeUpload = async (file: File | null) => {
    if (!file || !token) return;

    setUploadingNoticeAttachment(true);
    setNoticeMsg(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await axios.post<{ attachmentUrl: string }>(`${API_BASE}/api/community/uploads`, formData, {
        headers: { ...headers },
      });

      setNoticeForm(prev => ({ ...prev, attachmentUrl: response.data.attachmentUrl }));
      setNoticeMsg({ text: '첨부 파일 업로드가 완료되었습니다.', ok: true });
    } catch (err: any) {
      setNoticeMsg({ text: err.response?.data?.message || '첨부 파일 업로드에 실패했습니다.', ok: false });
    } finally {
      setUploadingNoticeAttachment(false);
    }
  };

  const handleCreateNotice = async () => {
    if (!token) return;

    const title = noticeForm.title.trim();
    const content = noticeForm.content.trim();

    if (!title || !content) {
      setNoticeMsg({ text: '제목과 내용을 입력하세요.', ok: false });
      return;
    }

    try {
      setSavingNotice(true);
      setNoticeMsg(null);
      const response = await axios.post<Post>(
        `${API_BASE}/api/community/posts`,
        {
          title,
          content,
          attachmentUrl: noticeForm.attachmentUrl.trim() || null,
          notice: true,
        },
        { headers },
      );

      setNoticeForm({ title: '', content: '', attachmentUrl: '' });
      setNoticeMsg({ text: '공지사항이 등록되었습니다.', ok: true });
      setPosts(prev => [response.data, ...prev.filter(post => post.postId !== response.data.postId)]);
    } catch (err: any) {
      setNoticeMsg({ text: err.response?.data?.message || '공지사항 등록에 실패했습니다.', ok: false });
    } finally {
      setSavingNotice(false);
    }
  };

  const handleReplyInquiry = async () => {
    if (!selectedInquiry || !replyContent.trim()) return;
    try {
      await axios.patch(
        `${API_BASE}/api/admin/inquiries/${selectedInquiry.inquiryId}/reply`,
        { status: 'ANSWERED', reply: replyContent },
        { headers }
      );
      setInquiries(prev =>
        prev.map(inq =>
          inq.inquiryId === selectedInquiry.inquiryId ? { ...inq, status: 'ANSWERED', reply: replyContent } : inq
        )
      );
      setSelectedInquiry(null);
      setReplyContent('');
      alert('답변이 등록되었습니다.');
    } catch {
      alert('답변 등록 실패');
    }
  };

  const handleLogout = async () => {
    if (token) {
      try {
        await axios.post(`${API_BASE}/api/auth/logout`, {}, { headers });
      } catch {
        // Clear the local admin session even if the API call fails.
      }
    }

    clearAdminSession(true);
    navigate('/admin/login', { replace: true });
  };

  const menuTitles: Record<typeof activeMenu, { title: string; desc: string; icon: ElementType }> = {
    dashboard: { title: '대시보드', desc: '핵심 지표 요약', icon: LayoutDashboard },
    members: { title: '회원 관리', desc: '검색/상태 변경', icon: Users },
    idApprovals: { title: '신분증 승인', desc: '신분증 제출 계정 승인', icon: BadgeCheck },
    orders: { title: '거래 내역', desc: '주문/체결 조회', icon: ArrowLeftRight },
    assets: { title: '자산 관리', desc: '보유/잠금 잔고', icon: Wallet },
    deposits: { title: '입출금 관리', desc: '입출금/거래 로그', icon: Banknote },
    community: { title: '커뮤니티 관리', desc: '게시글 조회/삭제', icon: MessageSquareText },
    inquiries: { title: '고객센터 문의', desc: '1:1 문의 답변', icon: Headset },
    settings: { title: '시스템 설정', desc: '관리자 설정', icon: Settings },
  };

  const pendingInquiryCount = useMemo(() => inquiries.filter(i => i.status === 'PENDING').length, [inquiries]);

  /* ✅ (선택 적용) 99+ 처리 */
  const badgeText = pendingInquiryCount > 99 ? '99+' : pendingInquiryCount;

  const renderContent = () => {
    switch (activeMenu) {
      case 'dashboard':
        return (
          <>
            <StatsGrid>
              <StatCard>
                <StatTop>
                  <StatLabel>총 회원 수</StatLabel>
                  <StatChip>Members</StatChip>
                </StatTop>
                <StatValue>{stats ? fmt(stats.totalMembers) : '-'}</StatValue>
              </StatCard>
              <StatCard>
                <StatTop>
                  <StatLabel>활성 회원</StatLabel>
                  <StatChip>Active</StatChip>
                </StatTop>
                <StatValue>{stats ? fmt(stats.activeMembers) : '-'}</StatValue>
              </StatCard>
              <StatCard>
                <StatTop>
                  <StatLabel>총 주문 수</StatLabel>
                  <StatChip>Orders</StatChip>
                </StatTop>
                <StatValue>{stats ? fmt(stats.totalOrders) : '-'}</StatValue>
              </StatCard>
              <StatCard>
                <StatTop>
                  <StatLabel>KRW 총 잔고</StatLabel>
                  <StatChip>Balance</StatChip>
                </StatTop>
                <StatValue>{stats ? `₩${fmt(stats.totalKrwBalance)}` : '-'}</StatValue>
              </StatCard>
            </StatsGrid>

            <Card>
              <CardTitle>요약</CardTitle>
              <div style={{ color: COLORS.muted, fontSize: 13, fontWeight: 900 }}>
                총 거래 건수: {stats ? fmt(stats.totalTransactions) : '-'}건
              </div>
            </Card>
          </>
        );

      case 'members':
        return (
          <Card>
            <CardTitle>회원 목록 ({fmt(memberTotal)}명)</CardTitle>

            <FilterRow>
              <Input
                value={memberQuery.q}
                onChange={e => setMemberQuery(s => ({ ...s, q: e.target.value, page: 0 }))}
                placeholder="이메일/이름 검색"
                style={{ width: 260 }}
              />
              <Select value={memberQuery.role} onChange={e => setMemberQuery(s => ({ ...s, role: e.target.value, page: 0 }))}>
                <option value="">전체 역할</option>
                <option value="VCESYS_CORE">VCESYS_CORE</option>
                <option value="USER">USER</option>
                <option value="GUEST">GUEST</option>
              </Select>
              <Select
                value={memberQuery.status}
                onChange={e => setMemberQuery(s => ({ ...s, status: e.target.value, page: 0 }))}
              >
                <option value="">전체 상태</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="LOCKED">LOCKED</option>
                <option value="WITHDRAWN">WITHDRAWN</option>
                <option value="AUTH_FAILED">AUTH_FAILED</option>
              </Select>
              <PrimaryButton onClick={fetchData}>검색</PrimaryButton>
              <GhostButton onClick={() => setMemberQuery({ q: '', role: '', status: '', page: 0, size: 20 })}>초기화</GhostButton>
            </FilterRow>

            {members.length === 0 ? (
              <EmptyState>회원이 없습니다.</EmptyState>
            ) : (
              <>
                <Table>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>이메일</th>
                      <th>이름</th>
                      <th>신분증</th>
                      <th>역할</th>
                      <th>상태</th>
                      <th>가입일</th>
                      <th>상태 변경</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map(m => (
                      <tr key={m.memberId}>
                        <td>{m.memberId}</td>
                        <td>
                          <span onClick={(e) => handleUnmask(m.memberId, e)} style={{ cursor: 'pointer', color: (m as any)._unmasked ? COLORS.primary : 'inherit' }} title="클릭하여 마스킹 해제">
                            {m.email}
                          </span>
                        </td>
                        <td>
                          <span onClick={(e) => handleUnmask(m.memberId, e)} style={{ cursor: 'pointer', color: (m as any)._unmasked ? COLORS.primary : 'inherit' }} title="클릭하여 마스킹 해제">
                            {m.name}
                          </span>
                        </td>
                        <td>
                          {m.hasIdPhoto ? (
                            <GhostButton style={{ height: '28px', fontSize: '11px', padding: '0 8px' }} onClick={() => openIdPhoto(m.idPhotoUrl!)}>
                              보기
                            </GhostButton>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td>
                          <Badge $tone={toneFromRole(m.role)}>{m.role}</Badge>
                        </td>
                        <td>
                          <Badge $tone={toneFromStatus(m.status)}>{m.status}</Badge>
                        </td>
                        <td>{fmtDate(m.createdAt)}</td>
                        <td style={{ display: 'flex', gap: '4px', alignItems: 'center', height: '100%', minHeight: '44px' }}>
                          <Select value={m.status} onChange={e => handleStatusChange(m.memberId, e.target.value)} style={{ width: '115px' }}>
                            <option value="ACTIVE">ACTIVE</option>
                            <option value="LOCKED">LOCKED</option>
                            <option value="WITHDRAWN">WITHDRAWN</option>
                            <option value="AUTH_FAILED">AUTH_FAILED</option>
                          </Select>
                          <PrimaryButton style={{ height: '32px', fontSize: '11px', padding: '0 8px' }} onClick={() => handleViewMemberDetails(m.memberId)}>
                            상세 보기
                          </PrimaryButton>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>

                <PaginationRow>
                  <PageInfo>
                    페이지 {memberQuery.page + 1} / {Math.max(memberTotalPages, 1)}
                  </PageInfo>
                  <PageButtons>
                    <GhostButton
                      onClick={() => setMemberQuery(q => ({ ...q, page: Math.max(0, q.page - 1) }))}
                      disabled={memberQuery.page <= 0}
                    >
                      이전
                    </GhostButton>
                    <GhostButton
                      onClick={() => setMemberQuery(q => ({ ...q, page: q.page + 1 }))}
                      disabled={memberQuery.page + 1 >= memberTotalPages}
                    >
                      다음
                    </GhostButton>
                  </PageButtons>
                </PaginationRow>
              </>
            )}
          </Card>
        );

      case 'idApprovals': {
        const pendingIdApprovals = idApprovalMembers.filter(m => m.status === 'LOCKED' && Boolean(m.hasIdPhoto));

        return (
          <Card>
            <CardTitle>신분증 제출 승인 ({pendingIdApprovals.length}건)</CardTitle>
            {pendingIdApprovals.length === 0 ? (
              <EmptyState>승인 대기 중인 신분증 제출 계정이 없습니다.</EmptyState>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>이메일</th>
                    <th>이름</th>
                    <th>현재 상태</th>
                    <th>신분증</th>
                    <th>가입일</th>
                    <th>승인 처리</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingIdApprovals.map(m => (
                    <tr key={m.memberId}>
                      <td>{m.memberId}</td>
                      <td>
                        <span onClick={(e) => handleUnmask(m.memberId, e)} style={{ cursor: 'pointer', color: (m as any)._unmasked ? COLORS.primary : 'inherit' }} title="클릭하여 마스킹 해제">
                          {m.email}
                        </span>
                      </td>
                      <td>
                        <span onClick={(e) => handleUnmask(m.memberId, e)} style={{ cursor: 'pointer', color: (m as any)._unmasked ? COLORS.primary : 'inherit' }} title="클릭하여 마스킹 해제">
                          {m.name}
                        </span>
                      </td>
                      <td>
                        <Badge $tone={toneFromStatus(m.status)}>{m.status}</Badge>
                      </td>
                      <td>
                        {m.idPhotoUrl ? (
                          <span
                            onClick={() => openIdPhoto(m.idPhotoUrl!)}
                            style={{ color: COLORS.primary, textDecoration: 'underline', fontWeight: 900, cursor: 'pointer' }}
                          >
                            원본 보기
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td>{fmtDate(m.createdAt)}</td>
                      <td>
                        <PrimaryButton onClick={() => handleApproveIdPhoto(m.memberId)}>ACTIVE 승인</PrimaryButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        );
      }

      case 'orders':
        return (
          <Card>
            <CardTitle>전체 주문 ({orders.length}건)</CardTitle>
            {orders.length === 0 ? (
              <EmptyState>주문 내역이 없습니다.</EmptyState>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>회원</th>
                    <th>유형</th>
                    <th>코인</th>
                    <th>가격</th>
                    <th>수량</th>
                    <th>체결량</th>
                    <th>상태</th>
                    <th>일시</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map(o => (
                    <tr key={o.orderId}>
                      <td>{o.orderId}</td>
                      <td>
                        <span onClick={(e) => handleUnmask((o as any).memberId, e)} style={{ cursor: 'pointer', color: (o as any)._unmasked ? COLORS.primary : 'inherit' }} title="클릭하여 마스킹 해제">
                          {o.memberName} ({o.memberEmail})
                        </span>
                      </td>
                      <td>
                        <Badge $tone={toneFromOrderType(o.orderType)}>{o.orderType}</Badge>
                      </td>
                      <td>{o.assetType}</td>
                      <td>{fmt(o.price)}</td>
                      <td>{o.amount}</td>
                      <td>{o.filledAmount}</td>
                      <td>
                        <Badge $tone={toneFromStatus(o.status)}>{o.status}</Badge>
                      </td>
                      <td>{fmtDate(o.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        );

      case 'assets':
        return (
          <Card>
            <CardTitle>전체 자산 ({assets.length}건)</CardTitle>
            {assets.length === 0 ? (
              <EmptyState>자산 내역이 없습니다.</EmptyState>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <th>회원</th>
                    <th>이메일</th>
                    <th>자산</th>
                    <th>잔고</th>
                    <th>잠금</th>
                    <th>관리</th>
                  </tr>
                </thead>
                <tbody>
                  {assets.map(a => {
                    const reclaimable = Math.max(0, Number(a.balance) - Number(a.lockedBalance));
                    return (
                      <tr key={a.assetId}>
                        <td>
                          <span onClick={(e) => handleUnmask(a.memberId, e)} style={{ cursor: 'pointer', color: (a as any)._unmasked ? COLORS.primary : 'inherit' }} title="클릭하여 마스킹 해제">
                            {a.memberName}
                          </span>
                        </td>
                        <td>
                          <span onClick={(e) => handleUnmask(a.memberId, e)} style={{ cursor: 'pointer', color: (a as any)._unmasked ? COLORS.primary : 'inherit' }} title="클릭하여 마스킹 해제">
                            {a.memberEmail}
                          </span>
                        </td>
                        <td>{a.assetType}</td>
                        <td>{a.assetType === 'KRW' ? fmt(a.balance) : a.balance}</td>
                        <td>{a.lockedBalance > 0 ? a.lockedBalance : '-'}</td>
                        <td>
                          {a.assetType !== 'KRW' && (
                            <GhostButton onClick={() => openReclaimModal(a)} disabled={reclaimable <= 0}>
                              코인 회수
                            </GhostButton>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            )}
          </Card>
        );

      case 'deposits':
        return (
          <Card>
            <CardTitle>전체 입출금 ({fmt(txTotal)}건)</CardTitle>

            <FilterRow>
              <Input
                value={txQuery.memberEmail}
                onChange={e => setTxQuery(q => ({ ...q, memberEmail: e.target.value, page: 0 }))}
                placeholder="회원 이메일 검색"
                style={{ width: 240 }}
              />
              <Select value={txQuery.txType} onChange={e => setTxQuery(q => ({ ...q, txType: e.target.value, page: 0 }))}>
                <option value="">전체 유형</option>
                <option value="DEPOSIT">DEPOSIT</option>
                <option value="WITHDRAW">WITHDRAW</option>
                <option value="BUY">BUY</option>
                <option value="SELL">SELL</option>
                <option value="ADMIN_RECLAIM">ADMIN_RECLAIM</option>
              </Select>
              <Input
                type="date"
                value={txQuery.from}
                onChange={e => setTxQuery(q => ({ ...q, from: e.target.value, page: 0 }))}
                style={{ width: 160 }}
              />
              <Input
                type="date"
                value={txQuery.to}
                onChange={e => setTxQuery(q => ({ ...q, to: e.target.value, page: 0 }))}
                style={{ width: 160 }}
              />
              <Input
                value={txQuery.assetType}
                onChange={e => setTxQuery(q => ({ ...q, assetType: e.target.value.toUpperCase(), page: 0 }))}
                placeholder="자산 (예: KRW, BTC)"
                style={{ width: 180 }}
              />
              <PrimaryButton onClick={fetchData}>검색</PrimaryButton>
              <GhostButton onClick={() => setTxQuery({ memberEmail: '', assetType: '', txType: '', from: '', to: '', page: 0, size: 20 })}>
                초기화
              </GhostButton>
            </FilterRow>

            {transactions.length === 0 ? (
              <EmptyState>입출금 내역이 없습니다.</EmptyState>
            ) : (
              <>
                <Table>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>회원</th>
                      <th>유형</th>
                      <th>자산</th>
                      <th>수량</th>
                      <th>총액</th>
                      <th>수수료</th>
                      <th>일시</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map(tx => (
                      <tr key={tx.txId}>
                        <td>{tx.txId}</td>
                        <td>
                          <span onClick={(e) => handleUnmask((tx as any).memberId, e)} style={{ cursor: 'pointer', color: (tx as any)._unmasked ? COLORS.primary : 'inherit' }} title="클릭하여 마스킹 해제">
                            {tx.memberName} ({tx.memberEmail})
                          </span>
                        </td>
                        <td>
                          <Badge $tone={toneFromTxType(tx.txType)}>{tx.txType}</Badge>
                        </td>
                        <td>{tx.assetType}</td>
                        <td>{tx.amount}</td>
                        <td>{tx.totalValue ? fmt(tx.totalValue) : '-'}</td>
                        <td>{tx.fee ? fmt(tx.fee, 8) : '-'}</td>
                        <td>{fmtDate(tx.txDate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>

                <PaginationRow>
                  <PageInfo>
                    페이지 {txQuery.page + 1} / {Math.max(txTotalPages, 1)}
                  </PageInfo>
                  <PageButtons>
                    <GhostButton
                      onClick={() => setTxQuery(q => ({ ...q, page: Math.max(0, q.page - 1) }))}
                      disabled={txQuery.page <= 0}
                    >
                      이전
                    </GhostButton>
                    <GhostButton
                      onClick={() => setTxQuery(q => ({ ...q, page: q.page + 1 }))}
                      disabled={txQuery.page + 1 >= txTotalPages}
                    >
                      다음
                    </GhostButton>
                  </PageButtons>
                </PaginationRow>
              </>
            )}
          </Card>
        );

      case 'community': {
        const filteredPosts = posts.filter(p => {
          const term = searchTerm.toLowerCase();
          return (
            (p.title?.toLowerCase() || '').includes(term) ||
            (p.content?.toLowerCase() || '').includes(term) ||
            (p.authorName?.toLowerCase() || '').includes(term)
          );
        });

        return (
          <Card>
            <CardTitle>게시글 관리 ({posts.length}건)</CardTitle>

            {noticeMsg && <Msg $ok={noticeMsg.ok}>{noticeMsg.text}</Msg>}

            <FormGrid>
              <FieldLabel>
                공지 제목
                <Input
                  value={noticeForm.title}
                  onChange={e => {
                    setNoticeMsg(null);
                    setNoticeForm(prev => ({ ...prev, title: e.target.value }));
                  }}
                  placeholder="공지사항 제목을 입력하세요"
                />
              </FieldLabel>
              <FieldLabel>
                공지 내용
                <Textarea
                  value={noticeForm.content}
                  onChange={e => {
                    setNoticeMsg(null);
                    setNoticeForm(prev => ({ ...prev, content: e.target.value }));
                  }}
                  placeholder="공지사항 내용을 입력하세요"
                  style={{ minHeight: 140 }}
                />
              </FieldLabel>
              <FieldLabel>
                첨부 링크
                <Input
                  value={noticeForm.attachmentUrl}
                  onChange={e => {
                    setNoticeMsg(null);
                    setNoticeForm(prev => ({ ...prev, attachmentUrl: e.target.value }));
                  }}
                  placeholder="/uploads/... 또는 외부 URL"
                />
              </FieldLabel>
              <FieldLabel>
                첨부 파일 업로드
                <Input type="file" onChange={e => void handleNoticeUpload(e.target.files?.[0] ?? null)} />
                <UploadMeta>
                  {uploadingNoticeAttachment
                    ? '파일 업로드 중입니다...'
                    : noticeForm.attachmentUrl
                      ? `현재 첨부: ${noticeForm.attachmentUrl}`
                      : '이미지 또는 첨부 파일을 업로드할 수 있습니다.'}
                </UploadMeta>
              </FieldLabel>
            </FormGrid>

            <InlineActions style={{ marginBottom: 12 }}>
              <PrimaryButton onClick={() => void handleCreateNotice()} disabled={savingNotice || uploadingNoticeAttachment}>
                {savingNotice ? '등록 중...' : '공지사항 등록'}
              </PrimaryButton>
              <GhostButton
                onClick={() => {
                  setNoticeMsg(null);
                  setNoticeForm({ title: '', content: '', attachmentUrl: '' });
                }}
                disabled={savingNotice || uploadingNoticeAttachment}
              >
                입력 초기화
              </GhostButton>
            </InlineActions>

            <FilterRow>
              <Input
                placeholder="제목, 내용, 작성자 검색"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{ width: 320 }}
              />
            </FilterRow>

            {filteredPosts.length === 0 ? (
              <EmptyState>게시글이 없습니다.</EmptyState>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>제목</th>
                    <th>작성자</th>
                    <th>공지</th>
                    <th>작성일</th>
                    <th>삭제</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPosts.map(p => (
                    <tr key={p.postId}>
                      <td>{p.postId}</td>
                      <td>
                        {/* V-05: 모달 오픈 시 댓글 데이터 fetch (dangerouslySetInnerHTML 취약점 유발 목적) */}
                        <LinkCell onClick={() => { setSelectedPost(p); setPostComments([]); fetchPostComments(p.postId); }} title={p.title}>
                          {p.title}
                        </LinkCell>
                      </td>
                      <td>{p.authorName}</td>
                      <td>{p.notice ? <Badge $tone="warn">공지</Badge> : '-'}</td>
                      <td>{fmtDate(p.createdAt)}</td>
                      <td>
                        <GhostButton onClick={() => handleDeletePost(p.postId)}>삭제</GhostButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        );
      }

      case 'inquiries':
        return (
          <Card>
            <CardTitle>1:1 문의 관리 ({inquiries.length}건)</CardTitle>
            {inquiries.length === 0 ? (
              <EmptyState>등록된 문의가 없습니다.</EmptyState>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>이메일</th>
                    <th>이름</th>
                    <th>제목</th>
                    <th>상태</th>
                    <th>등록일</th>
                    <th>답변</th>
                  </tr>
                </thead>
                <tbody>
                  {inquiries.map(inq => (
                    <tr key={inq.inquiryId}>
                      <td>{inq.inquiryId}</td>
                      <td>
                        <span onClick={(e) => handleUnmask((inq as any).memberId, e)} style={{ cursor: 'pointer', color: (inq as any)._unmasked ? COLORS.primary : 'inherit' }} title="클릭하여 마스킹 해제">
                          {inq.memberEmail}
                        </span>
                      </td>
                      <td>{inq.memberName}</td>
                      <td>
                        <LinkCell
                          onClick={() => {
                            setSelectedInquiry(inq);
                            setReplyContent(inq.reply || '');
                          }}
                          title={inq.title}
                        >
                          {inq.title}
                        </LinkCell>
                      </td>
                      <td>
                        <Badge $tone={toneFromStatus(inq.status)}>
                          {inq.status === 'PENDING' ? '답변대기' : '답변완료'}
                        </Badge>
                      </td>
                      <td>{fmtDate(inq.createdAt)}</td>
                      <td>
                        <GhostButton
                          onClick={() => {
                            setSelectedInquiry(inq);
                            setReplyContent(inq.reply || '');
                          }}
                        >
                          상세 보기
                        </GhostButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        );

      case 'settings':
        return (
          <>
            {/* ── 내 비밀번호 변경 ── */}
            <Card>
              <CardTitle>관리자 설정</CardTitle>
              {settingsMsg && <Msg $ok={settingsMsg.ok}>{settingsMsg.text}</Msg>}

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <Input
                  type="password"
                  value={newPw}
                  onChange={e => setNewPw(e.target.value)}
                  placeholder="새 비밀번호 입력"
                  style={{ width: 320 }}
                />
                <PrimaryButton
                  disabled={!newPw}
                  onClick={async () => {
                    try {
                      await axios.put(`${API_BASE}/api/admin/change-password`, { newPassword: newPw }, { headers });
                      setSettingsMsg({ text: '비밀번호가 변경되었습니다.', ok: true });
                      setNewPw('');
                    } catch {
                      setSettingsMsg({ text: '비밀번호 변경 기능은 준비 중입니다.', ok: false });
                    }
                  }}
                >
                  비밀번호 변경
                </PrimaryButton>
              </div>
            </Card>

            {/* ── 직원(Admin/Manager/Staff) 관리 — ADMIN 전용 ── */}
            {role === 'VCESYS_CORE' && (
              <>
                {/* 직원 생성 폼 */}
                <Card style={{ marginTop: 14 }}>
                  <CardTitle>직원 계정 생성</CardTitle>
                  {staffMsg && <Msg $ok={staffMsg.ok}>{staffMsg.text}</Msg>}

                  <FormGrid style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
                    <FieldLabel>
                      이메일
                      <Input
                        type="email"
                        value={staffForm.email}
                        onChange={e => setStaffForm(f => ({ ...f, email: e.target.value }))}
                        placeholder="staff@example.com"
                        style={{
                          borderColor: staffForm.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(staffForm.email)
                            ? COLORS.danger : undefined
                        }}
                      />
                      {staffForm.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(staffForm.email) && (
                        <span style={{ fontSize: '11px', color: COLORS.danger, marginTop: '3px' }}>
                          올바른 이메일 형식이 아닙니다.
                        </span>
                      )}
                    </FieldLabel>
                    <FieldLabel>
                      비밀번호
                      <Input
                        type="password"
                        value={staffForm.password}
                        onChange={e => setStaffForm(f => ({ ...f, password: e.target.value }))}
                        placeholder="8자↑ 대소문자+숫자+특수문자"
                        style={{
                          borderColor: staffForm.password && !/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[!@#$%^&*()\-_=+\[\]{};':"\\|,.<>/?]).{8,}$/.test(staffForm.password)
                            ? COLORS.danger : undefined
                        }}
                      />
                      {staffForm.password && !/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[!@#$%^&*()\-_=+\[\]{};':"\\|,.<>/?]).{8,}$/.test(staffForm.password) && (
                        <span style={{ fontSize: '11px', color: COLORS.danger, marginTop: '3px' }}>
                          8자 이상, 대소문자·숫자·특수문자 각 1자 이상 필요
                        </span>
                      )}
                    </FieldLabel>
                    <FieldLabel>
                      이름
                      <Input
                        type="text"
                        value={staffForm.name}
                        onChange={e => setStaffForm(f => ({ ...f, name: e.target.value }))}
                        placeholder="홍길동"
                      />
                    </FieldLabel>
                    <FieldLabel>
                      역할
                      <Select
                        value={staffForm.role}
                        onChange={e => setStaffForm(f => ({ ...f, role: e.target.value }))}
                      >
                        <option value="VCESYS_EMP">VCESYS_EMP</option>
                        <option value="VCESYS_MGMT">VCESYS_MGMT</option>
                        <option value="VCESYS_CORE">VCESYS_CORE</option>
                      </Select>
                    </FieldLabel>
                  </FormGrid>

                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <PrimaryButton
                      disabled={
                        !staffForm.email ||
                        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(staffForm.email) ||
                        !staffForm.password ||
                        !/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[!@#$%^&*()\-_=+\[\]{};':"\\|,.<>/?]).{8,}$/.test(staffForm.password) ||
                        !staffForm.name
                      }
                      onClick={async () => {
                        setStaffMsg(null);
                        try {
                          await axios.post(
                            `${API_BASE}/api/admin/staff`,
                            staffForm,
                            { headers }
                          );
                          setStaffMsg({ text: '직원 계정이 생성되었습니다.', ok: true });
                          setStaffForm({ email: '', password: '', name: '', role: 'VCESYS_EMP' });
                          // 목록 새로 고침
                          const r = await axios.get(`${API_BASE}/api/admin/staff`, { headers });
                          setStaffList(r.data);
                        } catch (err: unknown) {
                          const msg =
                            (err as { response?: { data?: string } })?.response?.data ||
                            '계정 생성에 실패했습니다.';
                          setStaffMsg({ text: String(msg), ok: false });
                        }
                      }}
                    >
                      계정 생성
                    </PrimaryButton>
                  </div>
                </Card>

                {/* 직원 목록 */}
                <Card style={{ marginTop: 14 }}>
                  <CardTitle>직원 목록</CardTitle>
                  {staffLoading ? (
                    <EmptyState>불러오는 중…</EmptyState>
                  ) : staffList.length === 0 ? (
                    <EmptyState>등록된 직원 계정이 없습니다.</EmptyState>
                  ) : (
                    <Table>
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>이메일</th>
                          <th>이름</th>
                          <th>역할</th>
                          <th>상태</th>
                          <th>비밀번호</th>
                          <th>생성일</th>
                          <th>삭제</th>
                        </tr>
                      </thead>
                      <tbody>
                        {staffList.map(s => (
                          <tr key={s.memberId}>
                            <td>{s.memberId}</td>
                            <td>{s.email}</td>
                            <td>{s.name}</td>
                            <td>
                              <Badge
                                $tone={
                                  s.role === 'VCESYS_CORE'
                                    ? 'danger'
                                    : s.role === 'VCESYS_MGMT'
                                      ? 'warn'
                                      : 'info'
                                }
                              >
                                {s.role}
                              </Badge>
                            </td>
                            <td>
                              <Badge $tone={s.status === 'ACTIVE' ? 'success' : 'neutral'}>
                                {s.status}
                              </Badge>
                            </td>
                            <td>
                              {s.passwordNeedsUpdate ? (
                                <Badge $tone="danger" title="BCrypt 방식으로 저장된 비밀번호입니다. 계정을 삭제 후 재생성하여 비밀번호 정책을 적용해 주세요.">
                                  ⚠ 정책 미준수
                                </Badge>
                              ) : (
                                <Badge $tone="success">정상</Badge>
                              )}
                            </td>
                            <td>
                              {s.createdAt
                                ? new Date(s.createdAt).toLocaleDateString('ko-KR')
                                : '-'}
                            </td>
                            <td>
                              {staffDeleteConfirm === s.memberId ? (
                                <div style={{ display: 'flex', gap: 6 }}>
                                  <ModalButton
                                    $variant="danger"
                                    style={{ height: 30, fontSize: 12 }}
                                    onClick={async () => {
                                      try {
                                        await axios.delete(
                                          `${API_BASE}/api/admin/staff/${s.memberId}`,
                                          { headers }
                                        );
                                        setStaffList(prev =>
                                          prev.filter(x => x.memberId !== s.memberId)
                                        );
                                        setStaffDeleteConfirm(null);
                                        setStaffMsg({ text: '직원 계정이 삭제되었습니다.', ok: true });
                                      } catch (err: unknown) {
                                        const msg =
                                          (err as { response?: { data?: string } })?.response?.data ||
                                          '삭제에 실패했습니다.';
                                        setStaffMsg({ text: String(msg), ok: false });
                                        setStaffDeleteConfirm(null);
                                      }
                                    }}
                                  >
                                    확인
                                  </ModalButton>
                                  <ModalButton
                                    style={{ height: 30, fontSize: 12 }}
                                    onClick={() => setStaffDeleteConfirm(null)}
                                  >
                                    취소
                                  </ModalButton>
                                </div>
                              ) : (
                                <ModalButton
                                  $variant="danger"
                                  style={{ height: 30, fontSize: 12 }}
                                  onClick={() => setStaffDeleteConfirm(s.memberId)}
                                >
                                  삭제
                                </ModalButton>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  )}
                </Card>
              </>
            )}
          </>
        );

      default:
        return null;
    }
  };

  const page = menuTitles[activeMenu] || menuTitles.dashboard;
  const role = getAdminRole() || 'GUEST';

  const menuSections = {
    main: ['dashboard'] as const,
    exchange: ['members', 'idApprovals', 'orders', 'assets', 'deposits'] as const,
    contents: ['community', 'inquiries'] as const,
    system: ['settings'] as const,
  };

  const allowedMenus = useMemo(() => {
    if (role === 'VCESYS_CORE') {
      return [...menuSections.main, ...menuSections.exchange, ...menuSections.contents, ...menuSections.system];
    } else if (role === 'VCESYS_MGMT') {
      return [...menuSections.main, ...menuSections.exchange, ...menuSections.contents];
    } else if (role === 'VCESYS_EMP') {
      return [...menuSections.contents];
    }
    return [];
  }, [role]);

  return (
    <>
      <GlobalStyle />
      <Shell>
        <TopBar>
          <Brand>
            <ToggleBtn
              onClick={() => setSidebarCollapsed(v => !v)}
              aria-label="sidebar toggle"
              title={sidebarCollapsed ? '사이드바 펼치기' : '사이드바 접기'}
            >
              {sidebarCollapsed ? '»' : '«'}
            </ToggleBtn>

            <BrandMark>V</BrandMark>
            <BrandText>
              <BrandTitle>VCE Admin</BrandTitle>
            </BrandText>
          </Brand>
        </TopBar>

        <Body $collapsed={sidebarCollapsed}>
          <Sidebar $collapsed={sidebarCollapsed}>
            <SideNav>
              {allowedMenus.includes('dashboard') && (
                <SideSection>
                  <SideSectionTitle $collapsed={sidebarCollapsed}>메인</SideSectionTitle>
                  <SideItem
                    $active={activeMenu === 'dashboard'}
                    $collapsed={sidebarCollapsed}
                    onClick={() => setActiveMenu('dashboard')}
                    title={sidebarCollapsed ? menuTitles.dashboard.title : undefined}
                  >
                    <SideLeft $collapsed={sidebarCollapsed}>
                      {(() => {
                        const Icon = menuTitles.dashboard.icon;
                        return (
                          <SideIcon $active={activeMenu === 'dashboard'}>
                            <Icon size={16} />
                          </SideIcon>
                        );
                      })()}
                      <SideText $collapsed={sidebarCollapsed}>
                        <SideLabel>{menuTitles.dashboard.title}</SideLabel>
                        <SideDesc>{menuTitles.dashboard.desc}</SideDesc>
                      </SideText>
                    </SideLeft>
                  </SideItem>
                </SideSection>
              )}

              {allowedMenus.some(menu => menuSections.exchange.includes(menu as any)) && (
                <SideSection>
                  <SideSectionTitle $collapsed={sidebarCollapsed}>거래소 관리</SideSectionTitle>
                  {menuSections.exchange.filter(key => allowedMenus.includes(key as any)).map(key => (
                    <SideItem
                      key={key}
                      $active={activeMenu === key}
                      $collapsed={sidebarCollapsed}
                      onClick={() => setActiveMenu(key)}
                      title={sidebarCollapsed ? menuTitles[key].title : undefined}
                    >
                      <SideLeft $collapsed={sidebarCollapsed}>
                        {(() => {
                          const Icon = menuTitles[key].icon;
                          return (
                            <SideIcon $active={activeMenu === key}>
                              <Icon size={16} />
                            </SideIcon>
                          );
                        })()}
                        <SideText $collapsed={sidebarCollapsed}>
                          <SideLabel>{menuTitles[key].title}</SideLabel>
                          <SideDesc>{menuTitles[key].desc}</SideDesc>
                        </SideText>
                      </SideLeft>
                    </SideItem>
                  ))}
                </SideSection>
              )}

              {allowedMenus.some(menu => menuSections.contents.includes(menu as any)) && (
                <SideSection>
                  <SideSectionTitle $collapsed={sidebarCollapsed}>콘텐츠</SideSectionTitle>

                  {allowedMenus.includes('community') && (
                    <SideItem
                      $active={activeMenu === 'community'}
                      $collapsed={sidebarCollapsed}
                      onClick={() => setActiveMenu('community')}
                      title={sidebarCollapsed ? menuTitles.community.title : undefined}
                    >
                      <SideLeft $collapsed={sidebarCollapsed}>
                        {(() => {
                          const Icon = menuTitles.community.icon;
                          return (
                            <SideIcon $active={activeMenu === 'community'}>
                              <Icon size={16} />
                            </SideIcon>
                          );
                        })()}
                        <SideText $collapsed={sidebarCollapsed}>
                          <SideLabel>{menuTitles.community.title}</SideLabel>
                          <SideDesc>{menuTitles.community.desc}</SideDesc>
                        </SideText>
                      </SideLeft>
                    </SideItem>
                  )}

                  {allowedMenus.includes('inquiries') && (
                    <div style={{ position: 'relative' }}>
                      <SideItem
                        $active={activeMenu === 'inquiries'}
                        $collapsed={sidebarCollapsed}
                        onClick={() => setActiveMenu('inquiries')}
                        title={sidebarCollapsed ? menuTitles.inquiries.title : undefined}
                      >
                        <SideLeft $collapsed={sidebarCollapsed}>
                          {(() => {
                            const Icon = menuTitles.inquiries.icon;
                            return (
                              <SideIcon $active={activeMenu === 'inquiries'}>
                                <Icon size={16} />
                              </SideIcon>
                            );
                          })()}
                          <SideText $collapsed={sidebarCollapsed}>
                            <SideLabel>{menuTitles.inquiries.title}</SideLabel>
                            <SideDesc>{menuTitles.inquiries.desc}</SideDesc>
                          </SideText>
                        </SideLeft>

                        {!sidebarCollapsed && <SideBadge $show={pendingInquiryCount > 0}>{badgeText}</SideBadge>}
                      </SideItem>

                      {sidebarCollapsed && (
                        <SideBadge $show={pendingInquiryCount > 0} $collapsed>
                          {badgeText}
                        </SideBadge>
                      )}
                    </div>
                  )}
                </SideSection>
              )}

              {allowedMenus.includes('settings') && (
                <SideSection>
                  <SideSectionTitle $collapsed={sidebarCollapsed}>시스템</SideSectionTitle>
                  <SideItem
                    $active={activeMenu === 'settings'}
                    $collapsed={sidebarCollapsed}
                    onClick={() => setActiveMenu('settings')}
                    title={sidebarCollapsed ? menuTitles.settings.title : undefined}
                  >
                    <SideLeft $collapsed={sidebarCollapsed}>
                      {(() => {
                        const Icon = menuTitles.settings.icon;
                        return (
                          <SideIcon $active={activeMenu === 'settings'}>
                            <Icon size={16} />
                          </SideIcon>
                        );
                      })()}
                      <SideText $collapsed={sidebarCollapsed}>
                        <SideLabel>{menuTitles.settings.title}</SideLabel>
                        <SideDesc>{menuTitles.settings.desc}</SideDesc>
                      </SideText>
                    </SideLeft>
                  </SideItem>
                </SideSection>
              )}
            </SideNav>

            <SideFooter $collapsed={sidebarCollapsed}>
              <SideFooterUser $collapsed={sidebarCollapsed}>
                <SideFooterName>{userName}</SideFooterName>
                <SideFooterRole>{role}</SideFooterRole>
              </SideFooterUser>

              <SideLogout $collapsed={sidebarCollapsed} onClick={handleLogout} title={sidebarCollapsed ? '로그아웃' : undefined}>
                {sidebarCollapsed ? '⎋' : '로그아웃'}
              </SideLogout>
            </SideFooter>
          </Sidebar>

          <Content>
            <Breadcrumb>관리자 / {page.title}</Breadcrumb>
            {renderContent()}
          </Content>

          {selectedPost && (
            <ModalOverlay onClick={() => { setSelectedPost(null); setPostComments([]); }}>
              <ModalContainer onClick={e => e.stopPropagation()} style={{ maxHeight: '80vh', overflowY: 'auto' }}>
                <ModalTitle>{selectedPost.title}</ModalTitle>
                <ModalMeta>
                  작성자: {selectedPost.authorName} | 작성일: {fmtDate(selectedPost.createdAt)}
                </ModalMeta>

                {/* 첨부파일 링크 */}
                {selectedPost.attachmentUrl && (
                  <div style={{ marginBottom: 10 }}>
                    <a
                      href={selectedPost.attachmentUrl.startsWith('http') ? selectedPost.attachmentUrl : `${API_BASE}${selectedPost.attachmentUrl}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: COLORS.primary, textDecoration: 'underline' }}
                    >
                      📎 첨부파일 열기 (클릭)
                    </a>
                  </div>
                )}

                <div
                  style={{ padding: '10px 0', borderBottom: `1px solid ${COLORS.border}`, minHeight: 60, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                >
                  {selectedPost.content}
                </div>

                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: COLORS.muted }}>
                    댓글 ({postComments.length})
                  </div>
                  {postComments.length === 0 ? (
                    <div style={{ fontSize: 12, color: COLORS.muted }}>댓글이 없습니다.</div>
                  ) : (
                    postComments.map((c: any) => (
                      <div key={c.commentId} style={{ padding: '6px 0', borderBottom: `1px solid ${COLORS.border}` }}>
                        <span style={{ fontSize: 11, color: COLORS.muted, marginRight: 8 }}>{c.authorName}</span>
                        <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{c.content}</span>
                      </div>
                    ))
                  )}
                </div>

                <ModalButtonGroup>
                  <ModalButton $variant="ghost" onClick={() => { setSelectedPost(null); setPostComments([]); }}>
                    닫기
                  </ModalButton>
                  <ModalButton
                    $variant="danger"
                    onClick={() => {
                      handleDeletePost(selectedPost.postId);
                      setSelectedPost(null);
                    }}
                  >
                    게시글 삭제
                  </ModalButton>
                </ModalButtonGroup>
              </ModalContainer>
            </ModalOverlay>
          )}

          {selectedInquiry && (
            <ModalOverlay
              onClick={() => {
                setSelectedInquiry(null);
                setReplyContent('');
              }}
            >
              <ModalContainer onClick={e => e.stopPropagation()} style={{ width: '640px' }}>
                <ModalTitle>문의: {selectedInquiry.title}</ModalTitle>
                <ModalMeta>
                  요청자: {selectedInquiry.memberName} ({selectedInquiry.memberEmail}) | 작성일: {fmtDate(selectedInquiry.createdAt)}
                </ModalMeta>

                <div
                  style={{ maxHeight: '160px', overflowY: 'auto', padding: '8px 0', borderBottom: `1px solid ${COLORS.border}`, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                >
                  {selectedInquiry.content}
                </div>

                {selectedInquiry.attachmentUrl && (
                  <div style={{ marginBottom: 12, fontSize: 12, fontWeight: 900 }}>
                    <a
                      href={`${API_BASE}${selectedInquiry.attachmentUrl}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: COLORS.primary, textDecoration: 'underline' }}
                    >
                      📎 첨부파일 존재함 (클릭하여 열기)
                    </a>
                  </div>
                )}

                <div style={{ marginBottom: 10, fontSize: 12, fontWeight: 950, color: COLORS.muted }}>관리자 답변</div>
                <Textarea value={replyContent} onChange={e => setReplyContent(e.target.value)} placeholder="답변 내용을 입력하세요..." />

                <ModalButtonGroup style={{ marginTop: 12 }}>
                  <ModalButton
                    $variant="ghost"
                    onClick={() => {
                      setSelectedInquiry(null);
                      setReplyContent('');
                    }}
                  >
                    취소
                  </ModalButton>
                  <ModalButton $variant="primary" onClick={handleReplyInquiry}>
                    {selectedInquiry.status === 'ANSWERED' ? '답변 수정' : '답변 등록'}
                  </ModalButton>
                </ModalButtonGroup>
              </ModalContainer>
            </ModalOverlay>
          )}

          {reclaimTarget && (
            <ModalOverlay onClick={closeReclaimModal}>
              <ModalContainer onClick={e => e.stopPropagation()} style={{ width: '560px' }}>
                <ModalTitle>코인 회수</ModalTitle>
                <ModalMeta>
                  대상 회원: {reclaimTarget.memberName} ({reclaimTarget.memberEmail})
                  <br />
                  가용 잔고: {fmt(Math.max(0, Number(reclaimTarget.balance) - Number(reclaimTarget.lockedBalance)), 8)} {reclaimTarget.assetType}
                </ModalMeta>

                <div style={{ marginBottom: 6, fontSize: 12, fontWeight: 950, color: COLORS.muted }}>회수 코인</div>
                <Input value={reclaimTarget.assetType} disabled style={{ width: '100%', marginBottom: 10, opacity: 0.8 }} />

                <div style={{ marginBottom: 6, fontSize: 12, fontWeight: 950, color: COLORS.muted }}>회수 수량</div>
                <Input
                  type="number"
                  min="0"
                  step="0.00000001"
                  value={reclaimAmount}
                  onChange={e => setReclaimAmount(e.target.value)}
                  placeholder="예: 12.34567890"
                  style={{ width: '100%', marginBottom: 10 }}
                />

                <div style={{ marginBottom: 6, fontSize: 12, fontWeight: 950, color: COLORS.muted }}>회수 사유</div>
                <Textarea
                  value={reclaimReason}
                  onChange={e => setReclaimReason(e.target.value)}
                  placeholder="오지급, 부정 사용 등 회수 사유를 입력하세요."
                  style={{ minHeight: 96 }}
                />

                <ModalButtonGroup style={{ marginTop: 12 }}>
                  <ModalButton $variant="ghost" onClick={closeReclaimModal} disabled={isReclaiming}>
                    취소
                  </ModalButton>
                  <ModalButton $variant="danger" onClick={handleReclaimAsset} disabled={isReclaiming}>
                    {isReclaiming ? '회수 중...' : '회수 실행'}
                  </ModalButton>
                </ModalButtonGroup>
              </ModalContainer>
            </ModalOverlay>
          )}
        </Body>
      </Shell>

      {selectedImage && (
        <ImageModalOverlay onClick={closeIdPhoto}>
          <ImageModalContent onClick={e => e.stopPropagation()}>
            <CloseButton onClick={closeIdPhoto}>
              X
            </CloseButton>
            <img src={selectedImage} alt="ID Card Original" />
          </ImageModalContent>
        </ImageModalOverlay>
      )}

      {selectedMemberDetails && (
        <ModalOverlay onClick={() => setSelectedMemberDetails(null)}>
          <ModalContainer onClick={e => e.stopPropagation()} style={{ width: '600px', maxHeight: '80vh', overflowY: 'auto' }}>
            <ModalTitle>회원 상세 정보</ModalTitle>
            <div style={{ padding: '12px 0', borderBottom: `1px solid ${COLORS.border}`, marginBottom: '12px' }}>
              <p style={{ margin: '4px 0', fontSize: '13px' }}>
                <strong style={{ display: 'inline-block', width: '80px', color: COLORS.muted }}>ID</strong>
                {selectedMemberDetails.memberId}
              </p>
              <p style={{ margin: '4px 0', fontSize: '13px' }}>
                <strong style={{ display: 'inline-block', width: '80px', color: COLORS.muted }}>이메일</strong>
                <span
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (getAdminRole() !== 'VCESYS_CORE') {
                      alert('ADMIN 권한만 마스킹 해제가 가능합니다.');
                      return;
                    }
                    if (selectedMemberDetails._unmasked) {
                      // 재마스킹: 마스킹된 데이터로 복원
                      try {
                        const res = await axios.get(
                          `${API_BASE}/api/admin/members/${selectedMemberDetails.memberId}`,
                          { headers }
                        );
                        setSelectedMemberDetails((prev: any) => ({
                          ...prev,
                          email: res.data.email,
                          name: res.data.name,
                          phoneNumber: res.data.phoneNumber,
                          _unmasked: false,
                        }));
                      } catch {
                        setSelectedMemberDetails((prev: any) => ({ ...prev, _unmasked: false }));
                      }
                      return;
                    }
                    try {
                      const res = await axios.get(
                        `${API_BASE}/api/admin/members/${selectedMemberDetails.memberId}/unmask`,
                        { headers }
                      );
                      setSelectedMemberDetails((prev: any) => ({
                        ...prev,
                        email: res.data.email,
                        name: res.data.name,
                        phoneNumber: res.data.phoneNumber,
                        _unmasked: true,
                      }));
                    } catch (err: any) {
                      alert(err?.response?.data?.message || '마스킹 해제 실패');
                    }
                  }}
                  style={{
                    cursor: 'pointer',
                    color: selectedMemberDetails._unmasked ? COLORS.primary : 'inherit',
                  }}
                  title={selectedMemberDetails._unmasked ? '클릭하여 재마스킹' : '클릭하여 마스킹 해제'}
                >
                  {selectedMemberDetails.email}
                </span>
              </p>
              <p style={{ margin: '4px 0', fontSize: '13px' }}>
                <strong style={{ display: 'inline-block', width: '80px', color: COLORS.muted }}>이름</strong>
                <span style={{ color: selectedMemberDetails._unmasked ? COLORS.primary : 'inherit' }}>
                  {selectedMemberDetails.name}
                </span>
              </p>
              <p style={{ margin: '4px 0', fontSize: '13px' }}>
                <strong style={{ display: 'inline-block', width: '80px', color: COLORS.muted }}>전화번호</strong>
                <span style={{ color: selectedMemberDetails._unmasked ? COLORS.primary : 'inherit' }}>
                  {selectedMemberDetails.phoneNumber || '-'}
                </span>
              </p>
              <p style={{ margin: '4px 0', fontSize: '13px' }}>
                <strong style={{ display: 'inline-block', width: '80px', color: COLORS.muted }}>역할</strong>
                <Badge $tone={toneFromRole(selectedMemberDetails.role)}>{selectedMemberDetails.role}</Badge>
              </p>
              <p style={{ margin: '4px 0', fontSize: '13px' }}>
                <strong style={{ display: 'inline-block', width: '80px', color: COLORS.muted }}>상태</strong>
                <Badge $tone={toneFromStatus(selectedMemberDetails.status)}>{selectedMemberDetails.status}</Badge>
              </p>
              <p style={{ margin: '4px 0', fontSize: '13px' }}>
                <strong style={{ display: 'inline-block', width: '80px', color: COLORS.muted }}>가입일</strong>
                {fmtDate(selectedMemberDetails.createdAt)}
              </p>
            </div>

            <h4 style={{ fontSize: '14px', marginBottom: '8px' }}>보유 자산 내역</h4>
            {(!selectedMemberDetails.assets || selectedMemberDetails.assets.length === 0) ? (
              <EmptyState style={{ padding: '20px' }}>보유 자산이 없습니다.</EmptyState>
            ) : (
              <Table style={{ fontSize: '12px' }}>
                <thead>
                  <tr>
                    <th>자산 종류</th>
                    <th>비율/수량</th>
                    <th>대기(Locked)</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedMemberDetails.assets.map((a: any) => (
                    <tr key={a.assetId}>
                      <td>{a.assetType}</td>
                      <td>{a.assetType === 'KRW' ? fmt(a.balance) : a.balance}</td>
                      <td>{a.lockedBalance > 0 ? a.lockedBalance : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}

            <ModalButtonGroup style={{ marginTop: 24 }}>
              <ModalButton $variant="primary" onClick={() => setSelectedMemberDetails(null)}>
                확인 (닫기)
              </ModalButton>
            </ModalButtonGroup>
          </ModalContainer>
        </ModalOverlay>
      )}
    </>
  );
};

export default AdminDashboard;
