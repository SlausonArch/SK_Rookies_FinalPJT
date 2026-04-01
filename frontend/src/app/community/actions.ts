'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { BackendRequestError, requestBackend } from '@/server/backend'

interface PostResponse {
  postId: number
}

export interface CommunityPostActionState {
  error: string | null
}

function getText(formData: FormData, key: string): string {
  return String(formData.get(key) ?? '').trim()
}

async function uploadAttachment(file: File): Promise<string> {
  const uploadData = new FormData()
  uploadData.append('file', file)

  const uploadResponse = await requestBackend<{ attachmentUrl: string }>('/api/community/uploads', {
    auth: 'user',
    body: uploadData,
    method: 'POST',
  })

  return uploadResponse.attachmentUrl
}

export async function saveCommunityPostAction(
  _prevState: CommunityPostActionState,
  formData: FormData,
): Promise<CommunityPostActionState> {
  const title = getText(formData, 'title')
  const content = getText(formData, 'content')
  const postId = getText(formData, 'postId')
  const notice = formData.get('notice') === 'on'
  let attachmentUrl = getText(formData, 'attachmentUrl')

  if (!title || !content) {
    return { error: '제목과 내용을 모두 입력해 주세요.' }
  }

  const file = formData.get('file')
  if (file instanceof File && file.size > 0) {
    try {
      attachmentUrl = await uploadAttachment(file)
    } catch (error) {
      if (error instanceof BackendRequestError) {
        return { error: error.message }
      }

      return { error: '첨부 파일 업로드 중 오류가 발생했습니다.' }
    }
  }

  const payload = {
    attachmentUrl: attachmentUrl || null,
    content,
    notice,
    title,
  }

  let response: PostResponse

  try {
    response = postId
      ? await requestBackend<PostResponse>(`/api/community/posts/${postId}`, {
          auth: 'user',
          body: JSON.stringify(payload),
          headers: {
            'Content-Type': 'application/json',
          },
          method: 'PUT',
        })
      : await requestBackend<PostResponse>('/api/community/posts', {
          auth: 'user',
          body: JSON.stringify(payload),
          headers: {
            'Content-Type': 'application/json',
          },
          method: 'POST',
        })
  } catch (error) {
    if (error instanceof BackendRequestError) {
      return { error: error.message }
    }

    return { error: '게시글 저장 중 오류가 발생했습니다.' }
  }

  revalidatePath('/community')
  revalidatePath(`/community/${response.postId}`)
  redirect(`/community/${response.postId}`)
}
