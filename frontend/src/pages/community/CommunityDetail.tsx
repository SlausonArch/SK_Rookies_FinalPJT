import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import axios from 'axios';
import styled from 'styled-components';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
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
  white-space: pre-wrap;
  word-break: break-word;
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

  img, video {
    max-width: 100%;
    margin-top: 12px;
    border-radius: 8px;
  }
`;

const Actions = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
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
  transition: all 0.2s;
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  &:hover:not(:disabled) {
    transform: scale(1.05);
  }
`;

const LikedButton = styled(Button)`
  background: #ff6b6b;
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
  const location = useLocation();
  const token = getAccessToken();
  const loginRedirectUrl = `/login?redirect=${encodeURIComponent(`${location.pathname}${location.search || ''}`)}`;
  const authHeaders = useMemo(() => getAuthHeaders(token), [token]);

  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentContent, setCommentContent] = useState('');
  const [commentSecret, setCommentSecret] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingComment, setSavingComment] = useState(false);
  const [savingLike, setSavingLike] = useState(false);

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
    await axios.post(`${API_BASE}/api/community/posts/${post.postId}/delete`, {}, { headers: authHeaders });
    navigate('/community');
  };

  const onLike = async () => {
    if (!post || savingLike) return;
    if (!token) {
      alert('로그인이 필요합니다.');
      navigate(loginRedirectUrl);
      return;
    }
    // 낙관적 UI 업데이트 - 즉시 UI 업데이트 (토글)
    setSavingLike(true);
    const previousPost = post;
    const wasLiked = post.userLiked;
    setPost((prev: Post | null) => prev
      ? { ...prev, likeCount: wasLiked ? prev.likeCount - 1 : prev.likeCount + 1, userLiked: !wasLiked }
      : null);

    try {
      await axios.post(`${API_BASE}/api/community/posts/${post.postId}/like`, {}, { headers: authHeaders });
    } catch {
      // 실패 시 원래 상태로 복구
      setPost(previousPost);
      alert('좋아요 처리 중 오류가 발생했습니다.');
    } finally {
      setSavingLike(false);
    }
  };

  const onSubmitComment = async (e: FormEvent) => {
    e.preventDefault();
    if (!post || !token) {
      alert('로그인이 필요합니다.');
      navigate(loginRedirectUrl);
      return;
    }
    setSavingComment(true);
    try {
      await axios.post(
        `${API_BASE}/api/community/posts/${post.postId}/comments`,
        { content: commentContent, secret: commentSecret },
        { headers: authHeaders }
      );
      setCommentContent('');
      setCommentSecret(false);
      await loadDetail();
    } finally {
      setSavingComment(false);
    }
  };

  const onDeleteComment = async (commentId: number) => {
    if (!post || !token) return;
    if (!window.confirm('댓글을 삭제하시겠습니까?')) return;
    try {
      await axios.post(`${API_BASE}/api/community/comments/${commentId}/delete`, {}, { headers: authHeaders });
      await loadDetail();
    } catch {
      alert('댓글 삭제에 실패했습니다.');
    }
  };

  const onStartEditComment = (comment: Comment) => {
    setEditingCommentId(comment.commentId);
    setEditingContent(comment.content);
  };

  const onSaveEditComment = async (commentId: number) => {
    if (!token) return;
    try {
      await axios.patch(
        `${API_BASE}/api/community/comments/${commentId}`,
        { content: editingContent },
        { headers: authHeaders }
      );
      setEditingCommentId(null);
      setEditingContent('');
      await loadDetail();
    } catch {
      alert('댓글 수정에 실패했습니다.');
    }
  };

  const attachmentHref = (() => {
    const url = post?.attachmentUrl;
    if (!url) return null;
    const resolved = url.startsWith('http') ? url : `${API_BASE}${url}`;
    try {
      const { protocol } = new URL(resolved);
      return protocol === 'https:' || protocol === 'http:' ? resolved : null;
    } catch {
      return null;
    }
  })();

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
                <div>{post.content}</div>
                {attachmentHref && (
                  <AttachBox>
                    첨부파일:
                    {' '}
                    <a href={attachmentHref} target="_blank" rel="noreferrer">
                      열기
                    </a>
                    {(() => {
                      const ext = post.attachmentUrl?.split('.').pop()?.toLowerCase();
                      const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
                      const videoExts = ['mp4', 'webm', 'ogg', 'mov'];

                      if (ext && imageExts.includes(ext)) {
                        return <img src={attachmentHref} alt="첨부 이미지" />;
                      }
                      if (ext && videoExts.includes(ext)) {
                        return <video src={attachmentHref} controls />;
                      }
                      return null;
                    })()}
                  </AttachBox>
                )}
              </ContentArea>
              <Actions>
                {post.userLiked ? (
                  <LikedButton type="button" onClick={onLike} disabled={savingLike}>
                    {savingLike ? '처리 중...' : `👍 좋아요 취소 ${post.likeCount}`}
                  </LikedButton>
                ) : (
                  <Button type="button" onClick={onLike} disabled={savingLike}>👍 {savingLike ? '저장 중...' : `좋아요 ${post.likeCount}`}</Button>
                )}
                <Row>
                  <GrayButton type="button" onClick={() => navigate('/community')}>목록</GrayButton>
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
              {comments.map((comment: Comment) => (
                <CommentCard key={comment.commentId}>
                  <CommentMeta>
                    {comment.isSecret && (
                      <span style={{ background: '#4b5563', color: '#fff', borderRadius: 4, padding: '1px 7px', fontSize: 11, fontWeight: 700, marginRight: 6 }}>🔒 비밀</span>
                    )}
                    {comment.authorName} | {formatDate(comment.createdAt)}
                  </CommentMeta>
                  {editingCommentId === comment.commentId ? (
                    <div>
                      <Textarea
                        value={editingContent}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEditingContent(e.target.value)}
                        style={{ minHeight: 60 }}
                      />
                      <div style={{ display: 'flex', gap: 6 }}>
                        <Button type="button" onClick={() => void onSaveEditComment(comment.commentId)}>저장</Button>
                        <GrayButton type="button" onClick={() => setEditingCommentId(null)}>취소</GrayButton>
                      </div>
                    </div>
                  ) : (
                    <div>{comment.content}</div>
                  )}
                  <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
                    {comment.canEdit && editingCommentId !== comment.commentId && (
                      <GrayButton type="button" onClick={() => onStartEditComment(comment)}>수정</GrayButton>
                    )}
                    {comment.canDelete && (
                      <RedButton type="button" onClick={() => void onDeleteComment(comment.commentId)}>삭제</RedButton>
                    )}
                  </div>
                </CommentCard>
              ))}
              <form onSubmit={onSubmitComment}>
                <Textarea
                  placeholder="댓글을 입력하세요."
                  value={commentContent}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setCommentContent(e.target.value)}
                  required
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#607293', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={commentSecret}
                      onChange={e => setCommentSecret(e.target.checked)}
                    />
                    🔒 비밀 댓글
                  </label>
                </div>
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
