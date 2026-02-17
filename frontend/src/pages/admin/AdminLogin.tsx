import { useState, useEffect } from 'react';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background-color: #1a1a1a;
`;

const LoginBox = styled.div`
  background: #2a2a2a;
  width: 400px;
  padding: 48px;
  border-radius: 8px;
  box-shadow: 0 4px 24px rgba(0,0,0,0.3);
`;

const Title = styled.h2`
  margin-bottom: 32px;
  font-size: 24px;
  color: #fff;
  font-weight: 700;
  text-align: center;
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const Input = styled.input`
  padding: 14px;
  border: 1px solid #444;
  border-radius: 6px;
  font-size: 15px;
  background: #333;
  color: #fff;
  
  &:focus {
    outline: none;
    border-color: #093687;
  }
  
  &::placeholder {
    color: #888;
  }
`;

const Button = styled.button`
  padding: 14px;
  background: #093687;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  margin-top: 8px;
  
  &:hover {
    background: #0a4099;
  }
  
  &:disabled {
    background: #555;
    cursor: not-allowed;
  }
`;

const ErrorMessage = styled.div`
  color: #ff4444;
  font-size: 14px;
  text-align: center;
`;

const AdminLogin = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 이미 로그인되어 있으면 대시보드로 리다이렉트
  useEffect(() => {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('role');

    if (token && role === 'ADMIN') {
      navigate('/admin/dashboard', { replace: true });
    }
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await axios.post('http://localhost:8080/api/auth/admin/login', {
        email,
        password
      });

      const { accessToken, role, email: userEmail, name } = response.data;

      // 토큰 및 사용자 정보 저장
      localStorage.setItem('token', accessToken);
      localStorage.setItem('role', role);
      localStorage.setItem('email', userEmail);
      localStorage.setItem('name', name);

      // 관리자 대시보드로 이동
      navigate('/admin/dashboard', { replace: true });
    } catch (err: any) {
      setError(err.response?.data || '로그인에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container>
      <LoginBox>
        <Title>🔒 관리자 로그인</Title>
        <Form onSubmit={handleSubmit}>
          <Input
            type="email"
            placeholder="관리자 이메일"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            type="password"
            placeholder="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
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
