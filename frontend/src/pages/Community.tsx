import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import styled from 'styled-components';
import { useLocation, useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { API_BASE, formatDateOnly, getAccessToken, getAuthHeaders, parseRoleFromToken } from './community/common';
import type { Post } from './community/common';

type TabType = 'all' | 'notice' | 'general';
type SortType = 'latest' | 'likes';

const PAGE_SIZE = 12;

const Page = styled.div`
  min-height: 100vh;
  background: linear-gradient(180deg, #f2f6ff 0%, #f8fafd 280px, #f8fafd 100%);
  display: flex;
  flex-direction: column;
`;

const Hero = styled.section`
  max-width: 1200px;
  width: 100%;
  margin: 0 auto;
  padding: 34px 0 20px;
  color: #0f2042;

  h1 {
    margin: 0;
    font-size: 32px;
    letter-spacing: -0.6px;
  }

  p {
    margin: 10px 0 0;
    font-size: 15px;
    color: #4f6187;
  }
`;

const Wrapper = styled.main`
  max-width: 1200px;
  width: 100%;
  margin: 0 auto 40px;
  flex: 1;
`;

const Board = styled.section`
  background: #fff;
  border-radius: 14px;
  box-shadow: 0 10px 30px rgba(15, 32, 66, 0.07);
  overflow: hidden;
  border: 1px solid #dde4f2;
`;

const TopBar = styled.div`
  padding: 18px;
  border-bottom: 1px solid #ebf0fa;
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 12px;

  @media (max-width: 860px) {
    grid-template-columns: 1fr;
  }
`;

const Tabs = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
`;

const Tab = styled.button<{ $active: boolean }>`
  border: 1px solid ${props => (props.$active ? '#093687' : '#cad4e7')};
  background: ${props => (props.$active ? '#093687' : '#f8fbff')};
  color: ${props => (props.$active ? '#fff' : '#2f446b')};
  border-radius: 999px;
  padding: 7px 14px;
  font-weight: 700;
  cursor: pointer;
`;

const SearchBox = styled.form`
  display: flex;
  gap: 8px;
`;

const Input = styled.input`
  min-width: 220px;
  border: 1px solid #ccd7ea;
  border-radius: 8px;
  padding: 9px 12px;
  font-size: 14px;

  @media (max-width: 860px) {
    min-width: 100%;
  }
`;

const ActionRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 18px;
  border-bottom: 1px solid #ebf0fa;
  background: #fbfdff;
`;

const Count = styled.span`
  color: #506387;
  font-size: 14px;
`;

const RightActions = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const SortControls = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px;
  background: #f1f5fc;
  border: 1px solid #d4deef;
  border-radius: 999px;
`;

const SortButton = styled.button<{ $active: boolean }>`
  border: none;
  border-radius: 999px;
  padding: 6px 10px;
  font-size: 12px;
  font-weight: 700;
  color: ${props => (props.$active ? '#fff' : '#49608a')};
  background: ${props => (props.$active ? '#093687' : 'transparent')};
  cursor: pointer;
`;

const PrimaryButton = styled.button`
  border: 0;
  border-radius: 8px;
  padding: 9px 14px;
  background: #093687;
  color: #fff;
  font-weight: 700;
  cursor: pointer;
`;

const SearchButton = styled(PrimaryButton)`
  padding: 9px 12px;
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;

  thead th {
    text-align: center;
    font-size: 13px;
    color: #5d6f91;
    background: #f5f9ff;
    border-bottom: 1px solid #e6edf9;
    padding: 12px 8px;
  }

  tbody tr {
    cursor: pointer;
    transition: background-color 0.15s ease;
  }

  tbody tr:hover {
    background: #f8fbff;
  }

  tbody td {
    border-bottom: 1px solid #edf2fb;
    padding: 13px 8px;
    text-align: center;
    color: #2f3f5f;
    font-size: 14px;
  }
`;

const TitleCell = styled.td`
  text-align: left !important;
  padding-left: 16px !important;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const NoticeBadge = styled.span`
  display: inline-flex;
  align-items: center;
  font-size: 11px;
  font-weight: 700;
  background: #093687;
  color: #fff;
  border-radius: 999px;
  padding: 2px 8px;
  margin-right: 8px;
`;

const CommentCount = styled.span`
  margin-left: 6px;
  color: #6a7ea3;
  font-size: 12px;
  font-weight: 700;
`;

const Empty = styled.div`
  padding: 60px 20px;
  text-align: center;
  color: #6e7e9f;
`;

const Pagination = styled.div`
  display: flex;
  justify-content: center;
  gap: 6px;
  padding: 18px;
`;

const PageButton = styled.button<{ $active: boolean }>`
  border: 1px solid ${props => (props.$active ? '#093687' : '#d4dded')};
  color: ${props => (props.$active ? '#fff' : '#2f446b')};
  background: ${props => (props.$active ? '#093687' : '#fff')};
  border-radius: 8px;
  width: 34px;
  height: 34px;
  cursor: pointer;
`;

const parseCreatedAt = (value: string | null): number => {
  if (!value) return 0;
  const normalized = value.includes('T') ? value : value.replace(' ', 'T');
  const hasTimezone = /([zZ]|[+\-]\d{2}:\d{2})$/.test(normalized);
  const parsed = Date.parse(hasTimezone ? normalized : `${normalized}Z`);
  return Number.isNaN(parsed) ? 0 : parsed;
};

function Community() {
  const navigate = useNavigate();
  const location = useLocation();
  const token = getAccessToken();
  const loginRedirectUrl = `/login?redirect=${encodeURIComponent(`${location.pathname}${location.search || ''}`)}`;
  const role = parseRoleFromToken(token);
  const isAdmin = role === 'ADMIN' || role === 'STAFF';
  const authHeaders = getAuthHeaders(token);

  const [posts, setPosts] = useState<Post[]>([]);
  const [keywordInput, setKeywordInput] = useState('');
  const [keyword, setKeyword] = useState('');
  const [tab, setTab] = useState<TabType>('all');
  const [sortBy, setSortBy] = useState<SortType>('latest');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPosts = async (q: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get<Post[]>(`${API_BASE}/api/community/posts`, {
        params: q ? { keyword: q } : {},
        headers: authHeaders,
      });
      setPosts(response.data);
    } catch {
      setError('게시글을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPosts(keyword);
  }, [keyword]);

  const filteredPosts = useMemo(() => {
    const byTab = tab === 'notice'
      ? posts.filter(post => post.notice)
      : tab === 'general'
        ? posts.filter(post => !post.notice)
        : posts;

    return [...byTab].sort((a, b) => {
      const noticeOrder = (b.notice ? 1 : 0) - (a.notice ? 1 : 0);
      if (noticeOrder !== 0) return noticeOrder;

      if (sortBy === 'likes' && b.likeCount !== a.likeCount) {
        return b.likeCount - a.likeCount;
      }

      const aTime = parseCreatedAt(a.createdAt);
      const bTime = parseCreatedAt(b.createdAt);
      if (bTime !== aTime) return bTime - aTime;

      return b.postId - a.postId;
    });
  }, [posts, tab, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredPosts.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedPosts = filteredPosts.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [tab, sortBy, filteredPosts.length]);

  const onSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setKeyword(keywordInput.trim());
  };

  const onClickWrite = () => {
    if (!token) {
      alert('로그인 후 글쓰기가 가능합니다.');
      navigate(loginRedirectUrl);
      return;
    }
    navigate('/community/write');
  };

  return (
    <Page>
      <Header />
      <Hero>
        <h1>커뮤니티</h1>
        <p>공지사항과 일반 게시글을 확인하고 자유롭게 소통해 보세요.</p>
      </Hero>
      <Wrapper>
        <Board>
          <TopBar>
            <Tabs>
              <Tab type="button" $active={tab === 'all'} onClick={() => setTab('all')}>전체</Tab>
              <Tab type="button" $active={tab === 'notice'} onClick={() => setTab('notice')}>공지사항</Tab>
              <Tab type="button" $active={tab === 'general'} onClick={() => setTab('general')}>일반글</Tab>
            </Tabs>
            <SearchBox onSubmit={onSearchSubmit}>
              <Input
                value={keywordInput}
                onChange={e => setKeywordInput(e.target.value)}
                placeholder="제목/내용 검색"
              />
              <SearchButton type="submit">검색</SearchButton>
            </SearchBox>
          </TopBar>

          <ActionRow>
            <Count>총 {filteredPosts.length}개 글</Count>
            <RightActions>
              <SortControls>
                <SortButton type="button" $active={sortBy === 'latest'} onClick={() => setSortBy('latest')}>
                  최신순
                </SortButton>
                <SortButton type="button" $active={sortBy === 'likes'} onClick={() => setSortBy('likes')}>
                  좋아요순
                </SortButton>
              </SortControls>
              {(tab !== 'notice' || isAdmin) && (
                <PrimaryButton type="button" onClick={onClickWrite}>글쓰기</PrimaryButton>
              )}
            </RightActions>
          </ActionRow>

          <Table>
            <thead>
              <tr>
                <th style={{ width: '8%' }}>번호</th>
                <th style={{ width: '49%' }}>제목</th>
                <th style={{ width: '15%' }}>작성자</th>
                <th style={{ width: '10%' }}>좋아요</th>
                <th style={{ width: '10%' }}>조회</th>
                <th style={{ width: '8%' }}>작성일</th>
              </tr>
            </thead>
            <tbody>
              {!loading && !error && pagedPosts.map((post, index) => (
                <tr key={post.postId} onClick={() => navigate(`/community/${post.postId}`)}>
                  <td>{filteredPosts.length - ((currentPage - 1) * PAGE_SIZE + index)}</td>
                  <TitleCell>
                    {post.notice && <NoticeBadge>공지</NoticeBadge>}
                    {post.title}
                    <CommentCount>[{post.commentCount ?? 0}]</CommentCount>
                  </TitleCell>
                  <td>{post.authorName}</td>
                  <td>{post.likeCount}</td>
                  <td>{post.viewCount}</td>
                  <td>{formatDateOnly(post.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </Table>

          {loading && <Empty>게시글을 불러오는 중입니다...</Empty>}
          {error && <Empty>{error}</Empty>}
          {!loading && !error && filteredPosts.length === 0 && <Empty>등록된 게시글이 없습니다.</Empty>}

          {filteredPosts.length > 0 && (
            <Pagination>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(num => (
                <PageButton
                  key={num}
                  type="button"
                  $active={num === currentPage}
                  onClick={() => setPage(num)}
                >
                  {num}
                </PageButton>
              ))}
            </Pagination>
          )}
        </Board>
      </Wrapper>
      <Footer />
    </Page>
  );
}

export default Community;
