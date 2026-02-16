import { FormEvent, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import styled from 'styled-components';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import {
  API_BASE,
  getAccessToken,
  getAuthHeaders,
  parseRoleFromToken
} from './common';
import type { Post } from './common';

const Page = styled.div`
  min-height: 100vh;
  background: #f7f9fd;
  display: flex;
  flex-direction: column;
`;

const Wrapper = styled.main`
  max-width: 960px;
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
  padding: 24px;
  box-shadow: 0 8px 24px rgba(17, 32, 62, 0.06);
`;

const Title = styled.h1`
  margin: 0 0 18px;
  color: #1c3158;
  font-size: 30px;
`;

const Label = styled.label`
  display: block;
  margin-bottom: 8px;
  color: #344b74;
  font-size: 14px;
  font-weight: 700;
`;

const Input = styled.input`
  width: 100%;
  border: 1px solid #ccd9ef;
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 14px;
  margin-bottom: 16px;
`;

const Textarea = styled.textarea`
  width: 100%;
  min-height: 280px;
  border: 1px solid #ccd9ef;
  border-radius: 8px;
  padding: 12px;
  font-size: 14px;
  line-height: 1.6;
  margin-bottom: 16px;
`;

const Meta = styled.div`
  margin-bottom: 10px;
  color: #607397;
  font-size: 13px;
`;

const ButtonRow = styled.div`
  display: flex;
  gap: 8px;
  justify-content: flex-end;
`;

const Button = styled.button`
  border: 0;
  border-radius: 8px;
  padding: 9px 15px;
  background: #093687;
  color: #fff;
  font-weight: 700;
  cursor: pointer;
`;

const GrayButton = styled(Button)`
  background: #667998;
`;

const ErrorBox = styled.div`
  margin-bottom: 16px;
  border: 1px solid #efcccc;
  background: #fff5f5;
  color: #9f2d2d;
  border-radius: 8px;
  padding: 10px 12px;
`;

function CommunityWrite() {
  const { postId } = useParams<{ postId: string }>();
  const navigate = useNavigate();
  const token = getAccessToken();
  const role = parseRoleFromToken(token);
  const isAdmin = role === 'ADMIN';
  const isEdit = Boolean(postId);
  const authHeaders = useMemo(() => getAuthHeaders(token), [token]);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [notice, setNotice] = useState(false);
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const numericPostId = Number(postId);

  useEffect(() => {
    if (!isEdit) return;
    if (!numericPostId || Number.isNaN(numericPostId)) {
      setError('잘못된 게시글 주소입니다.');
      setLoading(false);
      return;
    }
    const loadPost = async () => {
      try {
        const response = await axios.get<Post>(`${API_BASE}/api/community/posts/${numericPostId}`, {
          headers: authHeaders
        });
        setTitle(response.data.title);
        setContent(response.data.content);
        setNotice(response.data.notice);
        setAttachmentUrl(response.data.attachmentUrl ?? '');
      } catch {
        setError('수정할 게시글을 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    };
    void loadPost();
  }, [isEdit, numericPostId, authHeaders]);

  const onUpload = async (file: File | null) => {
    if (!file || !token) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await axios.post<{ attachmentUrl: string }>(`${API_BASE}/api/community/uploads`, formData, {
        headers: { ...authHeaders, 'Content-Type': 'multipart/form-data' }
      });
      setAttachmentUrl(response.data.attachmentUrl);
    } catch {
      setError('파일 업로드에 실패했습니다.');
    } finally {
      setUploading(false);
    }
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) {
      alert('로그인이 필요합니다.');
      navigate('/login');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        title,
        content,
        notice: isAdmin ? notice : false,
        attachmentUrl: attachmentUrl || null
      };
      if (isEdit && numericPostId) {
        const response = await axios.put<Post>(`${API_BASE}/api/community/posts/${numericPostId}`, payload, {
          headers: authHeaders
        });
        navigate(`/community/${response.data.postId}`);
      } else {
        const response = await axios.post<Post>(`${API_BASE}/api/community/posts`, payload, { headers: authHeaders });
        navigate(`/community/${response.data.postId}`);
      }
    } catch {
      setError('저장에 실패했습니다. 입력값 또는 로그인 상태를 확인해 주세요.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Page>
      <Header />
      <Wrapper>
        <Breadcrumb>
          <Link to="/community">커뮤니티</Link> / {isEdit ? '글 수정' : '글 쓰기'}
        </Breadcrumb>
        <Card>
          <Title>{isEdit ? '게시글 수정' : '새 글 작성'}</Title>
          {loading && <Meta>기존 글 정보를 불러오는 중입니다...</Meta>}
          {!token && <ErrorBox>로그인하지 않은 상태입니다. 저장 시 로그인 페이지로 이동합니다.</ErrorBox>}
          {error && <ErrorBox>{error}</ErrorBox>}
          {!loading && (
            <form onSubmit={onSubmit}>
              <Label htmlFor="title">제목</Label>
              <Input
                id="title"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="제목을 입력하세요."
                required
              />

              <Label htmlFor="content">내용</Label>
              <Textarea
                id="content"
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder="내용을 입력하세요."
                required
              />

              <Label htmlFor="attachmentUrl">첨부 링크</Label>
              <Input
                id="attachmentUrl"
                value={attachmentUrl}
                onChange={e => setAttachmentUrl(e.target.value)}
                placeholder="/uploads/... 또는 외부 URL"
              />

              <Label htmlFor="fileInput">파일 업로드</Label>
              <Input
                id="fileInput"
                type="file"
                onChange={e => void onUpload(e.target.files?.[0] ?? null)}
              />
              <Meta>{uploading ? '업로드 중...' : '이미지 및 첨부 파일 업로드 가능'}</Meta>

              {isAdmin && (
                <Label htmlFor="notice">
                  <input
                    id="notice"
                    type="checkbox"
                    checked={notice}
                    onChange={e => setNotice(e.target.checked)}
                    style={{ marginRight: 8 }}
                  />
                  공지사항으로 등록
                </Label>
              )}

              <ButtonRow>
                <GrayButton type="button" onClick={() => navigate(-1)}>취소</GrayButton>
                <Button type="submit" disabled={saving}>
                  {saving ? '저장 중...' : '저장'}
                </Button>
              </ButtonRow>
            </form>
          )}
        </Card>
      </Wrapper>
      <Footer />
    </Page>
  );
}

export default CommunityWrite;
