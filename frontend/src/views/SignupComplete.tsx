'use client'

import React, { useActionState, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import styled from 'styled-components'

import {
  completeSignupAction,
  type SignupCompleteActionState,
} from '@/app/signup/complete/actions'

const BANK_OPTIONS = [
  'NH농협은행',
  '우리은행',
  '신한은행',
  'KB국민은행',
  '하나은행',
  '카카오뱅크',
  '케이뱅크',
  '토스뱅크',
  'IBK기업은행',
  'SC제일은행',
  '경남은행',
  '광주은행',
  '대구은행',
  '부산은행',
  '전북은행',
  '제주은행',
  '수협은행',
  '우체국',
  '새마을금고',
  '신협',
  '기타',
] as const

const INITIAL_STATE: SignupCompleteActionState = { error: null }

const Container = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background-color: #f5f6f7;
  padding: 40px 0;
`

const FormBox = styled.div`
  background: white;
  width: 500px;
  padding: 48px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
`

const Title = styled.h1`
  font-size: 24px;
  font-weight: 700;
  color: #333;
  margin-bottom: 8px;
  text-align: center;
`

const SubText = styled.p`
  font-size: 14px;
  color: #666;
  margin-bottom: 32px;
  text-align: center;
`

const StyledForm = styled.form`
  display: flex;
  flex-direction: column;
  gap: 20px;
`

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`

const Label = styled.label`
  font-size: 14px;
  font-weight: 600;
  color: #333;
`

const Input = styled.input`
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 15px;
  transition: border-color 0.2s;

  &:focus {
    outline: none;
    border-color: #093687;
  }
`

const Select = styled.select`
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 15px;
  transition: border-color 0.2s;
  background-color: white;

  &:focus {
    outline: none;
    border-color: #093687;
  }
`

const FileInputWrapper = styled.div`
  border: 1px dashed #ddd;
  padding: 20px;
  border-radius: 4px;
  text-align: center;
  background: #fafafa;
`

const SubmitButton = styled.button`
  margin-top: 10px;
  padding: 15px;
  background-color: #093687;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  transition: background-color 0.2s;

  &:hover {
    background-color: #072a6c;
  }

  &:disabled {
    background-color: #ccc;
    cursor: not-allowed;
  }
`

const ErrorText = styled.span`
  color: #e02929;
  font-size: 12px;
`

const ErrorBox = styled.div`
  margin-bottom: 8px;
  border: 1px solid #efcccc;
  background: #fff5f5;
  color: #9f2d2d;
  border-radius: 8px;
  padding: 12px 14px;
  font-size: 14px;
`

const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
`

const ModalContainer = styled.div`
  background: white;
  border-radius: 12px;
  width: 500px;
  max-width: 90%;
  padding: 32px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
`

const ModalTitle = styled.h2`
  font-size: 20px;
  color: #333;
  margin-top: 0;
  margin-bottom: 16px;
`

const ModalText = styled.div`
  font-size: 14px;
  color: #666;
  line-height: 1.6;
  margin-bottom: 24px;
  background: #f8f9fa;
  padding: 16px;
  border-radius: 8px;
  white-space: pre-wrap;
  max-height: 400px;
  overflow-y: auto;
  border: 1px solid #ddd;
`

const ModalButtonGroup = styled.div`
  display: flex;
  justify-content: flex-end;
`

const ModalButton = styled.button`
  padding: 10px 20px;
  background: #093687;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;

  &:hover {
    background: #0a4099;
  }
`

function formatRrnPrefix(value: string): string {
  const digits = value.replace(/[^0-9]/g, '').slice(0, 7)
  if (digits.length <= 6) {
    return digits
  }

  return `${digits.slice(0, 6)}-${digits.slice(6)}`
}

function formatPhoneNumber(value: string): string {
  const digits = value.replace(/[^0-9]/g, '').slice(0, 11)

  if (digits.length <= 3) {
    return digits
  }

  if (digits.length <= 7) {
    return `${digits.slice(0, 3)}-${digits.slice(3)}`
  }

  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
}

const SignupComplete: React.FC = () => {
  const searchParams = useSearchParams()
  const signupToken = searchParams.get('token') ?? ''
  const [state, formAction, isPending] = useActionState(completeSignupAction, INITIAL_STATE)
  const [showTerms, setShowTerms] = useState(false)
  const [rrnPrefix, setRrnPrefix] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')

  return (
    <Container>
      <FormBox>
        <Title>추가 정보 입력</Title>
        <SubText>본인 확인에 필요한 정보를 입력해 주세요.</SubText>

        {!signupToken && <ErrorBox>회원가입 인증 토큰이 없습니다. 처음부터 다시 진행해 주세요.</ErrorBox>}
        {state.error && <ErrorBox>{state.error}</ErrorBox>}

        <StyledForm action={formAction}>
          <input type="hidden" name="signupToken" value={signupToken} />

          <FormGroup>
            <Label htmlFor="name">이름</Label>
            <Input id="name" name="name" placeholder="홍길동" required />
          </FormGroup>

          <FormGroup>
            <Label htmlFor="rrnPrefix">주민등록번호 앞 6자리 + 뒤 1자리</Label>
            <Input
              id="rrnPrefix"
              name="rrnPrefix"
              maxLength={8}
              onChange={(event) => setRrnPrefix(formatRrnPrefix(event.target.value))}
              pattern="[0-9]{6}-[0-9]"
              placeholder="900101-1"
              required
              value={rrnPrefix}
            />
            <ErrorText>형식: 900101-1</ErrorText>
          </FormGroup>

          <FormGroup>
            <Label htmlFor="phoneNumber">휴대전화 번호</Label>
            <Input
              id="phoneNumber"
              name="phoneNumber"
              maxLength={13}
              onChange={(event) => setPhoneNumber(formatPhoneNumber(event.target.value))}
              pattern="01[0-9]-[0-9]{3,4}-[0-9]{4}"
              placeholder="010-1234-5678"
              required
              value={phoneNumber}
            />
          </FormGroup>

          <FormGroup>
            <Label htmlFor="address">주소</Label>
            <Input id="address" name="address" placeholder="서울특별시 강남구 ..." required />
          </FormGroup>

          <FormGroup>
            <Label htmlFor="bankName">계좌 정보</Label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <Select id="bankName" name="bankName" required style={{ width: '160px' }}>
                <option value="">은행 선택</option>
                {BANK_OPTIONS.map(bank => (
                  <option key={bank} value={bank}>
                    {bank}
                  </option>
                ))}
              </Select>
              <Input
                id="accountNumber"
                name="accountNumber"
                placeholder="계좌번호 숫자만 입력"
                required
                style={{ flex: 1 }}
              />
            </div>
          </FormGroup>

          <FormGroup>
            <Label htmlFor="referredByCode">추천인 코드</Label>
            <Input id="referredByCode" name="referredByCode" placeholder="선택 사항" />
          </FormGroup>

          <FormGroup>
            <Label htmlFor="idPhoto">신분증 사본 업로드</Label>
            <FileInputWrapper>
              <Input id="idPhoto" name="idPhoto" required type="file" />
            </FileInputWrapper>
            <ErrorText>이미지 또는 문서 파일을 업로드해 주세요.</ErrorText>
          </FormGroup>

          <div
            style={{
              marginBottom: '24px',
              marginTop: '24px',
              padding: '16px',
              background: '#f8f9fa',
              borderRadius: '8px',
              border: '1px solid #ddd',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                id="agreedToTerms"
                name="agreedToTerms"
                required
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                type="checkbox"
              />
              <label
                htmlFor="agreedToTerms"
                style={{ cursor: 'pointer', fontSize: '14px', color: '#333', fontWeight: 600, flex: 1 }}
              >
                [필수] VCE 가입 및 이용 약관에 동의합니다.
              </label>
              <button
                onClick={() => setShowTerms(true)}
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  background: 'white',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
                type="button"
              >
                자세히 보기
              </button>
            </div>
          </div>

          <SubmitButton disabled={isPending || !signupToken} type="submit">
            {isPending ? '처리 중...' : '가입 완료'}
          </SubmitButton>
        </StyledForm>
      </FormBox>

      {showTerms && (
        <ModalOverlay onClick={() => setShowTerms(false)}>
          <ModalContainer onClick={event => event.stopPropagation()}>
            <ModalTitle>회원 가입 이용 약관</ModalTitle>
            <ModalText>
              {`제1조 (목적)
본 약관은 VCE 서비스 이용과 관련한 권리와 의무를 규정합니다.

제2조 (회원의 의무)
회원은 본인 정보를 정확하게 입력해야 하며, 타인의 정보를 도용해서는 안 됩니다.

제3조 (서비스 이용)
서비스는 운영 정책과 관련 법령에 따라 제공되며, 필요한 경우 일부 기능이 제한될 수 있습니다.

제4조 (개인정보 보호)
회사는 관계 법령에 따라 회원 정보를 보호하며, 서비스 제공에 필요한 범위 내에서만 사용합니다.`}
            </ModalText>
            <ModalButtonGroup>
              <ModalButton onClick={() => setShowTerms(false)} type="button">
                확인
              </ModalButton>
            </ModalButtonGroup>
          </ModalContainer>
        </ModalOverlay>
      )}
    </Container>
  )
}

export default SignupComplete
