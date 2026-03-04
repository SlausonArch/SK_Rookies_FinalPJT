import React from 'react';
import styled from 'styled-components';
import Header from '../components/Header';
import Footer from '../components/Footer';

const NOTICE_DATE = '2026-02-27';
const EFFECTIVE_DATE = '2026-02-27';
const VERSION = 'v1.0';

const Container = styled.div`
  min-height: 100vh;
  background: #f5f6f7;
  display: flex;
  flex-direction: column;
`;

const Main = styled.main`
  flex: 1;
  max-width: 980px;
  width: 100%;
  margin: 36px auto;
  padding: 0 20px;
`;

const Card = styled.article`
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06);
  padding: 32px;
`;

const Title = styled.h1`
  margin: 0 0 6px;
  color: #111827;
  font-size: 30px;
  font-weight: 800;
`;

const Meta = styled.div`
  color: #4b5563;
  font-size: 14px;
  margin-bottom: 26px;
`;

const Section = styled.section`
  margin-top: 30px;
`;

const SectionTitle = styled.h2`
  font-size: 20px;
  color: #111827;
  margin: 0 0 12px;
  font-weight: 700;
`;

const Paragraph = styled.p`
  margin: 0;
  color: #374151;
  font-size: 14px;
  line-height: 1.8;
`;

const List = styled.ul`
  margin: 8px 0 0;
  padding-left: 18px;
  color: #374151;
  font-size: 14px;
  line-height: 1.8;
`;

const TableWrap = styled.div`
  overflow-x: auto;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  min-width: 760px;
`;

const Thead = styled.thead`
  background: #f3f4f6;
`;

const Th = styled.th`
  text-align: left;
  padding: 12px;
  font-size: 13px;
  color: #111827;
  border-bottom: 1px solid #e5e7eb;
`;

const Td = styled.td`
  vertical-align: top;
  padding: 12px;
  font-size: 13px;
  line-height: 1.7;
  color: #374151;
  border-bottom: 1px solid #f1f5f9;
`;

const Divider = styled.hr`
  border: 0;
  border-top: 1px solid #e5e7eb;
  margin: 28px 0 0;
`;

