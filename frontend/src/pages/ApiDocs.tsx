import { useMemo, useState } from 'react';
import styled from 'styled-components';
import Header from '../components/Header';
import Footer from '../components/Footer';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
type AuthLevel = 'none' | 'user' | 'admin';

interface Param {
  name: string;
  in: 'path' | 'query' | 'body' | 'formData';
  required: boolean;
  type: string;
  description: string;
}

interface Endpoint {
  method: HttpMethod;
  path: string;
  summary: string;
  auth: AuthLevel;
  params?: Param[];
  responseExample?: string;
}

interface ApiGroup {
  tag: string;
  description: string;
  baseUrl: string;
  endpoints: Endpoint[];
}

const API_GROUPS: ApiGroup[] = [
  {
    tag: '인증',
    description: '로그인, 회원가입, 회원 정보 관리',
    baseUrl: '/api/auth',
    endpoints: [
      {
        method: 'POST', path: '/api/auth/test/login', summary: '일반 로그인', auth: 'none',
        params: [
          { name: 'email', in: 'body', required: true, type: 'string', description: '이메일' },
          { name: 'password', in: 'body', required: true, type: 'string', description: '비밀번호' },
        ],
      },
      { method: 'POST', path: '/api/auth/admin/login', summary: '관리자 로그인', auth: 'none' },
      { method: 'GET', path: '/api/auth/me', summary: '내 정보 조회', auth: 'user' },
      { method: 'PATCH', path: '/api/auth/me', summary: '내 정보 수정', auth: 'user' },
      { method: 'POST', path: '/api/auth/me/id-photo', summary: '신분증 제출', auth: 'user' },
      { method: 'POST', path: '/api/auth/signup/complete', summary: '회원가입 완료', auth: 'user' },
      { method: 'POST', path: '/api/auth/withdraw', summary: '회원 탈퇴', auth: 'user' },
      { method: 'POST', path: '/api/auth/refresh', summary: '토큰 재발급', auth: 'none' },
      { method: 'POST', path: '/api/auth/logout', summary: '로그아웃', auth: 'user' },
    ],
  },
  {
    tag: '자산',
    description: '보유 자산 조회, 입출금, 은행 잔고',
    baseUrl: '/api/assets',
    endpoints: [
      { method: 'GET', path: '/api/assets', summary: '전체 자산 목록 조회', auth: 'user' },
      { method: 'GET', path: '/api/assets/summary', summary: '자산 요약 조회', auth: 'user' },
      { method: 'GET', path: '/api/assets/{assetType}', summary: '특정 자산 조회', auth: 'user' },
      { method: 'POST', path: '/api/assets/deposit', summary: '입금', auth: 'user' },
      { method: 'POST', path: '/api/assets/withdraw', summary: '출금', auth: 'user' },
      { method: 'GET', path: '/api/assets/bank-balance', summary: '은행 잔고 조회', auth: 'user' },
    ],
  },
  {
    tag: '주문',
    description: '매수/매도 주문 생성, 조회, 취소',
    baseUrl: '/api/orders',
    endpoints: [
      { method: 'POST', path: '/api/orders', summary: '주문 생성', auth: 'user' },
      { method: 'GET', path: '/api/orders', summary: '전체 주문 내역 조회', auth: 'user' },
      { method: 'GET', path: '/api/orders/open', summary: '미체결 주문 조회', auth: 'user' },
      { method: 'DELETE', path: '/api/orders/{orderId}', summary: '주문 취소', auth: 'user' },
    ],
  },
  {
    tag: '커뮤니티',
    description: '게시글, 댓글, 좋아요',
    baseUrl: '/api/community',
    endpoints: [
      { method: 'GET', path: '/api/community/posts', summary: '게시글 목록 조회', auth: 'none', params: [{ name: 'keyword', in: 'query', required: false, type: 'string', description: '검색 키워드' }] },
      { method: 'GET', path: '/api/community/posts/{postId}', summary: '게시글 상세 조회', auth: 'none' },
      { method: 'POST', path: '/api/community/posts', summary: '게시글 작성', auth: 'user' },
      { method: 'PATCH', path: '/api/community/posts/{postId}', summary: '게시글 수정', auth: 'user' },
      { method: 'POST', path: '/api/community/posts/{postId}/delete', summary: '게시글 삭제', auth: 'user' },
      { method: 'GET', path: '/api/community/posts/{postId}/comments', summary: '댓글 목록 조회', auth: 'none' },
      { method: 'POST', path: '/api/community/posts/{postId}/comments', summary: '댓글 작성', auth: 'user' },
      { method: 'PATCH', path: '/api/community/comments/{commentId}', summary: '댓글 수정', auth: 'user' },
      { method: 'POST', path: '/api/community/comments/{commentId}/delete', summary: '댓글 삭제', auth: 'user' },
      { method: 'POST', path: '/api/community/posts/{postId}/like', summary: '좋아요 토글', auth: 'user' },
      { method: 'POST', path: '/api/community/uploads', summary: '첨부파일 업로드', auth: 'user' },
    ],
  },
  {
    tag: '시장',
    description: 'Upbit 시세 데이터',
    baseUrl: '/api/market',
    endpoints: [
      { method: 'GET', path: '/api/market/all', summary: '전체 마켓 목록', auth: 'none' },
      { method: 'GET', path: '/api/market/ticker', summary: '현재가 조회', auth: 'none' },
      { method: 'GET', path: '/api/market/candles/minutes/{unit}', summary: '분봉 캔들 조회', auth: 'none' },
      { method: 'GET', path: '/api/market/candles/days', summary: '일봉 캔들 조회', auth: 'none' },
      { method: 'GET', path: '/api/market/orderbook', summary: '호가창 조회', auth: 'none' },
      { method: 'GET', path: '/api/market/trades/ticks', summary: '체결 조회', auth: 'none' },
    ],
  },
  {
    tag: '지갑',
    description: '입금 주소 및 내부 이체',
    baseUrl: '/api/wallets',
    endpoints: [
      { method: 'GET', path: '/api/wallets/{assetType}/address', summary: '입금 주소 조회', auth: 'user' },
      { method: 'POST', path: '/api/wallets/transfer', summary: '내부 이체', auth: 'user' },
    ],
  },
  {
    tag: '거래내역',
    description: '사용자 거래 이력',
    baseUrl: '/api/transactions',
    endpoints: [
      { method: 'GET', path: '/api/transactions', summary: '거래내역 조회', auth: 'user' },
    ],
  },
  {
    tag: '고객지원',
    description: 'FAQ 및 1:1 문의',
    baseUrl: '/api/support',
    endpoints: [
      { method: 'GET', path: '/api/support/faqs', summary: 'FAQ 목록', auth: 'none' },
      { method: 'GET', path: '/api/support/inquiries', summary: '내 문의 목록', auth: 'user' },
      { method: 'POST', path: '/api/support/inquiries', summary: '문의 작성', auth: 'user' },
    ],
  },
  {
    tag: '관리자',
    description: '관리자 전용 API',
    baseUrl: '/api/admin',
    endpoints: [
      { method: 'GET', path: '/api/admin/members', summary: '회원 목록', auth: 'admin' },
      { method: 'GET', path: '/api/admin/members/search', summary: '회원 검색', auth: 'admin' },
      { method: 'PATCH', path: '/api/admin/members/{memberId}/status', summary: '회원 상태 변경', auth: 'admin' },
      { method: 'PATCH', path: '/api/admin/members/{memberId}/approve-id', summary: '신분증 승인', auth: 'admin' },
      { method: 'GET', path: '/api/admin/orders', summary: '전체 주문 목록', auth: 'admin' },
      { method: 'GET', path: '/api/admin/assets', summary: '전체 자산 목록', auth: 'admin' },
      { method: 'GET', path: '/api/admin/transactions', summary: '전체 거래내역', auth: 'admin' },
      { method: 'GET', path: '/api/admin/inquiries', summary: '전체 문의 목록', auth: 'admin' },
      { method: 'PATCH', path: '/api/admin/inquiries/{inquiryId}/reply', summary: '문의 답변 등록', auth: 'admin' },
    ],
  },
];

