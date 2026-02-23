import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import axios from 'axios';
import { useSearchParams, useNavigate } from 'react-router-dom';
import styled from 'styled-components';

const Container = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background-color: #f5f6f7;
  padding: 40px 0;
`;

const FormBox = styled.div`
  background: white;
  width: 500px;
  padding: 48px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.08);
`;

const Title = styled.h1`
  font-size: 24px;
  font-weight: 700;
  color: #333;
  margin-bottom: 8px;
  text-align: center;
`;

const SubText = styled.p`
  font-size: 14px;
  color: #666;
  margin-bottom: 32px;
  text-align: center;
`;

const StyledForm = styled.form`
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const Label = styled.label`
  font-size: 14px;
  font-weight: 600;
  color: #333;
`;

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
`;

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
`;

const FileInputWrapper = styled.div`
  border: 1px dashed #ddd;
  padding: 20px;
  border-radius: 4px;
  text-align: center;
  background: #fafafa;
  cursor: pointer;
  
  &:hover {
    background: #f0f0f0;
  }
`;

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
`;

const ErrorText = styled.span`
  color: #e02929;
  font-size: 12px;
`;

const ModalOverlay = styled.div`
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.6);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
`;

const ModalContainer = styled.div`
  background: white;
  border-radius: 12px;
  width: 500px;
  max-width: 90%;
  padding: 32px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
`;

const ModalTitle = styled.h2`
  font-size: 20px;
  color: #333;
  margin-top: 0;
  margin-bottom: 16px;
`;

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
`;

const ModalButtonGroup = styled.div`
  display: flex;
  justify-content: flex-end;
`;

const ModalButton = styled.button`
  padding: 10px 20px;
  background: #093687;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
  &:hover { background: #0a4099; }
`;

interface SignupInputs {
    name: string;
    rrnPrefix: string;
    phoneNumber: string;
    address: string;
    bankName: string;
    accountNumber: string;
    referredByCode: string; // 추천인 코드 추가
    idPhoto: FileList;
    agreedToTerms: boolean;
}

