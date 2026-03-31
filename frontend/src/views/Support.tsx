'use client'

import React, { useActionState, useEffect, useState } from 'react'
import styled from 'styled-components'
import axios from 'axios'
import { useSearchParams } from 'next/navigation'

import Header from '../components/Header'
import Footer from '../components/Footer'
import { submitSupportInquiryAction, type SupportInquiryActionState } from '@/app/support/actions'
import { API_BASE_URL } from '@/config/publicEnv'

const API_BASE = API_BASE_URL

function parseRoleFromToken(token: string | null): string | null {
  if (!token) return null

  try {
    const payload = token.split('.')[1]
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
    const decoded = JSON.parse(atob(normalized))
    return typeof decoded.role === 'string' ? decoded.role : null
  } catch {
    return null
  }
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('ko-KR')
}

const Container = styled.div`
  min-height: 100vh;
  background: #f5f6f7;
  display: flex;
  flex-direction: column;
`

const Main = styled.main`
  flex: 1;
  max-width: 900px;
  width: 100%;
  margin: 40px auto;
  padding: 0 20px;
`

const Title = styled.h1`
  font-size: 28px;
  color: #1a2e57;
  margin-bottom: 24px;
  font-weight: 800;
  text-align: center;
`

const Tabs = styled.div`
  display: flex;
  margin-bottom: 32px;
  border-bottom: 2px solid #eaeaea;
`

const Tab = styled.button<{ $active: boolean }>`
  flex: 1;
  padding: 16px;
  font-size: 16px;
  font-weight: 700;
  background: none;
  border: none;
  color: ${p => (p.$active ? '#093687' : '#888')};
  border-bottom: 3px solid ${p => (p.$active ? '#093687' : 'transparent')};
  margin-bottom: -2px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    color: #093687;
  }
`

const ContentArea = styled.div`
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  padding: 32px;
`

const FaqItem = styled.div`
  border-bottom: 1px solid #eaeaea;

  &:last-child {
    border-bottom: none;
  }
`

const FaqQuestion = styled.button`
  width: 100%;
  text-align: left;
  padding: 20px 0;
  background: none;
  border: none;
  font-size: 16px;
  font-weight: 600;
  color: #333;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;

  &:hover {
    color: #093687;
  }
`

const FaqAnswer = styled.div<{ $isOpen: boolean }>`
  max-height: ${p => (p.$isOpen ? '300px' : '0')};
  overflow: hidden;
  transition: max-height 0.3s ease;
  background: #f8f9fa;
  padding: ${p => (p.$isOpen ? '20px' : '0 20px')};
  color: #555;
  line-height: 1.6;
  border-radius: 8px;
  margin-bottom: ${p => (p.$isOpen ? '20px' : '0')};
`

const FaqCategory = styled.span`
  color: #093687;
  font-size: 14px;
  margin-right: 12px;
`

const InquiryHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
`

const WriteBtn = styled.button`
  background: #093687;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;

  &:hover {
    background: #0a4099;
  }

  &:disabled {
    background: #94a3b8;
    cursor: not-allowed;
  }
`

const InquiryList = styled.div`
  border-top: 2px solid #333;
`

const InquiryItem = styled.div`
  border-bottom: 1px solid #eaeaea;
  padding: 20px 0;
`

const InquiryTitleRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  font-weight: 600;
  font-size: 16px;
`

const StatusBadge = styled.span<{ $status: string }>`
  background: ${p => (p.$status === 'PENDING' ? '#f1f5f9' : '#dcfce7')};
  color: ${p => (p.$status === 'PENDING' ? '#64748b' : '#16a34a')};
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  margin-right: 12px;
`

const InquiryContent = styled.div`
  margin-top: 16px;
  padding: 20px;
  background: #f8f9fa;
  border-radius: 8px;
  font-size: 14px;
  color: #444;
  line-height: 1.6;
`

