import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import styled from 'styled-components';
import Header from '../components/Header';
import Footer from '../components/Footer';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:18080';

const Page = styled.div`
  min-height: 100vh;
  background: #f7f9fc;
  display: flex;
  flex-direction: column;
`;

const Main = styled.main`
  flex: 1;
  max-width: 1100px;
  margin: 24px auto 40px;
  width: 100%;
  padding: 0 20px;
`;

const Card = styled.section`
  background: #fff;
  border: 1px solid #e3e8f2;
  border-radius: 12px;
  box-shadow: 0 6px 22px rgba(15, 32, 66, 0.06);
  padding: 24px;
`;

const Title = styled.h1`
  margin: 0 0 8px;
  color: #1f2f55;
  font-size: 28px;
`;

const Sub = styled.p`
  margin: 0 0 18px;
  color: #5f6f8f;
  font-size: 14px;
`;

const Body = styled.div`
  color: #233354;
  line-height: 1.65;

  h1, h2, h3 {
    color: #122852;
    margin-top: 22px;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    margin: 12px 0;
    display: block;
    overflow-x: auto;
  }

  th, td {
    border: 1px solid #d7e0ee;
    padding: 8px 10px;
    font-size: 13px;
    white-space: nowrap;
  }

  code {
    background: #f2f6fd;
    border: 1px solid #dee6f4;
    border-radius: 6px;
    padding: 2px 6px;
  }

  pre code {
    display: block;
    padding: 12px;
    overflow-x: auto;
  }
`;

const Msg = styled.div`
  color: #5f6f8f;
  font-size: 14px;
  padding: 18px 0;
`;

const ApiDocs = () => {
  const [markdown, setMarkdown] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/dev/api-docs`);
        if (!response.ok) {
          throw new Error('문서 조회 실패');
        }
        const text = await response.text();
        setMarkdown(text);
      } catch {
        setError('API 문서를 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  return (
    <Page>
      <Header />
      <Main>
        <Card>
          <Title>API Docs</Title>
          <Sub>로컬 개발용 API 문서입니다. 배포 환경에서는 비활성화됩니다.</Sub>
          {loading && <Msg>문서를 불러오는 중입니다...</Msg>}
          {!loading && error && <Msg>{error}</Msg>}
          {!loading && !error && (
            <Body>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
            </Body>
          )}
        </Card>
      </Main>
      <Footer />
    </Page>
  );
};

export default ApiDocs;