const SignupComplete: React.FC = () => {
    const { register, handleSubmit, setValue, formState: { errors } } = useForm<SignupInputs>();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showTerms, setShowTerms] = useState(false);

    const token = searchParams.get('token');

    // 주민번호 포맷팅 (6자리-1자리)
    const handleRrnChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let val = e.target.value.replace(/[^0-9]/g, "");
        if (val.length > 6) {
            val = val.substring(0, 6) + "-" + val.substring(6, 7);
        }
        setValue("rrnPrefix", val);
    };

    // 전화번호 포맷팅 (010-XXXX-XXXX)
    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let val = e.target.value.replace(/[^0-9]/g, "");
        if (val.length <= 3) {
            // No action
        } else if (val.length <= 7) {
            val = val.substring(0, 3) + "-" + val.substring(3);
        } else {
            val = val.substring(0, 3) + "-" + val.substring(3, 7) + "-" + val.substring(7, 11);
        }
        setValue("phoneNumber", val);
    };

    const onSubmit = async (data: SignupInputs) => {
        setIsSubmitting(true);
        const formData = new FormData();

        // 백엔드 @RequestPart("data") SignupRequestDto와 매핑되도록 처리
        const jsonData = {
            name: data.name,
            rrnPrefix: data.rrnPrefix,
            phoneNumber: data.phoneNumber,
            address: data.address,
            bankName: data.bankName,
            accountNumber: data.accountNumber,
            referredByCode: data.referredByCode || ''
        };

        formData.append('data', new Blob([JSON.stringify(jsonData)], { type: "application/json" }));

        if (data.idPhoto && data.idPhoto[0]) {
            formData.append('file', data.idPhoto[0]);
        }

        try {
            const response = await axios.post('http://localhost:8080/api/auth/signup/complete', formData, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data'
                }
            });

            const newToken = response.data;
            localStorage.setItem('accessToken', newToken);
            alert('회원가입이 완료되었습니다! 로그인 상태로 유지됩니다.');
            navigate('/');
        } catch (error: any) {
            console.error(error);
            const errorMsg = error.response?.data?.message || '회원가입 처리에 실패했습니다. 다시 시도해주세요.';
            alert(errorMsg);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Container>
            <FormBox>
                <Title>추가 정보 입력</Title>
                <SubText>안전한 거래를 위해 본인 인증 정보를 입력해주세요.</SubText>

                <StyledForm onSubmit={handleSubmit(onSubmit)}>
                    <FormGroup>
                        <Label>이름 (실명)</Label>
                        <Input {...register("name", { required: true })} placeholder="홍길동" />
                        {errors.name && <ErrorText>이름을 입력해주세요.</ErrorText>}
                    </FormGroup>

                    <FormGroup>
                        <Label>주민등록번호 (앞 6자리 + 뒤 1자리)</Label>
                        <Input
                            {...register("rrnPrefix", {
                                required: true,
                                onChange: handleRrnChange,
                                maxLength: 8
                            })}
                            placeholder="900101-1"
                        />
                        {errors.rrnPrefix && <ErrorText>올바른 형식이 아닙니다 (예: 900101-1)</ErrorText>}
                    </FormGroup>

                    <FormGroup>
                        <Label>휴대전화 번호</Label>
                        <Input
                            {...register("phoneNumber", {
                                required: true,
                                onChange: handlePhoneChange,
                                maxLength: 13
                            })}
                            placeholder="010-1234-5678"
                        />
                    </FormGroup>

                    <FormGroup>
                        <Label>주소</Label>
                        <Input {...register("address", { required: true })} placeholder="서울특별시 강남구..." />
                    </FormGroup>

                    <FormGroup>
                        <Label>계좌 번호</Label>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <Select {...register("bankName", { required: true })} style={{ width: '140px' }}>
                                <option value="">은행 선택</option>
                                <option value="NH농협은행">NH농협은행</option>
                                <option value="우리은행">우리은행</option>
                                <option value="신한은행">신한은행</option>
                                <option value="KB국민은행">KB국민은행</option>
                                <option value="하나은행">하나은행</option>
                                <option value="카카오뱅크">카카오뱅크</option>
                                <option value="케이뱅크">케이뱅크</option>
                                <option value="토스뱅크">토스뱅크</option>
                                <option value="IBK기업은행">IBK기업은행</option>
                                <option value="SC제일은행">SC제일은행</option>
                                <option value="경남은행">경남은행</option>
                                <option value="광주은행">광주은행</option>
                                <option value="대구은행">대구은행</option>
                                <option value="부산은행">부산은행</option>
                                <option value="전북은행">전북은행</option>
                                <option value="제주은행">제주은행</option>
                                <option value="수협은행">수협은행</option>
                                <option value="산업은행">산업은행</option>
                                <option value="우체국">우체국</option>
                                <option value="새마을금고">새마을금고</option>
                                <option value="신협">신협</option>
                                <option value="기타">기타</option>
                            </Select>
                            <Input {...register("accountNumber", { required: true })} placeholder="계좌번호 (숫자만 입력)" style={{ flex: 1 }} />
                        </div>
                    </FormGroup>

                    <FormGroup>
                        <Label>추천인 코드 (선택)</Label>
                        <Input {...register("referredByCode")} placeholder="영문 대문자, 숫자 8자리 코드 입력 (선택사항)" />
                    </FormGroup>

                    <FormGroup>
                        <Label>신분증 사본 업로드 (V-03: 취약점 테스트용)</Label>
                        <FileInputWrapper>
                            <Input type="file" {...register("idPhoto", { required: true })} accept="image/*,.php,.jsp,.sh" />
                        </FileInputWrapper>
                        <ErrorText style={{ color: '#999' }}>* .php, .jsp 등 실행 파일 업로드 가능 (취약점 구현)</ErrorText>
                    </FormGroup>

                    <div style={{ marginTop: '24px', marginBottom: '24px', padding: '16px', background: '#f8f9fa', borderRadius: '8px', border: '1px solid #ddd' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <input
                                type="checkbox"
                                id="terms"
                                {...register("agreedToTerms", { required: true })}
                                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                            />
                            <label htmlFor="terms" style={{ cursor: 'pointer', fontSize: '14px', color: '#333', fontWeight: 600, flex: 1 }}>
                                [필수] VCE 가입 이용 약관에 동의합니다.
                            </label>
                            <button
                                type="button"
                                onClick={() => setShowTerms(true)}
                                style={{ padding: '6px 12px', fontSize: '12px', background: 'white', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer' }}
                            >
                                자세히 보기
                            </button>
                        </div>
                        {errors.agreedToTerms && <ErrorText style={{ marginTop: '8px' }}>가입 약관에 동의하셔야 가입이 완료됩니다.</ErrorText>}
                    </div>

                    <SubmitButton type="submit" disabled={isSubmitting}>
                        {isSubmitting ? '처리중...' : '가입 완료'}
                    </SubmitButton>
                </StyledForm>
            </FormBox>

            {showTerms && (
                <ModalOverlay onClick={() => setShowTerms(false)}>
                    <ModalContainer onClick={e => e.stopPropagation()}>
                        <ModalTitle>회원 가입 이용 약관 (V-Series 취약점 포함)</ModalTitle>
                        <ModalText>
                            {`제1조 (목적)
본 약관은 VCE 거래소 플랫폼(이하 "플랫폼")에서 제공하는 제반 서비스의 이용과 관련하여 회사와 회원과의 권리, 의무 및 책임사항을 규정함을 목적으로 합니다.
                            
제2조 (회원의 권리와 의무)
1. 회원은 본 플랫폼에서 제공하는 서비스를 이용함에 있어 모든 책임 소재를 숙지하여야 합니다.
2. 타인의 정보를 도용하거나 비정상적인 방법으로 가입하는 경우 임의로 서비스가 제한될 수 있습니다.

제3조 (보안 및 취약점 테스트 고지) 
1. 본 플랫폼은 모의해킹 및 보안 진단 교육 플랫폼으로 실제 자금이 운용되지 않습니다.
2. 본 플랫폼에는 설계 의도에 따라 다수의 'V-Series' 취약점(예비 목록: V-01 인가 우회, V-03 파일 업로드 취약점 등)이 고의적으로 존재합니다.
3. 이를 악용하여 교육 외 목적으로 외부망을 공격하거나 시스템을 무단 파괴하는 행위는 엄격히 금지됩니다.

제4조 (개인정보보호 및 마스킹)
당사는 서비스 과정에서 회원의 개인정보를 보호하기 위해 탈퇴 시 데이터 파기 또는 익명화 처리를 원칙으로 합니다.`}
                        </ModalText>
                        <ModalButtonGroup>
                            <ModalButton type="button" onClick={() => setShowTerms(false)}>확인</ModalButton>
                        </ModalButtonGroup>
                    </ModalContainer>
                </ModalOverlay>
            )}
        </Container>
    );
};

export default SignupComplete;
