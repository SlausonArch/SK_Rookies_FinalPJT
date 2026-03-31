'use client'

import { useActionState, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import axios from 'axios'
import styled from 'styled-components'
import Link from 'next/link'
import { usePathname, useParams, useRouter } from 'next/navigation'

import { saveCommunityPostAction, type CommunityPostActionState } from '@/app/community/actions'
import Header from '../../components/Header'
import Footer from '../../components/Footer'
import { API_BASE, getAccessToken, getAuthHeaders, parseRoleFromToken } from './common'
import type { Post } from './common'

const INITIAL_STATE: CommunityPostActionState = { error: null }

const Page = styled.div`
  min-height: 100vh;
  background: #f7f9fd;
  display: flex;
  flex-direction: column;
`

const Wrapper = styled.main`
  max-width: 960px;
  width: 100%;
  margin: 24px auto 48px;
  flex: 1;
`

const Breadcrumb = styled.div`
  margin-bottom: 14px;
  color: #5c6f95;
  font-size: 14px;
`

const Card = styled.section`
  background: #fff;
  border: 1px solid #dfe7f6;
  border-radius: 14px;
  padding: 24px;
  box-shadow: 0 8px 24px rgba(17, 32, 62, 0.06);
`

const Title = styled.h1`
  margin: 0 0 18px;
  color: #1c3158;
  font-size: 30px;
`

const Label = styled.label`
  display: block;
  margin-bottom: 8px;
  color: #344b74;
  font-size: 14px;
  font-weight: 700;
`

const Input = styled.input`
  width: 100%;
  border: 1px solid #ccd9ef;
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 14px;
  margin-bottom: 16px;
`

const Textarea = styled.textarea`
  width: 100%;
  min-height: 280px;
  border: 1px solid #ccd9ef;
  border-radius: 8px;
  padding: 12px;
  font-size: 14px;
  line-height: 1.6;
  margin-bottom: 16px;
`

const Meta = styled.div`
  margin-bottom: 10px;
  color: #607397;
  font-size: 13px;
`

const ButtonRow = styled.div`
  display: flex;
  gap: 8px;
  justify-content: flex-end;
`

const Button = styled.button`
  border: 0;
  border-radius: 8px;
  padding: 9px 15px;
  background: #093687;
  color: #fff;
  font-weight: 700;
  cursor: pointer;

  &:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }
`

const GrayButton = styled(Button)`
  background: #667998;
`

const ErrorBox = styled.div`
  margin-bottom: 16px;
  border: 1px solid #efcccc;
  background: #fff5f5;
  color: #9f2d2d;
  border-radius: 8px;
  padding: 10px 12px;
`

function CommunityWrite() {
  const params = useParams()
  const postId = params.postId as string | undefined
  const router = useRouter()
  const pathname = usePathname()
  const token = typeof window !== 'undefined' ? getAccessToken() : null
  const loginRedirectUrl = `/login?redirect=${encodeURIComponent(pathname)}`
  const role = parseRoleFromToken(token)
  const isAdmin = role === 'ADMIN' || role === 'STAFF'
  const isEdit = Boolean(postId)
  const authHeaders = useMemo(() => getAuthHeaders(token), [token])
  const [state, formAction, isPending] = useActionState(saveCommunityPostAction, INITIAL_STATE)

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [notice, setNotice] = useState(false)
  const [attachmentUrl, setAttachmentUrl] = useState('')
  const [loading, setLoading] = useState(isEdit)
  const [error, setError] = useState<string | null>(null)

  const numericPostId = Number(postId)

  useEffect(() => {
    if (!isEdit) {
      return
    }

    if (!numericPostId || Number.isNaN(numericPostId)) {
      setError('잘못된 게시글 주소입니다.')
      setLoading(false)
      return
    }

    const loadPost = async () => {
      try {
        const response = await axios.get<Post>(`${API_BASE}/api/community/posts/${numericPostId}`, {
          headers: authHeaders,
        })
        setTitle(response.data.title)
        setContent(response.data.content)
        setNotice(response.data.notice)
        setAttachmentUrl(response.data.attachmentUrl ?? '')
      } catch {
        setError('수정할 게시글 정보를 불러오지 못했습니다.')
      } finally {
        setLoading(false)
      }
    }

    void loadPost()
  }, [authHeaders, isEdit, numericPostId])

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    if (token) {
      return
    }

    event.preventDefault()
    router.push(loginRedirectUrl)
  }

  return (
    <Page>
      <Header />
      <Wrapper>
        <Breadcrumb>
          <Link href="/community">커뮤니티</Link> / {isEdit ? '글 수정' : '글 쓰기'}
        </Breadcrumb>
        <Card>
          <Title>{isEdit ? '게시글 수정' : '새 글 작성'}</Title>
          {loading && <Meta>기존 게시글 정보를 불러오는 중입니다...</Meta>}
          {!token && <ErrorBox>로그인 후 게시글을 작성할 수 있습니다. 제출 시 로그인 페이지로 이동합니다.</ErrorBox>}
          {error && <ErrorBox>{error}</ErrorBox>}
          {state.error && <ErrorBox>{state.error}</ErrorBox>}
          {!loading && (
            <form action={formAction} onSubmit={handleSubmit}>
              <input name="postId" type="hidden" value={postId ?? ''} />

              <Label htmlFor="title">제목</Label>
              <Input
                id="title"
                name="title"
                onChange={event => setTitle(event.target.value)}
                placeholder="제목을 입력해 주세요."
                required
                value={title}
              />

              <Label htmlFor="content">내용</Label>
              <Textarea
                id="content"
                name="content"
                onChange={event => setContent(event.target.value)}
                placeholder="내용을 입력해 주세요."
                required
                value={content}
              />

              <Label htmlFor="attachmentUrl">첨부 링크</Label>
              <Input
                id="attachmentUrl"
                name="attachmentUrl"
                onChange={event => setAttachmentUrl(event.target.value)}
                placeholder="/uploads/... 또는 외부 URL"
                value={attachmentUrl}
              />

              <Label htmlFor="file">첨부 파일</Label>
              <Input id="file" name="file" type="file" />
              <Meta>파일을 선택하면 저장 시 서버 액션이 업로드까지 함께 처리합니다.</Meta>

              {isAdmin && (
                <Label htmlFor="notice">
                  <input
                    checked={notice}
                    id="notice"
                    name="notice"
                    onChange={event => setNotice(event.target.checked)}
                    style={{ marginRight: 8 }}
                    type="checkbox"
                  />
                  공지사항으로 등록
                </Label>
              )}

              <ButtonRow>
                <GrayButton onClick={() => router.back()} type="button">
                  취소
                </GrayButton>
                <Button disabled={isPending} type="submit">
                  {isPending ? '저장 중...' : '저장'}
                </Button>
              </ButtonRow>
            </form>
          )}
        </Card>
      </Wrapper>
      <Footer />
    </Page>
  )
}

export default CommunityWrite
