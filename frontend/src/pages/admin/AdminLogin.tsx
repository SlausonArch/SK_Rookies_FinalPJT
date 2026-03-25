import { useState, useEffect } from 'react';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { getAdminAccessToken, getAdminRole, setAdminSession } from '../../utils/auth';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

/* --------------------------------- Theme (Dashboard Tone) --------------------------------- */
const COLORS = {
  bg: '#F1F4F8',
  surface: '#FFFFFF',
  surface2: '#F7F9FC',
  border: '#D9E1EA',
  text: '#1F2A37',
  text2: '#334155',
  muted: '#64748B',
  muted2: '#94A3B8',
  primary: '#2E6FB6',
  primaryHover: '#275F9B',
  primarySoft: '#E7F0FB',
  danger: '#E55353',
};

const SHADOW = {
  card: '0 20px 50px rgba(31, 42, 55, 0.12)',
};

/* -------------------------------- Layout --------------------------------- */
const Container = styled.div`
  min-height: 100vh;
  background: linear-gradient(135deg, ${COLORS.bg} 0%, ${COLORS.surface2} 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
`;

const LoginBox = styled.div`
  width: 420px;
  max-width: 100%;
  background: ${COLORS.surface};
  border: 1px solid ${COLORS.border};
  border-radius: 18px;
  box-shadow: ${SHADOW.card};
  padding: 32px;
`;

const Header = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 22px;
`;

const Title = styled.h2`
  margin: 0;
  font-size: 20px;
  color: ${COLORS.text};
  font-weight: 950;
  letter-spacing: -0.2px;
`;

const Subtitle = styled.div`
  font-size: 13px;
  color: ${COLORS.muted};
  font-weight: 700;
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 14px;
`;

const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const Label = styled.label`
  font-size: 12px;
  color: ${COLORS.muted};
  font-weight: 900;
`;

const Input = styled.input`
  padding: 12px 14px;
  border: 1px solid ${COLORS.border};
  border-radius: 12px;
  font-size: 14px;
  background: ${COLORS.surface};
  color: ${COLORS.text2};
  box-sizing: border-box;
  transition: all 0.15s ease;

  &::placeholder {
    color: ${COLORS.muted2};
    font-weight: 600;
  }

  &:focus {
    outline: none;
    border-color: rgba(46, 111, 182, 0.55);
    box-shadow: 0 0 0 3px rgba(46, 111, 182, 0.12);
  }
`;

const Button = styled.button`
  padding: 12px 14px;
  background: ${COLORS.primary};
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 950;
  cursor: pointer;
  margin-top: 6px;
  transition: all 0.15s ease;

  &:hover {
    background: ${COLORS.primaryHover};
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const ErrorMessage = styled.div`
  border: 1px solid rgba(229, 83, 83, 0.25);
  background: rgba(229, 83, 83, 0.12);
  color: ${COLORS.danger};
  border-radius: 12px;
  padding: 10px 12px;
  font-size: 13px;
  font-weight: 800;
`;

const AdminLogin = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = getAdminAccessToken();
    const role = getAdminRole();
    if (token && (role === 'VCESYS_CORE' || role === 'VCESYS_MGMT' || role === 'VCESYS_EMP')) {
      navigate('/admin/dashboard', { replace: true });
    }
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await axios.post(`${API_BASE}/api/auth/admin/login`, {
        email,
        password,
      });

      const { accessToken } = response.data;
      setAdminSession(accessToken);

      navigate('/admin/dashboard', { replace: true });
    } catch {
      setError('아이디 또는 비밀번호를 확인해 주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container>
      <LoginBox>
        <Header>
          <Title>관리자 로그인</Title>
          <Subtitle>관리자 계정으로 로그인해 대시보드에 접근합니다.</Subtitle>
        </Header>

        <Form onSubmit={handleSubmit}>
          <Field>
            <Label htmlFor="admin-email">이메일</Label>
            <Input
              id="admin-email"
              type="email"
              placeholder="관리자 이메일"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="username"
            />
          </Field>

          <Field>
            <Label htmlFor="admin-password">비밀번호</Label>
            <Input
              id="admin-password"
              type="password"
              placeholder="비밀번호"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </Field>

          {error && <ErrorMessage>{error}</ErrorMessage>}

          <Button type="submit" disabled={loading}>
            {loading ? '로그인 중...' : '로그인'}
          </Button>
        </Form>
      </LoginBox>
    </Container>
  );
};

export default AdminLogin;
