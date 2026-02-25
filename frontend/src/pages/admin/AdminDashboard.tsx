import { useState, useEffect, useCallback, useMemo, type ElementType } from 'react';
import styled, { createGlobalStyle } from 'styled-components';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
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

const SearchInput = styled.input`
  width: 260px;
  padding: 10px 14px 10px 38px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 8px;
  font-size: 13.5px;
  font-weight: 700;
  outline: none;
  background: rgba(0, 0, 0, 0.02);
  transition: all 180ms ease;

  &:focus {
    background: #fff;
    border-color: ${COLORS.borderHover};
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
  }

  &::placeholder {
    color: #a0aabf;
    font-weight: 600;
  }
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

const ModalText = styled.div`
  font-size: 13px;
  color: ${COLORS.text2};
  line-height: 1.7;
  margin-bottom: 12px;
  background: ${COLORS.surface2};
  padding: 14px;
  border: 1px solid ${COLORS.border2};
  border-radius: 14px;
  white-space: pre-wrap;
  max-height: 360px;
  overflow-y: auto;
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
  return new Date(v).toLocaleString('ko-KR');
}

function toneFromStatus(s: string): 'success' | 'danger' | 'warn' | 'info' | 'neutral' {
  if (s === 'ACTIVE') return 'success';
  if (s === 'LOCKED') return 'danger';
  if (s === 'WITHDRAWN') return 'neutral';
  if (s === 'PENDING') return 'warn';
  if (s === 'ANSWERED') return 'success';
  if (s === 'OPEN') return 'info';
  return 'warn';
}
function toneFromRole(r: string): 'info' | 'neutral' {
  return r === 'ADMIN' ? 'info' : 'neutral';
}
function toneFromOrderType(t: string): 'danger' | 'info' {
  return t === 'BUY' ? 'danger' : 'info';
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

  const userName = localStorage.getItem('name') || '관리자';
  const token = localStorage.getItem('token');

  const [stats, setStats] = useState<Stats | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [idApprovalMembers, setIdApprovalMembers] = useState<MemberRow[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [transactions, setTransactions] = useState<TxRow[]>([]);
  const [inquiries, setInquiries] = useState<InquiryRow[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  const [selectedPost, setSelectedPost] = useState<any>(null);
  const [selectedInquiry, setSelectedInquiry] = useState<InquiryRow | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [reclaimTarget, setReclaimTarget] = useState<AssetRow | null>(null);
  const [reclaimAmount, setReclaimAmount] = useState('');
  const [reclaimReason, setReclaimReason] = useState('');
  const [isReclaiming, setIsReclaiming] = useState(false);

  const [settingsMsg, setSettingsMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [newPw, setNewPw] = useState('');

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

  useEffect(() => {
    const t = localStorage.getItem('token');
    const r = localStorage.getItem('role');
    if (!t || r !== 'ADMIN') navigate('/admin/login', { replace: true });
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

  const handleLogout = () => {
    localStorage.clear();
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
                <option value="ADMIN">ADMIN</option>
                <option value="USER">USER</option>
                <option value="GUEST">GUEST</option>
              </Select>
              <Select
                value={memberQuery.status}
                onChange={e => setMemberQuery(s => ({ ...s, status: e.target.value, page: 0 }))}
              >
                <option value="">전체 상태</option>
                <option value="PENDING">PENDING</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="LOCKED">LOCKED</option>
                <option value="WITHDRAWN">WITHDRAWN</option>
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
                        <td>{m.email}</td>
                        <td>{m.name}</td>
                        <td>
                          <Badge $tone={toneFromRole(m.role)}>{m.role}</Badge>
                        </td>
                        <td>
                          <Badge $tone={toneFromStatus(m.status)}>{m.status}</Badge>
                        </td>
                        <td>{fmtDate(m.createdAt)}</td>
                        <td>
                          <Select value={m.status} onChange={e => handleStatusChange(m.memberId, e.target.value)}>
                            <option value="ACTIVE">ACTIVE</option>
                            <option value="LOCKED">LOCKED</option>
                            <option value="WITHDRAWN">WITHDRAWN</option>
                          </Select>
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
                      <td>{m.email}</td>
                      <td>{m.name}</td>
                      <td>
                        <Badge $tone={toneFromStatus(m.status)}>{m.status}</Badge>
                      </td>
                      <td>
                        {m.idPhotoUrl ? (
                          <span
                            onClick={() => setSelectedImage(m.idPhotoUrl!.startsWith('http') ? m.idPhotoUrl! : `${API_BASE}${m.idPhotoUrl!}`)}
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
                      <td>{o.memberName}</td>
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
                        <td>{a.memberName}</td>
                        <td>{a.memberEmail}</td>
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
                        <td>{tx.memberName}</td>
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
            (p.authorName?.toLowerCase() || p.author?.toLowerCase() || '').includes(term)
          );
        });

        return (
          <Card>
            <CardTitle>게시글 관리 ({posts.length}건)</CardTitle>

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
                  {filteredPosts.map((p: any) => (
                    <tr key={p.postId}>
                      <td>{p.postId}</td>
                      <td>
                        <LinkCell onClick={() => setSelectedPost(p)} title={p.title}>
                          {p.title}
                        </LinkCell>
                      </td>
                      <td>{p.authorName || p.author}</td>
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
                      <td>{inq.memberEmail}</td>
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
        );

      default:
        return null;
    }
  };

  const page = menuTitles[activeMenu];

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

              <SideSection>
                <SideSectionTitle $collapsed={sidebarCollapsed}>거래소 관리</SideSectionTitle>
                {(['members', 'idApprovals', 'orders', 'assets', 'deposits'] as const).map(key => (
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

              <SideSection>
                <SideSectionTitle $collapsed={sidebarCollapsed}>콘텐츠</SideSectionTitle>

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

                    {/* ✅ (옵션 적용) badgeText 출력 */}
                    {!sidebarCollapsed && <SideBadge $show={pendingInquiryCount > 0}>{badgeText}</SideBadge>}
                  </SideItem>

                  {/* ✅ (옵션 적용) badgeText 출력 */}
                  {sidebarCollapsed && (
                    <SideBadge $show={pendingInquiryCount > 0} $collapsed>
                      {badgeText}
                    </SideBadge>
                  )}
                </div>
              </SideSection>

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
            </SideNav>

            <SideFooter $collapsed={sidebarCollapsed}>
              <SideFooterUser $collapsed={sidebarCollapsed}>
                <SideFooterName>{userName}</SideFooterName>
                <SideFooterRole>ADMIN</SideFooterRole>
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
            <ModalOverlay onClick={() => setSelectedPost(null)}>
              <ModalContainer onClick={e => e.stopPropagation()}>
                <ModalTitle>{selectedPost.title}</ModalTitle>
                <ModalMeta>
                  작성자: {selectedPost.authorName || selectedPost.author} | 작성일: {fmtDate(selectedPost.createdAt)}
                </ModalMeta>
                <ModalText>{selectedPost.content}</ModalText>
                <ModalButtonGroup>
                  <ModalButton $variant="ghost" onClick={() => setSelectedPost(null)}>
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

                <ModalText style={{ maxHeight: '160px' }}>{selectedInquiry.content}</ModalText>

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
        <ImageModalOverlay onClick={() => setSelectedImage(null)}>
          <ImageModalContent onClick={e => e.stopPropagation()}>
            <CloseButton onClick={() => setSelectedImage(null)}>
              X
            </CloseButton>
            <img src={selectedImage} alt="ID Card Original" />
          </ImageModalContent>
        </ImageModalOverlay>
      )}
    </>
  );
};

export default AdminDashboard;
