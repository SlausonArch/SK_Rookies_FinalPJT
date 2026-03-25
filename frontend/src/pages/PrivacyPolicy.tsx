import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import styled from 'styled-components';
import Header from '../components/Header';
import Footer from '../components/Footer';

const PRIVACY_POLICY_CONTENT = `## 제1조 (개인정보의 처리 목적)

본 서비스는 다음의 목적을 위하여 개인정보를 처리합니다. 처리하고 있는 개인정보는 다음의 목적 이외의 용도로는 이용되지 않으며, 이용 목적이 변경되는 경우에는 별도의 동의를 받는 등 필요한 조치를 이행할 예정입니다.

1. 회원 가입 및 관리
2. 금융 서비스 제공 (가상자산 거래)
3. 서비스 개선 및 신규 서비스 개발

## 제2조 (처리하는 개인정보 항목)

- 이름, 이메일 주소, 전화번호
- 주소
- 은행 계좌 정보 (은행명, 계좌번호, 예금주)
- 신분증 사본 (본인 인증 목적)
- 서비스 이용 기록, 접속 로그, IP 정보

## 제3조 (개인정보의 처리 및 보유 기간)

회원 탈퇴 시까지 보유하며, 관련 법령에 따라 일정 기간 보존이 필요한 경우 해당 기간 동안 보관합니다.

## 제4조 (개인정보의 제3자 제공)

본 서비스는 이용자의 개인정보를 원칙적으로 외부에 제공하지 않습니다. 다만, 법령의 규정에 의거하거나 수사 기관의 요청이 있는 경우는 예외로 합니다.

## 제5조 (개인정보 보호책임자)

개인정보 보호에 관한 업무를 총괄해서 책임지는 개인정보 보호책임자를 다음과 같이 지정하고 있습니다.

- 이름: 개인정보보호 담당자
- 이메일: privacy@example.com

## 제6조 (정보주체의 권리·의무)

이용자는 개인정보주체로서 언제든지 개인정보 열람·정정·삭제·처리정지 요구 등의 권리를 행사할 수 있습니다.

본 방침은 2024년 1월 1일부터 시행됩니다.
`;

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

const PrivacyPolicy: React.FC = () => {
  return (
    <Container>
      <Header />
      <Main>
        <Card>
          <Title>개인정보처리방침</Title>
          <MarkdownBody>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {PRIVACY_POLICY_CONTENT}
            </ReactMarkdown>
          </MarkdownBody>
        </Card>
      </Main>
      <Footer />
    </Container>
  );
};

export default PrivacyPolicy;
