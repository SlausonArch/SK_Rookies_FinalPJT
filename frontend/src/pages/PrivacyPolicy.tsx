import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import styled from 'styled-components';
import Header from '../components/Header';
import Footer from '../components/Footer';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

const Container = styled.div`
  min-height: 100vh;
  background: #f5f6f7;
  display: flex;
  flex-direction: column;
`;

const Main = styled.main`
  flex: 1;
  max-width: 980px;
  width: 100%;
  margin: 36px auto;
  padding: 0 20px;
`;

const Card = styled.article`
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06);
  padding: 32px;
`;

const Title = styled.h1`
  margin: 0 0 24px;
  color: #111827;
  font-size: 28px;
  font-weight: 800;
`;

const Pre = styled.pre`
  white-space: pre-wrap;
  word-break: break-word;
  font-family: inherit;
  font-size: 14px;
  line-height: 1.8;
  color: #374151;
`;

const ErrorMsg = styled.div`
  color: #b91c1c;
  padding: 20px;
  text-align: center;
`;

const PrivacyPolicy: React.FC = () => {
  const [searchParams] = useSearchParams();
  // V-04 (Path Traversal): doc 파라미터를 검증 없이 서버 API에 전달
  // 공격 예시:
  //   /privacy-policy?doc=../deployment-env.md
  //   /privacy-policy?doc=system_architecture_analysis.md
  //   /privacy-policy?doc=../../etc/passwd
  const doc = searchParams.get('doc') || 'privacy_policy.md';

  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    axios
      .get<string>(`${API_BASE}/api/files`, {
        params: { path: doc },
        responseType: 'text',
        transformResponse: (data: string) => data,
      })
      .then(res => setContent(res.data))
      .catch(() => setError(`문서를 불러올 수 없습니다: ${doc}`))
      .finally(() => setLoading(false));
  }, [doc]);

  return (
    <Container>
      <Header />
      <Main>
        <Card>
          <Title>개인정보처리방침</Title>
          {loading && <Pre>불러오는 중...</Pre>}
          {error && <ErrorMsg>{error}</ErrorMsg>}
          {!loading && !error && content && <Pre>{content}</Pre>}
        </Card>
      </Main>
      <Footer />
    </Container>
  );
};

export default PrivacyPolicy;