const Page = styled.div`
  min-height: 100vh;
  background: #f5f6f7;
  display: flex;
  flex-direction: column;
`;

const Layout = styled.div`
  flex: 1;
  display: flex;
  max-width: 1200px;
  width: 100%;
  margin: 28px auto 40px;
  padding: 0 20px;
  gap: 24px;
  align-items: flex-start;

  @media (max-width: 980px) {
    flex-direction: column;
  }
`;

const Sidebar = styled.nav`
  width: 220px;
  flex-shrink: 0;
  background: #fff;
  border-radius: 12px;
  border: 1px solid #e2e8f3;
  box-shadow: 0 8px 24px rgba(15, 32, 66, 0.06);
  padding: 18px 0;
  position: sticky;
  top: 84px;

  @media (max-width: 980px) {
    width: 100%;
    position: static;
  }
`;

const SidebarTitle = styled.div`
  font-size: 11px;
  font-weight: 700;
  color: #8a95ac;
  text-transform: uppercase;
  letter-spacing: 1px;
  padding: 0 18px 10px;
  border-bottom: 1px solid #eef2f8;
  margin-bottom: 8px;
`;

const SidebarItem = styled.a<{ $active: boolean }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 18px;
  font-size: 14px;
  font-weight: ${p => (p.$active ? 700 : 500)};
  color: ${p => (p.$active ? '#093687' : '#526387')};
  background: ${p => (p.$active ? '#eef3ff' : 'transparent')};
  text-decoration: none;
  cursor: pointer;
  border-left: 3px solid ${p => (p.$active ? '#093687' : 'transparent')};

  &:hover {
    background: #f2f6ff;
    color: #093687;
  }
