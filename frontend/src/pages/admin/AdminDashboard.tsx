import { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_BASE = 'http://localhost:8080';

const Container = styled.div`
  display: flex;
  height: 100vh;
  background: #0f0f0f;
`;

const Sidebar = styled.div`
  width: 260px;
  background: linear-gradient(180deg, #1a1a1a 0%, #0a0a0a 100%);
  border-right: 1px solid #2a2a2a;
  display: flex;
  flex-direction: column;
`;

const Logo = styled.div`
  padding: 24px;
  font-size: 24px;
  font-weight: 700;
  color: #fff;
  border-bottom: 1px solid #2a2a2a;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const Nav = styled.nav`
  flex: 1;
  padding: 16px 0;
  overflow-y: auto;
`;

const NavSection = styled.div`
  margin-bottom: 24px;
`;

const NavTitle = styled.div`
  padding: 8px 24px;
  font-size: 11px;
  font-weight: 600;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const NavItem = styled.div<{ active?: boolean }>`
  padding: 12px 24px;
  color: ${props => props.active ? '#fff' : '#999'};
  background: ${props => props.active ? 'rgba(9, 54, 135, 0.15)' : 'transparent'};
  border-left: 3px solid ${props => props.active ? '#093687' : 'transparent'};
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 14px;
  font-weight: ${props => props.active ? '600' : '400'};
  transition: all 0.2s;
  &:hover { background: rgba(9, 54, 135, 0.1); color: #fff; }
`;

const UserInfo = styled.div`
  padding: 20px 24px;
  border-top: 1px solid #2a2a2a;
  display: flex;
  align-items: center;
  gap: 12px;
`;

const Avatar = styled.div`
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: linear-gradient(135deg, #093687 0%, #0a4099 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-weight: 700;
  font-size: 14px;
`;

const UserDetails = styled.div`flex: 1;`;
const UserName = styled.div`color: #fff; font-size: 14px; font-weight: 600;`;
const UserRole = styled.div`color: #666; font-size: 12px;`;

const LogoutBtn = styled.button`
  padding: 6px 12px;
  background: transparent;
  border: 1px solid #2a2a2a;
  color: #999;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  &:hover { background: #1a1a1a; color: #fff; border-color: #444; }
`;

const ContentArea = styled.div`
  flex: 1;
  overflow-y: auto;
  background: #0f0f0f;
`;

const HeaderBar = styled.div`
  padding: 24px 32px;
  background: #1a1a1a;
  border-bottom: 1px solid #2a2a2a;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const PageTitle = styled.h1`
  font-size: 28px;
  margin: 0;
  color: #fff;
  font-weight: 700;
`;

const ActionButton = styled.button`
  padding: 10px 20px;
  background: #093687;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  &:hover { background: #0a4099; }
`;

const Main = styled.div`padding: 32px;`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
  margin-bottom: 32px;
`;

const StatCard = styled.div`
  background: linear-gradient(135deg, #1a1a1a 0%, #141414 100%);
  border: 1px solid #2a2a2a;
  border-radius: 12px;
  padding: 24px;
  &:hover { border-color: #093687; transform: translateY(-2px); }
  transition: all 0.3s;
`;

const StatLabel = styled.div`font-size: 13px; color: #999; margin-bottom: 8px;`;
const StatValue = styled.div`font-size: 32px; color: #fff; font-weight: 700; margin-bottom: 4px;`;

const Card = styled.div`
  background: #1a1a1a;
  border: 1px solid #2a2a2a;
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 24px;
`;

const CardTitle = styled.h2`
  font-size: 18px;
  color: #fff;
  margin: 0 0 20px 0;
  font-weight: 600;
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 60px 20px;
  color: #666;
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  th {
    text-align: left;
    padding: 10px 12px;
    font-size: 12px;
    font-weight: 600;
    color: #666;
    border-bottom: 1px solid #2a2a2a;
  }
  td {
    padding: 10px 12px;
    font-size: 13px;
    color: #ccc;
    border-bottom: 1px solid #1f1f1f;
  }
  tr:hover td { background: rgba(9, 54, 135, 0.05); }
`;

const Badge = styled.span<{ $color: string }>`
  display: inline-block;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
  color: #fff;
  background: ${p => p.$color};
`;

const Select = styled.select`
  padding: 4px 8px;
  font-size: 12px;
  background: #2a2a2a;
  color: #ccc;
  border: 1px solid #444;
  border-radius: 4px;
  cursor: pointer;
`;

const FormGroup = styled.div`margin-bottom: 16px;`;
const Label = styled.label`display: block; font-size: 13px; color: #999; margin-bottom: 4px;`;
const Input = styled.input`
  width: 100%;
  padding: 10px 12px;
  background: #2a2a2a;
  border: 1px solid #444;
  border-radius: 6px;
  color: #fff;
  font-size: 14px;
  box-sizing: border-box;
  &:focus { border-color: #093687; outline: none; }
`;

const SaveBtn = styled.button`
  padding: 10px 24px;
  background: #093687;
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  &:hover { background: #0a4099; }
  &:disabled { opacity: 0.5; }
`;

const Msg = styled.div<{ $ok: boolean }>`
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 13px;
  margin-bottom: 12px;
  background: ${p => p.$ok ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)'};
  color: ${p => p.$ok ? '#22c55e' : '#ef4444'};
`;

const ModalOverlay = styled.div`
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.6);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
`;

const ModalContainer = styled.div`
  background: #1a1a1a;
  border: 1px solid #2a2a2a;
  border-radius: 12px;
  width: 500px;
  max-width: 90%;
  padding: 32px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
`;

const ModalTitle = styled.h2`
  font-size: 20px;
  color: #fff;
  margin-top: 0;
  margin-bottom: 8px;
`;

const ModalText = styled.div`
  font-size: 14px;
  color: #ccc;
  line-height: 1.6;
  margin-bottom: 24px;
  background: #2a2a2a;
  padding: 16px;
  border-radius: 8px;
  white-space: pre-wrap;
  max-height: 400px;
  overflow-y: auto;
`;

const ModalButtonGroup = styled.div`
  display: flex;
  gap: 12px;
  justify-content: flex-end;
`;

const ModalButton = styled.button`
  padding: 10px 20px;
  background: #333;
  color: #fff;
  border: 1px solid #444;
  border-radius: 6px;
  cursor: pointer;
  &:hover { background: #444; }
`;

interface MemberRow { memberId: number; email: string; name: string; phoneNumber: string | null; role: string; status: string; createdAt: string | null; }
interface OrderRow { orderId: number; memberEmail: string; memberName: string; orderType: string; assetType: string; price: number; amount: number; filledAmount: number; status: string; createdAt: string | null; }
interface AssetRow { assetId: number; memberEmail: string; memberName: string; assetType: string; balance: number; lockedBalance: number; }
interface TxRow { txId: number; memberEmail: string; memberName: string; txType: string; assetType: string; amount: number; price: number | null; totalValue: number | null; fee: number | null; txDate: string | null; }
interface InquiryRow { inquiryId: number; memberEmail: string; memberName: string; title: string; content: string; status: string; reply: string | null; attachmentUrl: string | null; createdAt: string | null; }
interface Stats { totalMembers: number; activeMembers: number; totalOrders: number; totalKrwBalance: number; totalTransactions: number; }

function fmt(n: number, d = 0) { return n.toLocaleString('ko-KR', { maximumFractionDigits: d }); }
function fmtDate(v: string | null) { if (!v) return '-'; return new Date(v).toLocaleString('ko-KR'); }

function statusColor(s: string) {
  if (s === 'ACTIVE') return '#22c55e';
  if (s === 'LOCKED') return '#ef4444';
  if (s === 'WITHDRAWN') return '#666';
  return '#f59e0b';
}

function txColor(t: string) {
  if (t === 'BUY') return '#ef4444';
  if (t === 'SELL') return '#3b82f6';
  if (t === 'DEPOSIT') return '#22c55e';
  if (t === 'WITHDRAW') return '#f59e0b';
  return '#666';
}

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [activeMenu, setActiveMenu] = useState('dashboard');
  const userName = localStorage.getItem('name') || '관리자';
  const token = localStorage.getItem('token');

  const [stats, setStats] = useState<Stats | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [transactions, setTransactions] = useState<TxRow[]>([]);
  const [inquiries, setInquiries] = useState<InquiryRow[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPost, setSelectedPost] = useState<any>(null);
  const [selectedInquiry, setSelectedInquiry] = useState<InquiryRow | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [settingsMsg, setSettingsMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [newPw, setNewPw] = useState('');

  useEffect(() => {
    const t = localStorage.getItem('token');
    const r = localStorage.getItem('role');
    if (!t || r !== 'ADMIN') navigate('/admin/login', { replace: true });
  }, [navigate]);

  const headers = { Authorization: `Bearer ${token}` };

  const fetchData = useCallback(() => {
    if (!token) return;
    const h = { Authorization: `Bearer ${token}` };
    if (activeMenu === 'dashboard') {
      axios.get(`${API_BASE}/api/admin/stats`, { headers: h }).then(r => setStats(r.data)).catch(() => { });
    } else if (activeMenu === 'members') {
      axios.get(`${API_BASE}/api/admin/members`, { headers: h }).then(r => setMembers(r.data)).catch(() => { });
    } else if (activeMenu === 'orders') {
      axios.get(`${API_BASE}/api/admin/orders`, { headers: h }).then(r => setOrders(r.data)).catch(() => { });
    } else if (activeMenu === 'assets') {
      axios.get(`${API_BASE}/api/admin/assets`, { headers: h }).then(r => setAssets(r.data)).catch(() => { });
    } else if (activeMenu === 'deposits') {
      axios.get(`${API_BASE}/api/admin/transactions`, { headers: h }).then(r => setTransactions(r.data)).catch(() => { });
    } else if (activeMenu === 'inquiries') {
      axios.get(`${API_BASE}/api/admin/inquiries`, { headers: h }).then(r => setInquiries(r.data)).catch(() => { });
    } else if (activeMenu === 'community') {
      axios.get(`${API_BASE}/api/community/posts`).then(r => setPosts(r.data.content || r.data)).catch(() => { });
    }
  }, [activeMenu, token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleStatusChange = async (memberId: number, newStatus: string) => {
    try {
      await axios.patch(`${API_BASE}/api/admin/members/${memberId}/status`, { status: newStatus }, { headers });
      setMembers(prev => prev.map(m => m.memberId === memberId ? { ...m, status: newStatus } : m));
    } catch { alert('상태 변경 실패'); }
  };

  const handleDeletePost = async (postId: number) => {
    if (!confirm('게시글을 삭제하시겠습니까?')) return;
    try {
      await axios.delete(`${API_BASE}/api/community/posts/${postId}`, { headers });
      setPosts(prev => prev.filter((p: any) => p.postId !== postId));
    } catch { alert('삭제 실패'); }
  };

  const handleReplyInquiry = async () => {
    if (!selectedInquiry || !replyContent.trim()) return;
    try {
      await axios.patch(`${API_BASE}/api/admin/inquiries/${selectedInquiry.inquiryId}/reply`,
        { status: 'ANSWERED', reply: replyContent }, { headers });
      setInquiries(prev => prev.map(inq =>
        inq.inquiryId === selectedInquiry.inquiryId ? { ...inq, status: 'ANSWERED', reply: replyContent } : inq
      ));
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

  const menuTitles: Record<string, string> = {
    dashboard: '대시보드', members: '회원 관리', orders: '거래 내역',
    assets: '자산 관리', deposits: '입출금 관리', inquiries: '고객센터 문의', community: '커뮤니티 관리', settings: '시스템 설정'
  };

  const renderContent = () => {
    switch (activeMenu) {
      case 'dashboard':
        return (
          <>
            <StatsGrid>
              <StatCard>
                <StatLabel>총 회원 수</StatLabel>
                <StatValue>{stats ? fmt(stats.totalMembers) : '-'}</StatValue>
              </StatCard>
              <StatCard>
                <StatLabel>활성 회원</StatLabel>
                <StatValue>{stats ? fmt(stats.activeMembers) : '-'}</StatValue>
              </StatCard>
              <StatCard>
                <StatLabel>총 주문 수</StatLabel>
                <StatValue>{stats ? fmt(stats.totalOrders) : '-'}</StatValue>
              </StatCard>
              <StatCard>
                <StatLabel>KRW 총 잔고</StatLabel>
                <StatValue>{stats ? `₩${fmt(stats.totalKrwBalance)}` : '-'}</StatValue>
              </StatCard>
            </StatsGrid>
            <Card>
              <CardTitle>요약</CardTitle>
              <div style={{ color: '#999', fontSize: 14 }}>
                총 거래 건수: {stats ? fmt(stats.totalTransactions) : '-'}건
              </div>
            </Card>
          </>
        );

      case 'members':
        return (
          <Card>
            <CardTitle>회원 목록 ({members.length}명)</CardTitle>
            {members.length === 0 ? <EmptyState>회원이 없습니다.</EmptyState> : (
              <Table>
                <thead><tr><th>ID</th><th>이메일</th><th>이름</th><th>역할</th><th>상태</th><th>가입일</th><th>상태 변경</th></tr></thead>
                <tbody>
                  {members.map(m => (
                    <tr key={m.memberId}>
                      <td>{m.memberId}</td>
                      <td>{m.email}</td>
                      <td>{m.name}</td>
                      <td><Badge $color={m.role === 'ADMIN' ? '#093687' : '#555'}>{m.role}</Badge></td>
                      <td><Badge $color={statusColor(m.status)}>{m.status}</Badge></td>
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
            )}
          </Card>
        );

      case 'orders':
        return (
          <Card>
            <CardTitle>전체 주문 ({orders.length}건)</CardTitle>
            {orders.length === 0 ? <EmptyState>주문 내역이 없습니다.</EmptyState> : (
              <Table>
                <thead><tr><th>ID</th><th>회원</th><th>유형</th><th>코인</th><th>가격</th><th>수량</th><th>체결량</th><th>상태</th><th>일시</th></tr></thead>
                <tbody>
                  {orders.map(o => (
                    <tr key={o.orderId}>
                      <td>{o.orderId}</td>
                      <td>{o.memberName}</td>
                      <td><Badge $color={o.orderType === 'BUY' ? '#ef4444' : '#3b82f6'}>{o.orderType}</Badge></td>
                      <td>{o.assetType}</td>
                      <td>{fmt(o.price)}</td>
                      <td>{o.amount}</td>
                      <td>{o.filledAmount}</td>
                      <td><Badge $color={statusColor(o.status)}>{o.status}</Badge></td>
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
            {assets.length === 0 ? <EmptyState>자산 내역이 없습니다.</EmptyState> : (
              <Table>
                <thead><tr><th>회원</th><th>이메일</th><th>자산</th><th>잔고</th><th>잠금</th></tr></thead>
                <tbody>
                  {assets.map(a => (
                    <tr key={a.assetId}>
                      <td>{a.memberName}</td>
                      <td>{a.memberEmail}</td>
                      <td>{a.assetType}</td>
                      <td>{a.assetType === 'KRW' ? fmt(a.balance) : a.balance}</td>
                      <td>{a.lockedBalance > 0 ? a.lockedBalance : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        );

      case 'deposits':
        return (
          <Card>
            <CardTitle>전체 입출금 ({transactions.length}건)</CardTitle>
            {transactions.length === 0 ? <EmptyState>입출금 내역이 없습니다.</EmptyState> : (
              <Table>
                <thead><tr><th>ID</th><th>회원</th><th>유형</th><th>자산</th><th>수량</th><th>총액</th><th>수수료</th><th>일시</th></tr></thead>
                <tbody>
                  {transactions.map(tx => (
                    <tr key={tx.txId}>
                      <td>{tx.txId}</td>
                      <td>{tx.memberName}</td>
                      <td><Badge $color={txColor(tx.txType)}>{tx.txType}</Badge></td>
                      <td>{tx.assetType}</td>
                      <td>{tx.amount}</td>
                      <td>{tx.totalValue ? fmt(tx.totalValue) : '-'}</td>
                      <td>{tx.fee ? fmt(tx.fee, 8) : '-'}</td>
                      <td>{fmtDate(tx.txDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        );

      case 'community':
        const filteredPosts = posts.filter(p => {
          const term = searchTerm.toLowerCase();
          return (p.title?.toLowerCase() || '').includes(term) ||
            (p.content?.toLowerCase() || '').includes(term) ||
            (p.authorName?.toLowerCase() || p.author?.toLowerCase() || '').includes(term);
        });
        return (
          <Card>
            <CardTitle>게시글 관리 ({posts.length}건)</CardTitle>
            <div style={{ marginBottom: 16 }}>
              <Input
                placeholder="제목, 내용, 작성자 검색"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ maxWidth: 300 }}
              />
            </div>
            {filteredPosts.length === 0 ? <EmptyState>게시글이 없습니다.</EmptyState> : (
              <Table>
                <thead><tr><th>ID</th><th>제목</th><th>작성자</th><th>공지</th><th>작성일</th><th>삭제</th></tr></thead>
                <tbody>
                  {filteredPosts.map((p: any) => (
                    <tr key={p.postId}>
                      <td>{p.postId}</td>
                      <td
                        style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer', color: '#60a5fa', textDecoration: 'underline' }}
                        onClick={() => setSelectedPost(p)}
                      >
                        {p.title}
                      </td>
                      <td>{p.authorName || p.author}</td>
                      <td>{p.notice ? <Badge $color="#f59e0b">공지</Badge> : '-'}</td>
                      <td>{fmtDate(p.createdAt)}</td>
                      <td>
                        <LogoutBtn onClick={() => handleDeletePost(p.postId)}>삭제</LogoutBtn>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        );

      case 'inquiries':
        return (
          <Card>
            <CardTitle>1:1 문의 관리 ({inquiries.length}건)</CardTitle>
            {inquiries.length === 0 ? <EmptyState>등록된 문의가 없습니다.</EmptyState> : (
              <Table>
                <thead><tr><th>ID</th><th>이메일</th><th>이름</th><th>제목</th><th>상태</th><th>등록일</th><th>답변</th></tr></thead>
                <tbody>
                  {inquiries.map((inq) => (
                    <tr key={inq.inquiryId}>
                      <td>{inq.inquiryId}</td>
                      <td>{inq.memberEmail}</td>
                      <td>{inq.memberName}</td>
                      <td
                        style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer', color: '#60a5fa', textDecoration: 'underline' }}
                        onClick={() => {
                          setSelectedInquiry(inq);
                          setReplyContent(inq.reply || '');
                        }}
                      >{inq.title}</td>
                      <td><Badge $color={inq.status === 'PENDING' ? '#f59e0b' : '#22c55e'}>{inq.status === 'PENDING' ? '답변대기' : '답변완료'}</Badge></td>
                      <td>{fmtDate(inq.createdAt)}</td>
                      <td>
                        <LogoutBtn onClick={() => {
                          setSelectedInquiry(inq);
                          setReplyContent(inq.reply || '');
                        }}>상세 보기</LogoutBtn>
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
            <FormGroup>
              <Label>새 비밀번호</Label>
              <Input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="새 비밀번호 입력" />
            </FormGroup>
            <SaveBtn disabled={!newPw} onClick={async () => {
              try {
                await axios.put(`${API_BASE}/api/admin/change-password`, { newPassword: newPw }, { headers });
                setSettingsMsg({ text: '비밀번호가 변경되었습니다.', ok: true });
                setNewPw('');
              } catch {
                setSettingsMsg({ text: '비밀번호 변경 기능은 준비 중입니다.', ok: false });
              }
            }}>비밀번호 변경</SaveBtn>
          </Card>
        );

      default:
        return null;
    }
  };

  return (
    <Container>
      <Sidebar>
        <Logo>VCE Admin</Logo>
        <Nav>
          <NavSection>
            <NavTitle>메인</NavTitle>
            <NavItem active={activeMenu === 'dashboard'} onClick={() => setActiveMenu('dashboard')}>대시보드</NavItem>
          </NavSection>
          <NavSection>
            <NavTitle>거래소 관리</NavTitle>
            <NavItem active={activeMenu === 'members'} onClick={() => setActiveMenu('members')}>회원 관리</NavItem>
            <NavItem active={activeMenu === 'orders'} onClick={() => setActiveMenu('orders')}>거래 내역</NavItem>
            <NavItem active={activeMenu === 'assets'} onClick={() => setActiveMenu('assets')}>자산 관리</NavItem>
            <NavItem active={activeMenu === 'deposits'} onClick={() => setActiveMenu('deposits')}>입출금 관리</NavItem>
          </NavSection>
          <NavSection>
            <NavTitle>콘텐츠</NavTitle>
            <NavItem active={activeMenu === 'community'} onClick={() => setActiveMenu('community')}>커뮤니티 관리</NavItem>
            <NavItem active={activeMenu === 'inquiries'} onClick={() => setActiveMenu('inquiries')}>고객센터 문의</NavItem>
          </NavSection>
          <NavSection>
            <NavTitle>시스템</NavTitle>
            <NavItem active={activeMenu === 'settings'} onClick={() => setActiveMenu('settings')}>설정</NavItem>
          </NavSection>
        </Nav>
        <UserInfo>
          <Avatar>{userName[0]}</Avatar>
          <UserDetails>
            <UserName>{userName}</UserName>
            <UserRole>시스템 관리자</UserRole>
          </UserDetails>
          <LogoutBtn onClick={handleLogout}>로그아웃</LogoutBtn>
        </UserInfo>
      </Sidebar>
      <ContentArea>
        <HeaderBar>
          <PageTitle>{menuTitles[activeMenu] || ''}</PageTitle>
          <ActionButton onClick={fetchData}>새로고침</ActionButton>
        </HeaderBar>
        <Main>{renderContent()}</Main>
      </ContentArea>

      {selectedPost && (
        <ModalOverlay onClick={() => setSelectedPost(null)}>
          <ModalContainer onClick={e => e.stopPropagation()}>
            <ModalTitle>{selectedPost.title}</ModalTitle>
            <div style={{ marginBottom: 16, fontSize: 13, color: '#999' }}>
              작성자: {selectedPost.authorName || selectedPost.author} | 작성일: {fmtDate(selectedPost.createdAt)}
            </div>
            <ModalText>{selectedPost.content}</ModalText>
            <ModalButtonGroup>
              <ModalButton onClick={() => setSelectedPost(null)}>닫기</ModalButton>
              <ModalButton
                onClick={() => {
                  handleDeletePost(selectedPost.postId);
                  setSelectedPost(null);
                }}
                style={{ background: '#ef4444', borderColor: '#ef4444' }}
              >
                게시글 삭제
              </ModalButton>
            </ModalButtonGroup>
          </ModalContainer>
        </ModalOverlay>
      )}

      {selectedInquiry && (
        <ModalOverlay onClick={() => { setSelectedInquiry(null); setReplyContent(''); }}>
          <ModalContainer onClick={e => e.stopPropagation()} style={{ width: '600px' }}>
            <ModalTitle>문의: {selectedInquiry.title}</ModalTitle>
            <div style={{ marginBottom: 16, fontSize: 13, color: '#999' }}>
              요청자: {selectedInquiry.memberName} ({selectedInquiry.memberEmail}) | 작성일: {fmtDate(selectedInquiry.createdAt)}
            </div>
            <ModalText style={{ maxHeight: '150px' }}>{selectedInquiry.content}</ModalText>

            {selectedInquiry.attachmentUrl && (
              <div style={{ marginBottom: '20px', fontSize: '13px' }}>
                <a href={`${API_BASE}${selectedInquiry.attachmentUrl}`} target="_blank" rel="noreferrer" style={{ color: '#60a5fa', textDecoration: 'underline' }}>
                  📎 첨부파일 존재함 (클릭하여 열기)
                </a>
              </div>
            )}

            <FormGroup>
              <Label>관리자 답변</Label>
              <textarea
                value={replyContent}
                onChange={e => setReplyContent(e.target.value)}
                style={{ width: '100%', boxSizing: 'border-box', padding: '10px', background: '#2a2a2a', color: '#fff', border: '1px solid #444', borderRadius: '6px', minHeight: '120px', fontSize: '14px' }}
                placeholder="답변 내용을 입력하세요..."
              />
            </FormGroup>

            <ModalButtonGroup>
              <ModalButton onClick={() => { setSelectedInquiry(null); setReplyContent(''); }}>취소</ModalButton>
              <ModalButton onClick={handleReplyInquiry} style={{ background: '#093687', borderColor: '#093687' }}>
                {selectedInquiry.status === 'ANSWERED' ? '답변 수정' : '답변 등록'}
              </ModalButton>
            </ModalButtonGroup>
          </ModalContainer>
        </ModalOverlay>
      )}
    </Container>
  );
};

export default AdminDashboard;
