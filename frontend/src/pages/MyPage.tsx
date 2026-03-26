import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Header from '../components/Header';
import Footer from '../components/Footer';
import TierModal from '../components/TierModal';
import { clearUserSession, getUserAccessToken } from '../utils/auth';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

const BANK_OPTIONS = [
  'NH농협은행',
  '우리은행',
  '신한은행',
  'KB국민은행',
  '하나은행',
  '카카오뱅크',
  '케이뱅크',
  '토스뱅크',
  'IBK기업은행',
  'SC제일은행',
  '경남은행',
  '광주은행',
  '대구은행',
  '부산은행',
  '전북은행',
  '제주은행',
  '수협은행',
  '산업은행',
  '새마을금고',
  '신협',
  '기타',
];

const Container = styled.div`
  min-height: 100vh;
  background: #f5f6f7;
  display: flex;
  flex-direction: column;
`;

const Main = styled.main`
  flex: 1;
  max-width: 800px;
  width: 100%;
  margin: 32px auto;
  padding: 0 20px;
`;

const PageTitle = styled.h1`
  font-size: 28px;
  color: #1a2e57;
  margin-bottom: 24px;
  font-weight: 700;
`;

const TabRow = styled.div`
  display: flex;
  gap: 8px;
  margin-bottom: 18px;
  flex-wrap: wrap;
`;

const TabButton = styled.button<{ $active: boolean }>`
  border: 1px solid ${p => (p.$active ? '#093687' : '#d1d8e3')};
  background: ${p => (p.$active ? '#eef3ff' : '#fff')};
  color: ${p => (p.$active ? '#093687' : '#444')};
  padding: 10px 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
`;

const Card = styled.div`
  background: white;
  border-radius: 12px;
  padding: 32px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  margin-bottom: 24px;
`;

const CardHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding-bottom: 12px;
  border-bottom: 2px solid #093687;
`;

const CardTitle = styled.h2`
  font-size: 18px;
  color: #1a2e57;
  font-weight: 700;
  margin: 0;
`;

const InfoRow = styled.div`
  display: flex;
  align-items: center;
  padding: 14px 0;
  border-bottom: 1px solid #f0f0f0;

  &:last-child {
    border-bottom: none;
  }
`;

const Label = styled.div`
  width: 150px;
  font-size: 14px;
  font-weight: 600;
  color: #666;
  flex-shrink: 0;
`;

const Value = styled.div`
  font-size: 14px;
  color: #333;
  flex: 1;
`;

const Input = styled.input`
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  color: #333;
  outline: none;
  transition: border-color 0.2s;

  &:focus {
    border-color: #093687;
  }
`;

const Select = styled.select`
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  color: #333;
  outline: none;
`;

const UploadHint = styled.div`
  font-size: 13px;
  color: #555;
  line-height: 1.6;
  background: #f8fafc;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 14px;
  margin-bottom: 16px;
`;

const Badge = styled.span<{ $type: string }>`
  display: inline-block;
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  background: ${p =>
    p.$type === 'ACTIVE'
      ? '#dcfce7'
      : p.$type === 'ADMIN'
        ? '#dbeafe'
        : p.$type === 'USER'
          ? '#f0fdf4'
          : p.$type === 'VIP'
            ? '#fce7f3'
            : p.$type === 'GOLD'
              ? '#fef9c3'
              : p.$type === 'SILVER'
                ? '#f1f5f9'
                : p.$type === 'BRONZE'
                  ? '#ffedd5'
                  : '#fee2e2'};
  color: ${p =>
    p.$type === 'ACTIVE'
      ? '#16a34a'
      : p.$type === 'ADMIN'
        ? '#2563eb'
        : p.$type === 'USER'
          ? '#16a34a'
          : p.$type === 'VIP'
            ? '#be185d'
            : p.$type === 'GOLD'
              ? '#a16207'
              : p.$type === 'SILVER'
                ? '#475569'
                : p.$type === 'BRONZE'
                  ? '#c2410c'
                  : '#dc2626'};