`;

const SidebarCount = styled.span`
  margin-left: auto;
  background: #e9eef8;
  color: #65789e;
  font-size: 11px;
  font-weight: 700;
  border-radius: 10px;
  padding: 2px 7px;
`;

const Main = styled.main`
  flex: 1;
  min-width: 0;
`;

const PageHeader = styled.section`
  background: linear-gradient(135deg, #093687 0%, #1a5bc4 100%);
  border-radius: 16px;
  padding: 30px 32px;
  margin-bottom: 22px;
  color: #fff;
`;

const PageTitle = styled.h1`
  margin: 0 0 6px;
  font-size: 26px;
  font-weight: 800;
`;

const PageSubtitle = styled.p`
  margin: 0;
  font-size: 14px;
  opacity: 0.85;
`;

const Stats = styled.div`
  margin-top: 16px;
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
`;

const Stat = styled.div`
  background: rgba(255, 255, 255, 0.14);
  border-radius: 10px;
  padding: 10px 16px;
`;

const StatNum = styled.div`
  font-size: 20px;
  font-weight: 800;
`;

const StatLabel = styled.div`
  font-size: 11px;
  opacity: 0.9;
`;

const SearchInput = styled.input`
  width: 100%;
  padding: 11px 14px;
  border: 1px solid #d6deed;
  border-radius: 10px;
  background: #fff;
  font-size: 14px;
  margin-bottom: 20px;
  box-sizing: border-box;

  &:focus {
    outline: none;
    border-color: #093687;
    box-shadow: 0 0 0 3px rgba(9, 54, 135, 0.08);
  }
`;

const GroupSection = styled.section`
  background: #fff;
  border: 1px solid #e3e8f3;
  border-radius: 12px;
  margin-bottom: 20px;
  overflow: hidden;
`;

const GroupHeader = styled.div`
  padding: 16px 20px;
  border-bottom: 1px solid #eef2f8;
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
`;

const GroupTag = styled.h2`
  margin: 0;
  font-size: 17px;
  font-weight: 800;
  color: #1a2e57;
`;

const GroupBase = styled.code`
  font-size: 12px;
  color: #627292;
  background: #f2f6fd;
  border: 1px solid #d8e1f0;
  border-radius: 6px;
  padding: 3px 8px;
`;

const GroupDesc = styled.span`
  margin-left: auto;
  font-size: 13px;
  color: #7b88a2;
`;

const METHOD_COLORS: Record<HttpMethod, { bg: string; color: string }> = {
  GET: { bg: '#e8f5e9', color: '#2e7d32' },
  POST: { bg: '#e3f2fd', color: '#1565c0' },
  PUT: { bg: '#fff8e1', color: '#f57f17' },
  PATCH: { bg: '#fce4ec', color: '#c62828' },
  DELETE: { bg: '#fbe9e7', color: '#bf360c' },
};

const AUTH_LABELS: Record<AuthLevel, { label: string; bg: string; color: string }> = {
  none: { label: '공개', bg: '#f0f2f7', color: '#6f7a91' },
  user: { label: '로그인 필요', bg: '#e8f0fe', color: '#1a73e8' },
  admin: { label: '관리자 전용', bg: '#fde8f0', color: '#c62828' },
};

const EndpointRow = styled.div`
  border-bottom: 1px solid #f2f5fb;

  &:last-child {
    border-bottom: none;
  }
`;

const EndpointHeader = styled.button`
  width: 100%;
  border: none;
  background: #fff;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  cursor: pointer;
  text-align: left;

  &:hover {
    background: #f9fbff;
  }
`;

const MethodBadge = styled.span<{ $method: HttpMethod }>`
  font-size: 11px;
  font-weight: 800;
  padding: 4px 10px;
  border-radius: 6px;
  min-width: 60px;
  text-align: center;
  background: ${p => METHOD_COLORS[p.$method].bg};
  color: ${p => METHOD_COLORS[p.$method].color};
  flex-shrink: 0;
`;

const EndpointPath = styled.code`
  font-size: 13px;
  color: #304161;
`;

const EndpointSummary = styled.span`
  font-size: 13px;
  color: #6f7f9d;
`;

const AuthBadge = styled.span<{ $auth: AuthLevel }>`
  margin-left: auto;
  font-size: 11px;
  font-weight: 700;
  padding: 3px 9px;
  border-radius: 20px;
  background: ${p => AUTH_LABELS[p.$auth].bg};
  color: ${p => AUTH_LABELS[p.$auth].color};
  flex-shrink: 0;
`;

const Chevron = styled.span<{ $open: boolean }>`
  color: #9aa6bd;
  font-size: 12px;
  transform: ${p => (p.$open ? 'rotate(180deg)' : 'rotate(0)')};
  transition: transform 0.2s;
`;

const EndpointDetail = styled.div`
  padding: 14px 20px 16px;
  background: #f9fbff;
  border-top: 1px solid #eef2f8;
`;

const DetailTitle = styled.div`
  font-size: 12px;
  font-weight: 700;
  color: #093687;
  margin-bottom: 8px;
`;

const ParamTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
`;

const ParamTh = styled.th`
  text-align: left;
  padding: 7px 10px;
  background: #eef2f8;
  color: #5a6c8f;
`;

const ParamTd = styled.td`
  padding: 7px 10px;
  border-bottom: 1px solid #eef2f8;
  color: #3f4f70;
`;

const ParamIn = styled.code`
  background: #e8ecf5;
  border-radius: 4px;
  padding: 2px 6px;
  font-size: 11px;
`;

const CodeBlock = styled.pre`
  background: #1f2738;
  color: #d7f0d7;
  font-size: 12px;
  border-radius: 8px;
  padding: 12px 14px;
  margin: 8px 0 0;
  overflow-x: auto;
`;

const Empty = styled.div`
  text-align: center;
  color: #7f8ca5;
  padding: 54px 0;
`;

const ApiDocs = () => {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [activeTag, setActiveTag] = useState(API_GROUPS[0]?.tag ?? '');

  const totalEndpoints = useMemo(
    () => API_GROUPS.reduce((sum, g) => sum + g.endpoints.length, 0),
    [],
  );

  const filteredGroups = useMemo(
    () => API_GROUPS
      .map(group => ({
        ...group,
        endpoints: group.endpoints.filter(endpoint => {
          if (!search.trim()) return true;
          const q = search.toLowerCase();
          return endpoint.path.toLowerCase().includes(q)
            || endpoint.summary.toLowerCase().includes(q);
        }),
      }))
      .filter(group => group.endpoints.length > 0),
    [search],
  );

  const scrollToTag = (tag: string) => {
    const element = document.getElementById(`api-group-${tag}`);
    if (element) element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActiveTag(tag);
  };

  return (
    <Page>
      <Header />
      <Layout>
        <Sidebar>
          <SidebarTitle>API 그룹</SidebarTitle>
          {API_GROUPS.map(group => (
            <SidebarItem
              key={group.tag}
              $active={activeTag === group.tag}
              onClick={() => scrollToTag(group.tag)}
            >
              {group.tag}
              <SidebarCount>{group.endpoints.length}</SidebarCount>
            </SidebarItem>
          ))}
        </Sidebar>

        <Main>
          <PageHeader>
            <PageTitle>API 명세</PageTitle>
            <PageSubtitle>로컬 개발용 문서입니다. 배포 환경에서는 노출되지 않습니다.</PageSubtitle>
            <Stats>
              <Stat>
                <StatNum>{API_GROUPS.length}</StatNum>
                <StatLabel>API 그룹</StatLabel>
              </Stat>
              <Stat>
                <StatNum>{totalEndpoints}</StatNum>
                <StatLabel>전체 엔드포인트</StatLabel>
              </Stat>
            </Stats>
          </PageHeader>

          <SearchInput
            placeholder="엔드포인트 경로/설명으로 검색..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />

          {filteredGroups.map(group => (
            <GroupSection key={group.tag} id={`api-group-${group.tag}`}>
              <GroupHeader>
                <GroupTag>{group.tag}</GroupTag>
                <GroupBase>{group.baseUrl}</GroupBase>
                <GroupDesc>{group.description}</GroupDesc>
              </GroupHeader>

              {group.endpoints.map(endpoint => {
                const key = `${endpoint.method}:${endpoint.path}`;
                const open = openKey === key;
                return (
                  <EndpointRow key={key}>
                    <EndpointHeader type="button" onClick={() => setOpenKey(open ? null : key)}>
                      <MethodBadge $method={endpoint.method}>{endpoint.method}</MethodBadge>
                      <EndpointPath>{endpoint.path}</EndpointPath>
                      <EndpointSummary>— {endpoint.summary}</EndpointSummary>
                      <AuthBadge $auth={endpoint.auth}>{AUTH_LABELS[endpoint.auth].label}</AuthBadge>
                      <Chevron $open={open}>▼</Chevron>
                    </EndpointHeader>
                    {open && (
                      <EndpointDetail>
                        {endpoint.auth !== 'none' && (
                          <>
                            <DetailTitle>인증 헤더</DetailTitle>
                            <CodeBlock>Authorization: Bearer &lt;accessToken&gt;</CodeBlock>
                          </>
                        )}

                        {endpoint.params && endpoint.params.length > 0 && (
                          <>
                            <DetailTitle style={{ marginTop: endpoint.auth !== 'none' ? 12 : 0 }}>
                              파라미터
                            </DetailTitle>
                            <ParamTable>
                              <thead>
                                <tr>
                                  <ParamTh>이름</ParamTh>
                                  <ParamTh>위치</ParamTh>
                                  <ParamTh>타입</ParamTh>
                                  <ParamTh>필수</ParamTh>
                                  <ParamTh>설명</ParamTh>
                                </tr>
                              </thead>
                              <tbody>
                                {endpoint.params.map(param => (
                                  <tr key={`${key}:${param.name}`}>
                                    <ParamTd><code>{param.name}</code></ParamTd>
                                    <ParamTd><ParamIn>{param.in}</ParamIn></ParamTd>
                                    <ParamTd><code>{param.type}</code></ParamTd>
                                    <ParamTd>{param.required ? '필수' : '선택'}</ParamTd>
                                    <ParamTd>{param.description}</ParamTd>
                                  </tr>
                                ))}
                              </tbody>
                            </ParamTable>
                          </>
                        )}

                        {endpoint.responseExample && (
                          <>
                            <DetailTitle style={{ marginTop: 12 }}>응답 예시</DetailTitle>
                            <CodeBlock>{endpoint.responseExample}</CodeBlock>
                          </>
                        )}
                      </EndpointDetail>
                    )}
                  </EndpointRow>
                );
              })}
            </GroupSection>
          ))}

          {filteredGroups.length === 0 && <Empty>검색 결과가 없습니다.</Empty>}
        </Main>
      </Layout>
      <Footer />
    </Page>
  );
};

export default ApiDocs;
