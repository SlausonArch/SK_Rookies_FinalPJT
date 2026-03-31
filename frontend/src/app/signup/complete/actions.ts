'use server'

import { redirect } from 'next/navigation'

import { setUserAccessTokenCookie } from '@/server/auth-cookies'
import { BackendRequestError, requestBackend } from '@/server/backend'

export interface SignupCompleteActionState {
  error: string | null
}

function getText(formData: FormData, key: string): string {
  return String(formData.get(key) ?? '').trim()
}

export async function completeSignupAction(
  _prevState: SignupCompleteActionState,
  formData: FormData,
): Promise<SignupCompleteActionState> {
  const signupToken = getText(formData, 'signupToken')
  const name = getText(formData, 'name')
  const rrnPrefix = getText(formData, 'rrnPrefix')
  const phoneNumber = getText(formData, 'phoneNumber')
  const address = getText(formData, 'address')
  const bankName = getText(formData, 'bankName')
  const accountNumber = getText(formData, 'accountNumber')
  const referredByCode = getText(formData, 'referredByCode')
  const agreedToTerms = formData.get('agreedToTerms') === 'on'
  const idPhoto = formData.get('idPhoto')

  if (!signupToken) {
    return { error: '회원가입 인증 정보가 없습니다. 처음부터 다시 진행해 주세요.' }
  }

  if (!name || !rrnPrefix || !phoneNumber || !address || !bankName || !accountNumber) {
    return { error: '필수 정보를 모두 입력해 주세요.' }
  }

  if (!agreedToTerms) {
    return { error: '약관 동의가 필요합니다.' }
  }

  if (!(idPhoto instanceof File) || idPhoto.size === 0) {
    return { error: '신분증 파일을 업로드해 주세요.' }
  }

  const payload = new FormData()
  payload.append(
    'data',
    new Blob(
      [
        JSON.stringify({
          name,
          rrnPrefix,
          phoneNumber,
          address,
          bankName,
          accountNumber,
          referredByCode,
        }),
      ],
      { type: 'application/json' },
    ),
  )
  payload.append('file', idPhoto)

  try {
    const newToken = await requestBackend<string>('/api/auth/signup/complete', {
      auth: 'none',
      body: payload,
      headers: {
        Authorization: `Bearer ${signupToken}`,
      },
      method: 'POST',
    })

    await setUserAccessTokenCookie(newToken)
  } catch (error) {
    if (error instanceof BackendRequestError) {
      return { error: error.message }
    }

    return { error: '회원가입 완료 처리 중 오류가 발생했습니다.' }
  }

  redirect('/')
}
