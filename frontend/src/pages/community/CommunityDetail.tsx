import { FormEvent, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import styled from 'styled-components';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import {
  API_BASE,
  formatDate,
  getAccessToken,
  getAuthHeaders
} from './common';
import type { Comment, Post } from './common';

const Page = styled.div`
  min-height: 100vh;
  background: #f7f9fd;
  display: flex;
  flex-direction: column;
`;

const Wrapper = styled.main`
  max-width: 1100px;
  width: 100%;
  margin: 24px auto 48px;
  flex: 1;
`;

const Breadcrumb = styled.div`
  margin-bottom: 14px;
  color: #5c6f95;
  font-size: 14px;
`;

const Card = styled.section`
  background: #fff;
  border: 1px solid #dfe7f6;
  border-radius: 14px;
  box-shadow: 0 8px 24px rgba(17, 32, 62, 0.06);
  overflow: hidden;
`;

const HeaderArea = styled.div`
  padding: 22px 24px 18px;
  border-bottom: 1px solid #e6ecf8;

  h1 {
    margin: 0;
    color: #1a2e57;
    font-size: 28px;
  }
`;

const Meta = styled.div`
  margin-top: 10px;
  color: #5a6a8a;
  font-size: 14px;
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
`;

const NoticeBadge = styled.span`
  display: inline-flex;
  align-items: center;
  font-size: 11px;
  font-weight: 700;
  background: #093687;
  color: #fff;
  border-radius: 999px;
  padding: 3px 10px;
  margin-right: 8px;
`;

const ContentArea = styled.div`
  padding: 24px;
  color: #24395e;
  line-height: 1.65;
  min-height: 220px;
`;

const AttachBox = styled.div`
  margin-top: 24px;
  border-top: 1px dashed #dbe4f5;
  padding-top: 16px;
  font-size: 14px;

  a {
    color: #093687;
    font-weight: 700;
  }
`;

const Actions = styled.div`
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
  padding: 0 24px 20px;
`;

const Row = styled.div`
  display: flex;
  gap: 8px;
`;

const Button = styled.button`
  border: 0;
  border-radius: 8px;
  padding: 8px 14px;
  background: #093687;
  color: #fff;
  font-weight: 700;
  cursor: pointer;
`;

const GrayButton = styled(Button)`
  background: #607293;
`;

const RedButton = styled(Button)`
  background: #c73333;
`;

const CommentSection = styled.section`
  margin-top: 16px;
  background: #fff;
  border: 1px solid #dfe7f6;
  border-radius: 14px;
  padding: 18px;
`;

const CommentTitle = styled.h2`
  margin: 0 0 10px;
  font-size: 20px;
  color: #203456;
`;

const CommentCard = styled.div`
  border: 1px solid #e6edf8;
  border-radius: 10px;
  padding: 10px 12px;
  margin-bottom: 8px;
`;

const CommentMeta = styled.div`
  color: #607398;
  font-size: 12px;
  margin-bottom: 8px;
`;

const Textarea = styled.textarea`
  width: 100%;
  min-height: 92px;
  border: 1px solid #cdd9ed;
  border-radius: 8px;
  padding: 10px;
  margin-top: 8px;
  margin-bottom: 10px;
`;

const Empty = styled.div`
  text-align: center;
  color: #6c7ea1;
  padding: 40px 20px;
`;

function CommunityDetail() {
  const { postId } = useParams<{ postId: string }>();
  const navigate = useNavigate();
  const token = getAccessToken();
  const authHeaders = useMemo(() => getAuthHeaders(token), [token]);

  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentContent, setCommentContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingComment, setSavingComment] = useState(false);

  const numericPostId = Number(postId);

  const loadDetail = async () => {
    if (!numericPostId || Number.isNaN(numericPostId)) {
      setError('잘못된 게시글 주소입니다.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [postRes, commentRes] = await Promise.all([
        axios.get<Post>(`${API_BASE}/api/community/posts/${numericPostId}`, { headers: authHeaders }),
        axios.get<Comment[]>(`${API_BASE}/api/community/posts/${numericPostId}/comments`, { headers: authHeaders })
      ]);
      setPost(postRes.data);
      setComments(commentRes.data);
    } catch {
      setError('게시글을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDetail();
  }, [numericPostId]);

  const onDeletePost = async () => {
    if (!post || !token) return;
    if (!window.confirm('이 게시글을 삭제하시겠습니까?')) return;
    await axios.delete(`${API_BASE}/api/community/posts/${post.postId}`, { headers: authHeaders });
    navigate('/community');
  };

  const onLike = async () => {
    if (!post) return;
    if (!token) {
      alert('로그인이 필요합니다.');
      navigate('/login');
      return;
    }
    await axios.post(`${API_BASE}/api/community/posts/${post.postId}/like`, {}, { headers: authHeaders });
    await loadDetail();
  };

  const onSubmitComment = async (e: FormEvent) => {
    e.preventDefault();
    if (!post || !token) {
      alert('로그인이 필요합니다.');
      navigate('/login');
      return;
    }
    setSavingComment(true);
    try {
      await axios.post(
        `${API_BASE}/api/community/posts/${post.postId}/comments`,
        { content: commentContent },
        { headers: authHeaders }
      );
      setCommentContent('');
      await loadDetail();
    } finally {
      setSavingComment(false);
    }
  };

  const onDeleteComment = async (commentId: number) => {
    if (!post || !token) return;
    await axios.delete(`${API_BASE}/api/community/comments/${commentId}`, { headers: authHeaders });
    await loadDetail();
  };

  const attachmentHref = post?.attachmentUrl
    ? (post.attachmentUrl.startsWith('http') ? post.attachmentUrl : `${API_BASE}${post.attachmentUrl}`)
    : null;

  return (
    <Page>
      <Header />
      <Wrapper>
        <Breadcrumb>
          <Link to="/community">커뮤니티</Link> / 상세보기
        </Breadcrumb>
        {loading && <Empty>불러오는 중입니다...</Empty>}
        {error && <Empty>{error}</Empty>}
        {!loading && !error && post && (
          <>
            <Card>
              <HeaderArea>
                <h1>
                  {post.notice && <NoticeBadge>공지사항</NoticeBadge>}
                  {post.title}
                </h1>
                <Meta>
                  <span>작성자 {post.authorName}</span>
                  <span>작성일 {formatDate(post.createdAt)}</span>
                  <span>조회 {post.viewCount}</span>
                  <span>좋아요 {post.likeCount}</span>
                </Meta>
              </HeaderArea>
              <ContentArea>
                <div dangerouslySetInnerHTML={{ __html: post.content }} />
                {attachmentHref && (
                  <AttachBox>
                    첨부파일:
                    {' '}
                    <a href={attachmentHref} target="_blank" rel="noreferrer">
                      열기
                    </a>
                  </AttachBox>
                )}
              </ContentArea>
              <Actions>
                <Row>
                  <Button type="button" onClick={onLike}>좋아요</Button>
                  <GrayButton type="button" onClick={() => navigate('/community')}>목록</GrayButton>
                </Row>
                <Row>
                  {post.canEdit && (
                    <GrayButton type="button" onClick={() => navigate(`/community/${post.postId}/edit`)}>
                      수정
                    </GrayButton>
                  )}
                  {post.canDelete && (
                    <RedButton type="button" onClick={() => void onDeletePost()}>
                      삭제
                    </RedButton>
                  )}
                </Row>
              </Actions>
            </Card>

            <CommentSection>
              <CommentTitle>댓글 {comments.length}</CommentTitle>
              {comments.length === 0 && <Empty>아직 댓글이 없습니다.</Empty>}
              {comments.map(comment => (
                <CommentCard key={comment.commentId}>
                  <CommentMeta>
                    {comment.authorName} | {formatDate(comment.createdAt)}
                  </CommentMeta>
                  <div>{comment.content}</div>
                  {comment.canDelete && (
                    <div style={{ marginTop: 8 }}>
                      <RedButton type="button" onClick={() => void onDeleteComment(comment.commentId)}>
                        댓글 삭제
                      </RedButton>
                    </div>
                  )}
                </CommentCard>
              ))}
              <form onSubmit={onSubmitComment}>
                <Textarea
                  placeholder="댓글을 입력하세요."
                  value={commentContent}
                  onChange={e => setCommentContent(e.target.value)}
                  required
                />
                <Button type="submit" disabled={savingComment}>
                  {savingComment ? '등록 중...' : '댓글 등록'}
                </Button>
              </form>
            </CommentSection>
          </>
        )}
      </Wrapper>
      <Footer />
    </Page>
  );
}

export default CommunityDetail;