const InquiryReply = styled.div`
  margin-top: 16px;
  padding: 20px;
  background: #eef2ff;
  border-left: 4px solid #4f46e5;
  border-radius: 0 8px 8px 0;
  font-size: 14px;
  color: #444;
  line-height: 1.6;
`

const DeleteBtn = styled.button`
  background: none;
  border: 1px solid #dc2626;
  color: #dc2626;
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  margin-left: 8px;

  &:hover {
    background: #dc2626;
    color: white;
  }
`

const ReplyBtn = styled.button`
  background: none;
  border: 1px solid #4f46e5;
  color: #4f46e5;
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  margin-left: 8px;

  &:hover {
    background: #4f46e5;
    color: white;
  }
`

const ReplyForm = styled.div`
  margin-top: 12px;
  padding: 16px;
  background: #f0f0ff;
  border-radius: 8px;
`

const ReplyTextarea = styled.textarea`
  width: 100%;
  min-height: 80px;
  border: 1px solid #c7d2fe;
  border-radius: 6px;
  padding: 10px;
  font-size: 14px;
  resize: vertical;
  margin-bottom: 8px;
`

const ReplySubmitBtn = styled.button`
  background: #4f46e5;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  margin-right: 8px;

  &:hover {
    background: #4338ca;
  }
`

const ReplyCancelBtn = styled.button`
  background: #e2e8f0;
  color: #475569;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;

  &:hover {
    background: #cbd5e1;
  }
`

const StaffBadge = styled.span`
  background: #4f46e5;
  color: white;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 700;
  margin-left: 8px;
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

const ModalContent = styled.div`
  background: white;
  width: 500px;
  border-radius: 12px;
  padding: 32px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.2);
`

const InputGroup = styled.div`
  margin-bottom: 20px;
`

const Label = styled.label`
  display: block;
  font-weight: 600;
  margin-bottom: 8px;
  color: #333;
`

const Input = styled.input`
  width: 100%;
  padding: 12px;
  border: 1px solid #ccc;
  border-radius: 8px;
  font-size: 15px;
`

const TextArea = styled.textarea`
  width: 100%;
  padding: 12px;
  border: 1px solid #ccc;
  border-radius: 8px;
  font-size: 15px;
  min-height: 150px;
  resize: vertical;
`

const ButtonRow = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
`

const CancelBtn = styled.button`
  padding: 10px 20px;
  background: #e2e8f0;
  color: #475569;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;

  &:hover {
    background: #cbd5e1;
  }
`

interface Faq {
  faqId: number
  category: string
  question: string
  answer: string
}

interface Inquiry {
  inquiryId: number
  title: string
  content: string
  status: string
  reply: string | null
  attachmentUrl: string | null
  createdAt: string
}

interface AdminInquiry {
  inquiryId: number
  memberId: number
  memberEmail: string
  memberName: string
  title: string
  content: string
  status: string
  reply: string | null
  attachmentUrl: string | null
  createdAt: string
}

const INITIAL_INQUIRY_STATE: SupportInquiryActionState = { error: null }

interface InquiryWriteModalProps {
  onClose: () => void
  onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void
}

function InquiryWriteModal({ onClose, onFileChange }: InquiryWriteModalProps) {
  const [state, formAction, isPending] = useActionState(submitSupportInquiryAction, INITIAL_INQUIRY_STATE)

  return (
    <ModalOverlay onClick={onClose}>
      <ModalContent onClick={event => event.stopPropagation()}>
        <h2>1:1 문의 작성</h2>
        {state.error && (
          <div
            style={{
              marginBottom: '16px',
              padding: '12px 14px',
              borderRadius: '8px',
              border: '1px solid #fecaca',
              background: '#fff5f5',
              color: '#b91c1c',
              fontSize: '14px',
            }}
          >
            {state.error}
          </div>
        )}
        <form action={formAction}>
          <InputGroup>
            <Label>제목</Label>
            <Input name="title" placeholder="문의 제목을 입력해 주세요." required />
          </InputGroup>
          <InputGroup>
            <Label>내용</Label>
            <TextArea
              name="content"
              placeholder="문의 내용을 자세히 적어 주세요."
              required
            />
          </InputGroup>
          <InputGroup>
            <Label>첨부 파일 (선택, 최대 10MB)</Label>
            <Input
              name="file"
              onChange={onFileChange}
              style={{ padding: '8px' }}
              type="file"
            />
          </InputGroup>
          <ButtonRow>
            <CancelBtn onClick={onClose} type="button">
              취소
            </CancelBtn>
            <WriteBtn disabled={isPending} type="submit">
              {isPending ? '등록 중...' : '등록하기'}
            </WriteBtn>
          </ButtonRow>
        </form>
      </ModalContent>
    </ModalOverlay>
  )
}