const PrivacyPolicy: React.FC = () => {
  return (
    <Container>
      <Header />
      <Main>
        <Card>
          <Title>개인정보처리방침</Title>
          <Meta>
            버전: {VERSION} | 공고일자: {NOTICE_DATE} | 시행일자: {EFFECTIVE_DATE}
          </Meta>

          <Section>
            <SectionTitle>1. 총칙</SectionTitle>
            <Paragraph>
              VCE(이하 &quot;회사&quot;)는 개인정보보호법 제30조에 따라 정보주체의 개인정보를 보호하고 관련
              고충을 신속하고 원활하게 처리할 수 있도록 다음과 같이 개인정보처리방침을 수립·공개합니다.
            </Paragraph>
          </Section>

          <Section>
            <SectionTitle>2. 개인정보의 처리 목적, 항목, 보유 및 이용기간</SectionTitle>
            <TableWrap>
              <Table>
                <Thead>
                  <tr>
                    <Th>구분</Th>
                    <Th>처리 목적</Th>
                    <Th>수집 항목</Th>
                    <Th>보유 및 이용기간</Th>
                  </tr>
                </Thead>
                <tbody>
                  <tr>
                    <Td>회원가입 및 로그인</Td>
                    <Td>회원 식별, 로그인 인증, 계정 관리</Td>
                    <Td>
                      이메일, 비밀번호(일반 로그인), 이름, 소셜 로그인 제공 정보(이메일/닉네임/프로필 이미지 URL)
                    </Td>
                    <Td>회원 탈퇴 시까지 (관계 법령상 보존이 필요한 경우 해당 기간까지)</Td>
                  </tr>
                  <tr>
                    <Td>회원가입 완료(KYC)</Td>
                    <Td>본인 확인, 계정 보안, 입출금 계좌 등록</Td>
                    <Td>
                      이름(실명), 주민등록번호 앞 6자리+뒤 1자리, 휴대전화번호, 주소, 은행명, 계좌번호, 예금주명, 신분증
                      이미지
                    </Td>
                    <Td>회원 탈퇴 시까지 (관계 법령상 보존이 필요한 경우 해당 기간까지)</Td>
                  </tr>
                  <tr>
                    <Td>거래/지갑 서비스 이용</Td>
                    <Td>주문·체결 처리, 입출금 처리, 거래 내역 제공, 부정거래 방지</Td>
                    <Td>
                      주문/거래 정보(자산종류, 수량, 가격, 수수료, 상태, 일시), 지갑주소, 송·수신 주소, 거래해시, 입출금
                      계좌정보(은행명/계좌번호)
                    </Td>
                    <Td>전자금융거래법 등 관계 법령에 따른 보존기간 종료 시까지</Td>
                  </tr>
                  <tr>
                    <Td>고객지원/커뮤니티</Td>
                    <Td>문의 대응, 민원 처리, 게시글/댓글 운영</Td>
                    <Td>문의 제목/내용/첨부파일, 게시글/댓글 내용 및 첨부파일</Td>
                    <Td>처리 목적 달성 시까지 또는 관계 법령에 따른 보존기간 종료 시까지</Td>
                  </tr>
                  <tr>
                    <Td>서비스 이용 과정 자동 생성 정보</Td>
                    <Td>서비스 보안, 접속 관리, 장애 대응</Td>
                    <Td>접속 로그, 서비스 이용기록, 기기/브라우저 정보, IP 주소, 토큰 식별 정보</Td>
                    <Td>통신비밀보호법 등 관계 법령에 따른 보존기간 종료 시까지</Td>
                  </tr>
                </tbody>
              </Table>
            </TableWrap>
          </Section>

          <Section>
            <SectionTitle>3. 관계 법령에 따른 개인정보 보존 기준</SectionTitle>
            <List>
              <li>전자상거래 등에서의 소비자보호에 관한 법률: 계약 또는 청약철회 기록 5년, 대금결제 및 재화 공급 기록 5년, 소비자 불만 또는 분쟁처리 기록 3년, 표시·광고 기록 6개월</li>
              <li>전자금융거래법: 전자금융거래 기록 5년(관련 법령에서 정한 항목)</li>
              <li>통신비밀보호법: 서비스 접속기록(로그기록 등) 관계 법령상 보존기간</li>
            </List>
          </Section>

          <Section>
            <SectionTitle>4. 개인정보의 제3자 제공</SectionTitle>
            <Paragraph>
              회사는 정보주체의 개인정보를 제2조에서 명시한 범위를 초과하여 이용하거나 외부에 제공하지 않습니다.
              다만, 정보주체의 별도 동의가 있거나 법령에 특별한 규정이 있는 경우에는 예외로 합니다.
            </Paragraph>
          </Section>

          <Section>
            <SectionTitle>5. 개인정보 처리의 위탁</SectionTitle>
            <Paragraph>
              회사는 원활한 서비스 제공을 위해 필요한 경우 개인정보 처리업무를 외부에 위탁할 수 있으며, 위탁 시
              개인정보보호법 제26조에 따라 수탁자에 대한 관리·감독을 수행합니다.
            </Paragraph>
            <List>
              <li>현재 공개 기준: 등록된 개인정보 처리 위탁 내역 없음</li>
              <li>위탁 내역이 발생하거나 변경되는 경우 본 방침에 지체 없이 반영합니다.</li>
            </List>
          </Section>

          <Section>
            <SectionTitle>6. 정보주체의 권리·의무 및 행사 방법</SectionTitle>
            <List>
              <li>정보주체는 회사에 대해 개인정보 열람, 정정·삭제, 처리정지, 동의 철회를 요구할 수 있습니다.</li>
              <li>권리 행사는 고객센터 또는 개인정보 보호책임자 연락처를 통해 서면, 전자우편 등으로 요청할 수 있습니다.</li>
              <li>회사는 관련 법령에서 정한 기간 내에 조치하며, 정당한 사유가 있는 경우 그 사유를 안내합니다.</li>
            </List>
          </Section>

          <Section>
            <SectionTitle>7. 개인정보 파기 절차 및 방법</SectionTitle>
            <List>
              <li>파기 사유 발생 시(보유기간 경과, 처리 목적 달성 등) 지체 없이 파기합니다.</li>
              <li>전자적 파일: 복구가 불가능한 기술적 방법으로 영구 삭제</li>
              <li>종이 문서: 분쇄 또는 소각</li>
            </List>
          </Section>

          <Section>
            <SectionTitle>8. 개인정보의 안전성 확보조치</SectionTitle>
            <List>
              <li>개인정보 접근권한 최소화 및 접근통제</li>
              <li>비밀번호 암호화 저장 등 인증정보 보호조치</li>
              <li>접속기록 보관 및 보안 점검</li>
              <li>개인정보 처리 시스템에 대한 기술적·관리적 보호조치 운영</li>
            </List>
          </Section>

          <Section>
            <SectionTitle>9. 자동 수집 장치의 설치·운영 및 거부</SectionTitle>
            <Paragraph>
              회사는 이용자 인증을 위해 브라우저 로컬 저장소(Local Storage) 등에 토큰 정보를 저장할 수 있습니다.
              이용자는 브라우저 설정에서 저장 정보를 삭제하거나 제한할 수 있습니다. 단, 저장 정보 삭제 시 일부 서비스
              이용이 제한될 수 있습니다.
            </Paragraph>
          </Section>

          <Section>
            <SectionTitle>10. 개인정보 보호책임자</SectionTitle>
            <Paragraph>
              회사는 개인정보 처리에 관한 업무를 총괄하고, 개인정보 처리와 관련한 정보주체의 불만처리 및 피해구제를 위해
              아래와 같이 개인정보 보호책임자를 지정하고 있습니다.
            </Paragraph>
            <List>
              <li>개인정보 보호책임자: [담당자명 또는 직책 입력 필요]</li>
              <li>연락처: 1588-XXXX</li>
              <li>이메일: privacy@vce.example</li>
            </List>
          </Section>

          <Section>
            <SectionTitle>11. 권익침해 구제방법</SectionTitle>
            <List>
              <li>개인정보침해신고센터(privacy.go.kr / 국번없이 118)</li>
              <li>개인정보분쟁조정위원회(kopico.go.kr / 1833-6972)</li>
              <li>대검찰청 사이버수사과(spo.go.kr / 국번없이 1301)</li>
              <li>경찰청 사이버범죄 신고시스템(ecrm.police.go.kr / 국번없이 182)</li>
            </List>
          </Section>

          <Section>
            <SectionTitle>12. 개인정보처리방침 변경</SectionTitle>
            <Paragraph>
              본 개인정보처리방침의 내용 추가, 삭제 및 수정이 있는 경우 시행일 최소 7일 전(중요 변경은 30일 전)부터
              서비스 공지사항 또는 별도 화면을 통해 안내합니다.
            </Paragraph>
            <List>
              <li>{VERSION} (공고일 {NOTICE_DATE}, 시행일 {EFFECTIVE_DATE}) 최초 제정</li>
            </List>
          </Section>

          <Divider />
          <Section>
            <Paragraph>
              본 방침은 현재 서비스 구현 기준으로 작성되었습니다. 운영 환경(수탁사, 보관 인프라, 담당자 정보) 확정 시
              해당 항목을 즉시 업데이트해야 합니다.
            </Paragraph>
          </Section>
        </Card>
      </Main>
      <Footer />
    </Container>
  );
};

export default PrivacyPolicy;
