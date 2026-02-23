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

interface SignupInputs {
    name: string;
    rrnPrefix: string;
    phoneNumber: string;
    address: string;
    accountNumber: string;
    referredByCode: string; // 추천인 코드 추가
    idPhoto: FileList;
}

const SignupComplete: React.FC = () => {
    const { register, handleSubmit, setValue, formState: { errors } } = useForm<SignupInputs>();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [isSubmitting, setIsSubmitting] = useState(false);

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
                        <Input {...register("accountNumber", { required: true })} placeholder="은행명 / 계좌번호" />
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

                    <SubmitButton type="submit" disabled={isSubmitting}>
                        {isSubmitting ? '처리중...' : '가입 완료'}
                    </SubmitButton>
                </StyledForm>
            </FormBox>
        </Container>
    );
};

export default SignupComplete;