const Support: React.FC = () => {
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState<'faq' | 'inquiry'>(
    () => (searchParams.get('tab') === 'inquiry' ? 'inquiry' : 'faq'),
  )
  const [faqs, setFaqs] = useState<Faq[]>([])
  const [inquiries, setInquiries] = useState<Inquiry[]>([])
  const [adminInquiries, setAdminInquiries] = useState<AdminInquiry[]>([])
  const [openFaqId, setOpenFaqId] = useState<number | null>(null)
  const [openInquiryId, setOpenInquiryId] = useState<number | null>(null)
  const [isWriting, setIsWriting] = useState(false)
  const [replyingId, setReplyingId] = useState<number | null>(null)
  const [replyText, setReplyText] = useState('')

  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null
  const isLoggedIn = Boolean(token)
  const role = parseRoleFromToken(token)
  const isStaff = role === 'STAFF' || role === 'ADMIN' || role === 'MANAGER'

  useEffect(() => {
    if (searchParams.get('tab') === 'inquiry') {
      setActiveTab('inquiry')
    }
  }, [searchParams])

  useEffect(() => {
    void fetchFaqs()

    if (!isLoggedIn) {
      return
    }

    if (isStaff) {
      void fetchAdminInquiries()
      return
    }

    void fetchInquiries()
  }, [isLoggedIn, isStaff, token])

  const fetchFaqs = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/support/faqs`)
      setFaqs(res.data)
    } catch (error) {
      console.error(error)
    }
  }

  const fetchInquiries = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/support/inquiries`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      setInquiries(res.data)
    } catch (error) {
      console.error(error)
    }
  }

  const fetchAdminInquiries = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/admin/inquiries`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      setAdminInquiries(res.data)
    } catch (error) {
      console.error(error)
    }
  }

  const handleWriteClick = () => {
    if (!isLoggedIn) {
      const redirect = encodeURIComponent(`${window.location.pathname}${window.location.search}`)
      window.location.href = `/login?redirect=${redirect}`
      return
    }

    setIsWriting(true)
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0]
    if (!selectedFile) {
      return
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      alert('파일 크기는 10MB 이하만 가능합니다.')
      event.target.value = ''
    }
  }

  const handleDeleteInquiry = async (inquiryId: number) => {
    if (!window.confirm('문의를 삭제하시겠습니까?')) {
      return
    }

    try {
      await axios.delete(`${API_BASE}/api/support/inquiries/${inquiryId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      setInquiries(prev => prev.filter(inquiry => inquiry.inquiryId !== inquiryId))
      if (openInquiryId === inquiryId) {
        setOpenInquiryId(null)
      }
    } catch {
      alert('문의 삭제에 실패했습니다.')
    }
  }

  const handleStartReply = (inquiryId: number, existingReply: string | null) => {
    setReplyingId(inquiryId)
    setOpenInquiryId(inquiryId)
    setReplyText(existingReply ?? '')
  }

  const handleSubmitReply = async (inquiryId: number) => {
    if (!replyText.trim()) {
      alert('답변 내용을 입력해 주세요.')
      return
    }

    try {
      await axios.patch(
        `${API_BASE}/api/admin/inquiries/${inquiryId}/reply`,
        { reply: replyText, status: 'ANSWERED' },
        { headers: { Authorization: `Bearer ${token}` } },
      )
      setReplyingId(null)
      setReplyText('')
      await fetchAdminInquiries()
    } catch {
      alert('답변 등록에 실패했습니다.')
    }
  }

  return (
    <Container>
      <Header />
      <Main>
        <Title>
          고객센터
          {isStaff && <StaffBadge>STAFF</StaffBadge>}
        </Title>

        <Tabs>
          <Tab $active={activeTab === 'faq'} onClick={() => setActiveTab('faq')}>
            자주 묻는 질문
          </Tab>
          <Tab $active={activeTab === 'inquiry'} onClick={() => setActiveTab('inquiry')}>
            1:1 문의 게시판
            {isStaff && ' (전체)'}
          </Tab>
        </Tabs>

        <ContentArea>
          {activeTab === 'faq' ? (
            <div>
              {faqs.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#888', padding: '40px 0' }}>
                  등록된 FAQ가 없습니다.
                </p>
              ) : (
                faqs.map(faq => (
                  <FaqItem key={faq.faqId}>
                    <FaqQuestion onClick={() => setOpenFaqId(openFaqId === faq.faqId ? null : faq.faqId)}>
                      <span>
                        <FaqCategory>[{faq.category}]</FaqCategory>
                        {faq.question}
                      </span>
                      <span>{openFaqId === faq.faqId ? '−' : '+'}</span>
                    </FaqQuestion>
                    <FaqAnswer $isOpen={openFaqId === faq.faqId}>{faq.answer}</FaqAnswer>
                  </FaqItem>
                ))
              )}
            </div>
          ) : isStaff ? (
            <div>
              <InquiryHeader>
                <span>전체 문의 내역 ({adminInquiries.length}건)</span>
                <WriteBtn onClick={handleWriteClick}>문의하기</WriteBtn>
              </InquiryHeader>
              {adminInquiries.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#888', padding: '40px 0' }}>
                  등록된 문의가 없습니다.
                </p>
              ) : (
                <InquiryList>
                  {adminInquiries.map(inquiry => (
                    <InquiryItem key={inquiry.inquiryId}>
                      <InquiryTitleRow
                        onClick={() =>
                          setOpenInquiryId(openInquiryId === inquiry.inquiryId ? null : inquiry.inquiryId)
                        }
                      >
                        <span>
                          <StatusBadge $status={inquiry.status}>
                            {inquiry.status === 'PENDING' ? '답변 대기' : '답변 완료'}
                          </StatusBadge>
                          {inquiry.title}
                          <span
                            style={{
                              fontSize: 12,
                              color: '#6b7280',
                              fontWeight: 400,
                              marginLeft: 8,
                            }}
                          >
                            {inquiry.memberName} ({inquiry.memberEmail})
                          </span>
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: '13px', color: '#999', fontWeight: 400 }}>
                            {formatDate(inquiry.createdAt)}
                          </span>
                          <ReplyBtn
                            onClick={event => {
                              event.stopPropagation()
                              handleStartReply(inquiry.inquiryId, inquiry.reply)
                            }}
                          >
                            {inquiry.reply ? '답변 수정' : '답변 달기'}
                          </ReplyBtn>
                        </span>
                      </InquiryTitleRow>

                      {openInquiryId === inquiry.inquiryId && (
                        <>
                          <InquiryContent>
                            <strong>문의 내용:</strong>
                            <br />
                            {inquiry.content}
                            {inquiry.attachmentUrl && (
                              <div style={{ marginTop: '12px' }}>
                                <a
                                  href={`${API_BASE}${inquiry.attachmentUrl}`}
                                  rel="noreferrer"
                                  style={{ color: '#093687', fontWeight: 600, textDecoration: 'underline' }}
                                  target="_blank"
                                >
                                  첨부 파일 보기
                                </a>
                              </div>
                            )}
                          </InquiryContent>

                          {inquiry.reply && (
                            <InquiryReply>
                              <strong>답변:</strong>
                              <br />
                              {inquiry.reply}
                            </InquiryReply>
                          )}

                          {replyingId === inquiry.inquiryId && (
                            <ReplyForm onClick={event => event.stopPropagation()}>
                              <strong style={{ fontSize: 13, color: '#4f46e5' }}>답변 작성</strong>
                              <ReplyTextarea
                                onChange={event => setReplyText(event.target.value)}
                                placeholder="답변 내용을 입력해 주세요."
                                value={replyText}
                              />
                              <div>
                                <ReplySubmitBtn onClick={() => void handleSubmitReply(inquiry.inquiryId)}>
                                  등록
                                </ReplySubmitBtn>
                                <ReplyCancelBtn
                                  onClick={() => {
                                    setReplyingId(null)
                                    setReplyText('')
                                  }}
                                >
                                  취소
                                </ReplyCancelBtn>
                              </div>
                            </ReplyForm>
                          )}
                        </>
                      )}
                    </InquiryItem>
                  ))}
                </InquiryList>
              )}
            </div>
          ) : (
            <div>
              <InquiryHeader>
                <span>내 문의 내역 ({inquiries.length}건)</span>
                <WriteBtn onClick={handleWriteClick}>문의하기</WriteBtn>
              </InquiryHeader>

              {!isLoggedIn ? (
                <p style={{ textAlign: 'center', color: '#888', padding: '40px 0' }}>
                  로그인 후 문의 내역을 확인할 수 있습니다.
                </p>
              ) : inquiries.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#888', padding: '40px 0' }}>
                  등록된 문의가 없습니다.
                </p>
              ) : (
                <InquiryList>
                  {inquiries.map(inquiry => (
                    <InquiryItem key={inquiry.inquiryId}>
                      <InquiryTitleRow
                        onClick={() =>
                          setOpenInquiryId(openInquiryId === inquiry.inquiryId ? null : inquiry.inquiryId)
                        }
                      >
                        <span>
                          <StatusBadge $status={inquiry.status}>
                            {inquiry.status === 'PENDING' ? '답변 대기' : '답변 완료'}
                          </StatusBadge>
                          {inquiry.title}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: '13px', color: '#999', fontWeight: 400 }}>
                            {formatDate(inquiry.createdAt)}
                          </span>
                          <DeleteBtn
                            onClick={event => {
                              event.stopPropagation()
                              void handleDeleteInquiry(inquiry.inquiryId)
                            }}
                          >
                            삭제
                          </DeleteBtn>
                        </span>
                      </InquiryTitleRow>

                      {openInquiryId === inquiry.inquiryId && (
                        <>
                          <InquiryContent>
                            <strong>문의 내용:</strong>
                            <br />
                            {inquiry.content}
                            {inquiry.attachmentUrl && (
                              <div style={{ marginTop: '12px' }}>
                                <a
                                  href={`${API_BASE}${inquiry.attachmentUrl}`}
                                  rel="noreferrer"
                                  style={{ color: '#093687', fontWeight: 600, textDecoration: 'underline' }}
                                  target="_blank"
                                >
                                  첨부 파일 보기
                                </a>
                              </div>
                            )}
                          </InquiryContent>

                          {inquiry.status === 'ANSWERED' && inquiry.reply && (
                            <InquiryReply>
                              <strong>관리자 답변:</strong>
                              <br />
                              {inquiry.reply}
                            </InquiryReply>
                          )}
                        </>
                      )}
                    </InquiryItem>
                  ))}
                </InquiryList>
              )}
            </div>
          )}
        </ContentArea>
      </Main>
      <Footer />

      {isWriting && (
        <InquiryWriteModal
          onClose={() => setIsWriting(false)}
          onFileChange={handleFileChange}
        />
      )}
    </Container>
  )
}

export default Support