`;

const ButtonRow = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 20px;
`;

const Button = styled.button<{ $primary?: boolean }>`
  padding: 10px 24px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;

  background: ${p => (p.$primary ? '#093687' : 'white')};
  color: ${p => (p.$primary ? 'white' : '#333')};
  border: ${p => (p.$primary ? 'none' : '1px solid #d1d5db')};

  &:hover {
    background: ${p => (p.$primary ? '#0a4099' : '#f5f5f5')};
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const SuccessMsg = styled.div`
  color: #16a34a;
  font-size: 13px;
  text-align: right;
  margin-top: 8px;
`;

const ErrorMsg = styled.div`
  color: #dc2626;
  font-size: 13px;
  text-align: right;
  margin-top: 8px;
`;

const Loading = styled.div`
  text-align: center;
  padding: 60px;
  color: #999;
`;

const WithdrawButton = styled.button`
  margin-top: 32px;
  width: 100%;
  padding: 16px;
  border-radius: 8px;
  border: 1px solid #ff4d4f;
  background: white;
  color: #ff4d4f;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: #fff1f0;
  }
`;

const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
`;

const ModalContainer = styled.div`
  background: white;
  border-radius: 12px;
  width: 420px;
  max-width: 90%;
  padding: 32px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
`;

const ModalTitle = styled.h2`
  font-size: 20px;
  color: #1a2e57;
  margin-top: 0;
  margin-bottom: 16px;
`;

const ModalText = styled.div`
  font-size: 14px;
  color: #333;
  line-height: 1.6;
  margin-bottom: 24px;
  background: #f8f9fa;
  padding: 16px;
  border-radius: 8px;
`;

const ModalButtonGroup = styled.div`
  display: flex;
  gap: 12px;
  justify-content: flex-end;
`;

const ModalButton = styled(Button)`
  padding: 10px 20px;
  min-width: 80px;
`;

interface MemberInfo {
  memberId: number;
  email: string;
  name: string;
  phoneNumber: string;
  address: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  role: string;
  status: string;
  createdAt: string;
  referralCode?: string;
  hasIdPhoto?: boolean;
  idPhotoUrl?: string;
}

type MyPageTab = 'profile' | 'account' | 'idPhoto';

const MyPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [member, setMember] = useState<MemberInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [totalVolume, setTotalVolume] = useState<number>(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [activeTab, setActiveTab] = useState<MyPageTab>('profile');
  const [idPhotoFile, setIdPhotoFile] = useState<File | null>(null);
  const [idSubmitting, setIdSubmitting] = useState(false);
  const [idSubmitMsg, setIdSubmitMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const [form, setForm] = useState({
    name: '',
    phoneNumber: '',
    address: '',
    bankName: '',
    accountNumber: '',
    accountHolder: '',
  });

  const getToken = () => getUserAccessToken();
  const loginRedirectUrl = `/login?redirect=${encodeURIComponent(`${location.pathname}${location.search || ''}`)}`;

  useEffect(() => {
    const token = getToken();
    if (!token) {
      navigate(loginRedirectUrl, { replace: true });
      return;
    }

    axios
      .get(`${API_BASE}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => {
        const payload = res.data || {};
        const normalizedMember: MemberInfo = {
          ...payload,
          hasIdPhoto: Boolean(payload.hasIdPhoto || payload.idPhotoUrl),
          idPhotoUrl: payload.idPhotoUrl || '',
        };
        setMember(normalizedMember);
        setTotalVolume(Number(payload.totalVolume) || 0);
        setForm({
          name: payload.name || '',
          phoneNumber: payload.phoneNumber || '',
          address: payload.address || '',
          bankName: payload.bankName || '',
          accountNumber: payload.accountNumber || '',
          accountHolder: payload.accountHolder || '',
        });
      })
      .catch(err => {
        if (err.response?.status === 401) {
          clearUserSession(true);
          navigate(loginRedirectUrl, { replace: true });
        }
      })
      .finally(() => setLoading(false));
  }, [navigate, loginRedirectUrl]);

  const handleEdit = () => {
    setEditing(true);
    setSuccessMsg('');
    setErrorMsg('');
  };

  const handleCancel = () => {
    if (member) {
      setForm({
        name: member.name || '',
        phoneNumber: member.phoneNumber || '',
        address: member.address || '',
        bankName: member.bankName || '',
        accountNumber: member.accountNumber || '',
        accountHolder: member.accountHolder || '',
      });
    }
    setEditing(false);
    setSuccessMsg('');
    setErrorMsg('');
  };

  const handleSave = async () => {
    const token = getToken();
    if (!token) return;

    setSaving(true);
    setSuccessMsg('');
    setErrorMsg('');

    try {
      await axios.patch(`${API_BASE}/api/auth/me`, form, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMember(prev => (prev ? { ...prev, ...form } : prev));
      setEditing(false);
      setSuccessMsg('회원 정보가 수정되었습니다.');
    } catch {
      setErrorMsg('회원 정보 수정에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleTabChange = (tab: MyPageTab) => {
    setActiveTab(tab);
    setEditing(false);
    setSuccessMsg('');
    setErrorMsg('');
  };

  const handleSubmitIdPhoto = async () => {
    const token = getToken();
    if (!token || !idPhotoFile) return;

    setIdSubmitting(true);
    setIdSubmitMsg(null);

    try {
      const formData = new FormData();
      formData.append('file', idPhotoFile);

      const { data } = await axios.post(`${API_BASE}/api/auth/me/id-photo`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      });

      setMember(prev =>
        prev
          ? {
            ...prev,
            status: data.status || prev.status,
            hasIdPhoto: true,
            idPhotoUrl: data.idPhotoUrl || prev.idPhotoUrl || '',
          }
          : prev,
      );
      setIdPhotoFile(null);
      setIdSubmitMsg({
        text: data.message || '신분증 제출이 완료되었습니다.',
        ok: true,
      });
      setActiveTab('profile');
    } catch (err: any) {
      setIdSubmitMsg({
        text: err.response?.data?.message || '신분증 제출에 실패했습니다.',
        ok: false,
      });
    } finally {
      setIdSubmitting(false);
    }
  };

  const handleWithdrawAccount = async () => {
    const token = getToken();
    if (!token) return;

    setWithdrawing(true);
    try {
      await axios.post(
        `${API_BASE}/api/auth/withdraw`,
        {},
        { headers: { Authorization: `Bearer ${token}` }, withCredentials: true },
      );
      clearUserSession(true);
      navigate('/withdrawal-complete', { replace: true });
    } catch (err: any) {
      alert(
        err.response?.data?.message ||
        '회원 탈퇴 처리에 실패했습니다. 잔여 코인 또는 미체결 주문을 확인해주세요.',
      );
    } finally {
      setWithdrawing(false);
      setIsWithdrawModalOpen(false);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const statusLabel = (status: string) => {
    if (status === 'ACTIVE') return '활성';
    if (status === 'LOCKED') return '입출금/코인거래 제한';
    if (status === 'WITHDRAWN') return '탈퇴';
    return status;
  };

  if (loading) {
    return (
      <Container>
        <Header />
        <Main>
          <Loading>로딩 중...</Loading>
        </Main>
        <Footer />
      </Container>
    );
  }

  if (!member) {
    return (
      <Container>
        <Header />
        <Main>
          <Loading>회원 정보를 불러올 수 없습니다.</Loading>
        </Main>
        <Footer />
      </Container>
    );
  }

  let tier = 'BRONZE';
  if (totalVolume >= 20000000000) tier = 'VIP';
  else if (totalVolume >= 2000000000) tier = 'GOLD';
  else if (totalVolume >= 100000000) tier = 'SILVER';

  return (
    <Container>
      <Header />
      <Main>
        <PageTitle>마이페이지</PageTitle>

        <TabRow>
          <TabButton $active={activeTab === 'profile'} onClick={() => handleTabChange('profile')}>
            회원 정보
          </TabButton>
          <TabButton $active={activeTab === 'account'} onClick={() => handleTabChange('account')}>
            계좌 정보
          </TabButton>
          {!member.hasIdPhoto && (
            <TabButton $active={activeTab === 'idPhoto'} onClick={() => handleTabChange('idPhoto')}>
              신분증 제출
            </TabButton>
          )}
        </TabRow>

        {activeTab === 'profile' && (
          <Card>
            <CardHeader>
              <CardTitle>회원 정보</CardTitle>
              {!editing && <Button onClick={handleEdit}>수정</Button>}
            </CardHeader>

            <InfoRow>
              <Label>이메일</Label>
              <Value>{member.email}</Value>
            </InfoRow>
            <InfoRow>
              <Label>이름</Label>
              <Value>
                {editing ? (
                  <Input value={form.name} onChange={e => handleChange('name', e.target.value)} />
                ) : (
                  member.name
                )}
              </Value>
            </InfoRow>
            <InfoRow>
              <Label>내 추천인 코드</Label>
              <Value style={{ fontWeight: 600, color: '#093687' }}>
                {member.referralCode || '발급 예정'}
              </Value>
            </InfoRow>
            <InfoRow>
              <Label>연락처</Label>
              <Value>
                {editing ? (
                  <Input
                    value={form.phoneNumber}
                    onChange={e => handleChange('phoneNumber', e.target.value)}
                    placeholder="010-0000-0000"
                  />
                ) : (
                  member.phoneNumber || '-'
                )}
              </Value>
            </InfoRow>
            <InfoRow>
              <Label>주소</Label>
              <Value>
                {editing ? (
                  <Input value={form.address} onChange={e => handleChange('address', e.target.value)} />
                ) : (
                  member.address || '-'
                )}
              </Value>
            </InfoRow>
            <InfoRow>
              <Label>등급</Label>
              <Value style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Badge $type={tier}>{tier}</Badge>
                <button
                  onClick={() => setIsModalOpen(true)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#093687',
                    textDecoration: 'underline',
                    cursor: 'pointer',
                    fontSize: '13px',
                    padding: 0,
                    fontWeight: 600,
                  }}
                >
                  수수료 정책 보기
                </button>
              </Value>
            </InfoRow>
            <InfoRow>
              <Label>상태</Label>
              <Value>
                <Badge $type={member.status}>{statusLabel(member.status)}</Badge>
              </Value>
            </InfoRow>
            <InfoRow>
              <Label>가입일</Label>
              <Value>{formatDate(member.createdAt)}</Value>
            </InfoRow>

            {editing && (
              <ButtonRow>
                <Button onClick={handleCancel}>취소</Button>
                <Button $primary onClick={handleSave} disabled={saving}>
                  {saving ? '저장 중...' : '저장'}
                </Button>
              </ButtonRow>
            )}
            {successMsg && <SuccessMsg>{successMsg}</SuccessMsg>}
            {errorMsg && <ErrorMsg>{errorMsg}</ErrorMsg>}
          </Card>
        )}

        {activeTab === 'account' && (
          <Card>
            <CardHeader>
              <CardTitle>계좌 정보</CardTitle>
              {!editing && <Button onClick={handleEdit}>수정</Button>}
            </CardHeader>

            <InfoRow>
              <Label>은행명</Label>
              <Value>
                {editing ? (
                  <Select value={form.bankName} onChange={e => handleChange('bankName', e.target.value)}>
                    <option value="">은행 선택</option>
                    {BANK_OPTIONS.map(bank => (
                      <option key={bank} value={bank}>
                        {bank}
                      </option>
                    ))}
                  </Select>
                ) : (
                  member.bankName || '-'
                )}
              </Value>
            </InfoRow>
            <InfoRow>
              <Label>계좌번호</Label>
              <Value>
                {editing ? (
                  <Input
                    value={form.accountNumber}
                    onChange={e => handleChange('accountNumber', e.target.value)}
                    placeholder="계좌번호 입력"
                  />
                ) : (
                  member.accountNumber || '-'
                )}
              </Value>
            </InfoRow>
            <InfoRow>
              <Label>예금주</Label>
              <Value>
                <Input value={member.name || '-'} disabled style={{ backgroundColor: '#f5f5f5', color: '#888' }} />
              </Value>
            </InfoRow>

            {editing && (
              <ButtonRow>
                <Button onClick={handleCancel}>취소</Button>
                <Button $primary onClick={handleSave} disabled={saving}>
                  {saving ? '저장 중...' : '저장'}
                </Button>
              </ButtonRow>
            )}
            {successMsg && <SuccessMsg>{successMsg}</SuccessMsg>}
            {errorMsg && <ErrorMsg>{errorMsg}</ErrorMsg>}
          </Card>
        )}

        {activeTab === 'idPhoto' && !member.hasIdPhoto && (
          <Card>
            <CardHeader>
              <CardTitle>신분증 제출</CardTitle>
            </CardHeader>
            <UploadHint>
              신분증 제출 전까지 계정 상태는 LOCKED(입출금 및 코인거래 제한)입니다.
              <br />
              제출 후 관리자가 확인/승인하면 ACTIVE 상태로 변경됩니다.
            </UploadHint>

            <InfoRow>
              <Label>파일 선택</Label>
              <Value>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={e => setIdPhotoFile(e.target.files?.[0] || null)}
                />
                {idPhotoFile && (
                  <div style={{ marginTop: '8px', fontSize: '13px', color: '#555' }}>
                    선택 파일: {idPhotoFile.name}
                  </div>
                )}
              </Value>
            </InfoRow>

            <ButtonRow>
              <Button
                onClick={() => {
                  setIdPhotoFile(null);
                  setIdSubmitMsg(null);
                }}
                disabled={idSubmitting}
              >
                초기화
              </Button>
              <Button $primary onClick={handleSubmitIdPhoto} disabled={!idPhotoFile || idSubmitting}>
                {idSubmitting ? '제출 중...' : '제출'}
              </Button>
            </ButtonRow>
            {idSubmitMsg &&
              (idSubmitMsg.ok ? (
                <SuccessMsg>{idSubmitMsg.text}</SuccessMsg>
              ) : (
                <ErrorMsg>{idSubmitMsg.text}</ErrorMsg>
              ))}
          </Card>
        )}

        <TierModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} currentVolume={totalVolume} />

        <WithdrawButton onClick={() => setIsWithdrawModalOpen(true)}>회원 탈퇴</WithdrawButton>

        {isWithdrawModalOpen && (
          <ModalOverlay>
            <ModalContainer>
              <ModalTitle>회원 탈퇴 안내</ModalTitle>
              <ModalText>
                <strong>회원 탈퇴를 진행하시겠습니까?</strong>
                <br />
                <br />- 탈퇴 후 개인정보 및 거래 이력은 복구할 수 없습니다.
                <br />- 보유 자산이 있거나 미체결 주문이 있으면 탈퇴가 제한될 수 있습니다.
              </ModalText>
              <ModalButtonGroup>
                <ModalButton disabled={withdrawing} onClick={() => setIsWithdrawModalOpen(false)}>
                  취소
                </ModalButton>
                <ModalButton
                  style={{ background: '#ff4d4f', color: 'white', border: 'none' }}
                  disabled={withdrawing}
                  onClick={handleWithdrawAccount}
                >
                  {withdrawing ? '처리 중...' : '동의하고 탈퇴'}
                </ModalButton>
              </ModalButtonGroup>
            </ModalContainer>
          </ModalOverlay>
        )}
      </Main>
      <Footer />
    </Container>
  );
};

export default MyPage;
