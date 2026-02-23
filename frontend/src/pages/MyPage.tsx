import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Header from '../components/Header';
import Footer from '../components/Footer';
import TierModal from '../components/TierModal';

/* ── styled ── */

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

const Card = styled.div`
  background: white;
  border-radius: 12px;
  padding: 32px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
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
  width: 140px;
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

const Badge = styled.span<{ $type: string }>`
  display: inline-block;
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  background: ${p =>
    p.$type === 'ACTIVE' ? '#dcfce7' :
      p.$type === 'ADMIN' ? '#dbeafe' :
        p.$type === 'USER' ? '#f0fdf4' :
          p.$type === 'VIP' ? '#fce7f3' :
            p.$type === 'GOLD' ? '#fef9c3' :
              p.$type === 'SILVER' ? '#f1f5f9' :
                p.$type === 'BRONZE' ? '#ffedd5' : '#fee2e2'};
  color: ${p =>
    p.$type === 'ACTIVE' ? '#16a34a' :
      p.$type === 'ADMIN' ? '#2563eb' :
        p.$type === 'USER' ? '#16a34a' :
          p.$type === 'VIP' ? '#be185d' :
            p.$type === 'GOLD' ? '#a16207' :
              p.$type === 'SILVER' ? '#475569' :
                p.$type === 'BRONZE' ? '#c2410c' : '#dc2626'};
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

  background: ${p => p.$primary ? '#093687' : 'white'};
  color: ${p => p.$primary ? 'white' : '#333'};
  border: ${p => p.$primary ? 'none' : '1px solid #d1d5db'};

  &:hover {
    background: ${p => p.$primary ? '#0a4099' : '#f5f5f5'};
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

/* ── types ── */

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
}

/* ── component ── */

const MyPage: React.FC = () => {
  const navigate = useNavigate();
  const [member, setMember] = useState<MemberInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [totalVolume, setTotalVolume] = useState<number>(0);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // 수정 폼 상태
  const [form, setForm] = useState({
    name: '',
    phoneNumber: '',
    address: '',
    bankName: '',
    accountNumber: '',
    accountHolder: '',
  });

  const getToken = () => localStorage.getItem('accessToken') || localStorage.getItem('token');

  useEffect(() => {
    const token = getToken();
    if (!token) {
      navigate('/login', { replace: true });
      return;
    }

    const headers = { Authorization: `Bearer ${token}` };

    axios.get('http://localhost:8080/api/auth/me', { headers })
      .then(res => {
        setMember(res.data);
        setTotalVolume(Number(res.data.totalVolume) || 0);
        setForm({
          name: res.data.name || '',
          phoneNumber: res.data.phoneNumber || '',
          address: res.data.address || '',
          bankName: res.data.bankName || '',
          accountNumber: res.data.accountNumber || '',
          accountHolder: res.data.accountHolder || '',
        });
      })
      .catch((err) => {
        if (err.response?.status === 401) {
          localStorage.removeItem('accessToken');
          navigate('/login', { replace: true });
        }
      })
      .finally(() => setLoading(false));
  }, [navigate]);

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
      await axios.put('http://localhost:8080/api/auth/me', form, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMember(prev => prev ? { ...prev, ...form } : prev);
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

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  if (loading) {
    return (
      <Container>
        <Header />
        <Main><Loading>로딩 중...</Loading></Main>
        <Footer />
      </Container>
    );
  }

  if (!member) {
    return (
      <Container>
        <Header />
        <Main><Loading>회원 정보를 불러올 수 없습니다.</Loading></Main>
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

        {/* 회원 정보 */}
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
              {editing
                ? <Input value={form.name} onChange={e => handleChange('name', e.target.value)} />
                : member.name}
            </Value>
          </InfoRow>
          <InfoRow>
            <Label>내 추천인 코드</Label>
            <Value style={{ fontWeight: 600, color: '#093687' }}>{member.referralCode || '발급 전 (자동 갱신 예정)'}</Value>
          </InfoRow>
          <InfoRow>
            <Label>연락처</Label>
            <Value>
              {editing
                ? <Input value={form.phoneNumber} onChange={e => handleChange('phoneNumber', e.target.value)} placeholder="010-0000-0000" />
                : member.phoneNumber || '-'}
            </Value>
          </InfoRow>
          <InfoRow>
            <Label>주소</Label>
            <Value>
              {editing
                ? <Input value={form.address} onChange={e => handleChange('address', e.target.value)} />
                : member.address || '-'}
            </Value>
          </InfoRow>
          <InfoRow>
            <Label>등급</Label>
            <Value style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Badge $type={tier}>{tier}</Badge>
              <button
                onClick={() => setIsModalOpen(true)}
                style={{
                  background: 'none', border: 'none', color: '#093687',
                  textDecoration: 'underline', cursor: 'pointer', fontSize: '13px', padding: 0, fontWeight: 600
                }}
              >
                수수료 정책 보기
              </button>
            </Value>
          </InfoRow>
          <InfoRow>
            <Label>상태</Label>
            <Value><Badge $type={member.status}>{member.status === 'ACTIVE' ? '활성' : member.status}</Badge></Value>
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

        {/* 계좌 정보 */}
        <Card>
          <CardHeader>
            <CardTitle>계좌 정보</CardTitle>
          </CardHeader>

          <InfoRow>
            <Label>은행명</Label>
            <Value>
              {editing
                ? <Input value={form.bankName} onChange={e => handleChange('bankName', e.target.value)} placeholder="은행명 입력" />
                : member.bankName || '-'}
            </Value>
          </InfoRow>
          <InfoRow>
            <Label>계좌번호</Label>
            <Value>
              {editing
                ? <Input value={form.accountNumber} onChange={e => handleChange('accountNumber', e.target.value)} placeholder="계좌번호 입력" />
                : member.accountNumber || '-'}
            </Value>
          </InfoRow>
          <InfoRow>
            <Label>예금주</Label>
            <Value>
              {editing
                ? <Input value={form.accountHolder} onChange={e => handleChange('accountHolder', e.target.value)} placeholder="예금주 입력" />
                : member.accountHolder || '-'}
            </Value>
          </InfoRow>
        </Card>

        <TierModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          currentVolume={totalVolume}
        />
      </Main>
      <Footer />
    </Container>
  );
};

export default MyPage;
