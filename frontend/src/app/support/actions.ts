'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { BackendRequestError, requestBackend } from '@/server/backend'

export interface SupportInquiryActionState {
  error: string | null
}

function getText(formData: FormData, key: string): string {
  return String(formData.get(key) ?? '').trim()
}

export async function submitSupportInquiryAction(
  _prevState: SupportInquiryActionState,
  formData: FormData,
): Promise<SupportInquiryActionState> {
  const title = getText(formData, 'title')
  const content = getText(formData, 'content')
  const file = formData.get('file')

  if (!title || !content) {
    return { error: '제목과 내용을 모두 입력해 주세요.' }
  }

  if (file instanceof File && file.size > 10 * 1024 * 1024) {
    return { error: '첨부 파일은 10MB 이하만 업로드할 수 있습니다.' }
  }

  const payload = new FormData()
  payload.append('title', title)
  payload.append('content', content)
  if (file instanceof File && file.size > 0) {
    payload.append('file', file)
  }

  try {
    await requestBackend('/api/support/inquiries', {
      auth: 'user',
      body: payload,
      method: 'POST',
    })
  } catch (error) {
    if (error instanceof BackendRequestError) {
      return { error: error.message }
    }

    return { error: '문의 등록 중 오류가 발생했습니다.' }
  }

  revalidatePath('/support')
  redirect('/support?tab=inquiry')
}
