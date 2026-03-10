import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import styled from 'styled-components';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
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

const MarkdownBody = styled.div`
  font-size: 14px;
  line-height: 1.8;
  color: #374151;

  h1, h2, h3, h4 {
    color: #111827;
    margin: 1.4em 0 0.4em;
    font-weight: 700;
  }
  h1 { font-size: 22px; }
  h2 { font-size: 18px; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; }
  h3 { font-size: 15px; }

  p { margin: 0.6em 0; }

  ul, ol {
    padding-left: 1.5em;
    margin: 0.6em 0;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    margin: 1em 0;
    font-size: 13px;
  }
  th, td {
    border: 1px solid #d1d5db;
    padding: 8px 12px;
    text-align: left;
  }
  th {
    background: #f3f4f6;
    font-weight: 600;
  }
  tr:nth-child(even) td {
    background: #f9fafb;
  }

  hr {
    border: none;
    border-top: 1px solid #e5e7eb;
    margin: 1.5em 0;
  }

  strong { font-weight: 700; }
  code {
    background: #f3f4f6;
    padding: 1px 5px;
    border-radius: 4px;
    font-size: 13px;
  }
`;

const LoadingText = styled.p`
  color: #6b7280;
  font-size: 14px;
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
          {loading && <LoadingText>불러오는 중...</LoadingText>}
          {error && <ErrorMsg>{error}</ErrorMsg>}
          {!loading && !error && content && (
            <MarkdownBody>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
            </MarkdownBody>
          )}
        </Card>
      </Main>
      <Footer />
    </Container>
  );
};

export default PrivacyPolicy;
