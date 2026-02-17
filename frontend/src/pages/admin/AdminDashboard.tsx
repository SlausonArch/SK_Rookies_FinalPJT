import { useState, useEffect } from 'react';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';

const Container = styled.div`
  display: flex;
  height: 100vh;
  background: #0f0f0f;
`;

const Sidebar = styled.div`
  width: 260px;
  background: linear-gradient(180deg, #1a1a1a 0%, #0a0a0a 100%);
  border-right: 1px solid #2a2a2a;
  display: flex;
  flex-direction: column;
`;

const Logo = styled.div`
  padding: 24px;
  font-size: 24px;
  font-weight: 700;
  color: #fff;
  border-bottom: 1px solid #2a2a2a;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const Nav = styled.nav`
  flex: 1;
  padding: 16px 0;
  overflow-y: auto;
`;

const NavSection = styled.div`
  margin-bottom: 24px;
`;

const NavTitle = styled.div`
  padding: 8px 24px;
  font-size: 11px;
  font-weight: 600;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const NavItem = styled.div<{ active?: boolean }>`
  padding: 12px 24px;
  color: ${props => props.active ? '#fff' : '#999'};
  background: ${props => props.active ? 'rgba(9, 54, 135, 0.15)' : 'transparent'};
  border-left: 3px solid ${props => props.active ? '#093687' : 'transparent'};
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 14px;
  font-weight: ${props => props.active ? '600' : '400'};
  transition: all 0.2s;

  &:hover {
    background: rgba(9, 54, 135, 0.1);
    color: #fff;
  }
`;

const UserInfo = styled.div`
  padding: 20px 24px;
  border-top: 1px solid #2a2a2a;
  display: flex;
  align-items: center;
  gap: 12px;
`;

const Avatar = styled.div`
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: linear-gradient(135deg, #093687 0%, #0a4099 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-weight: 700;
  font-size: 14px;
`;

const UserDetails = styled.div`
  flex: 1;
`;

const UserName = styled.div`
  color: #fff;
  font-size: 14px;
  font-weight: 600;
`;

const UserRole = styled.div`
  color: #666;
  font-size: 12px;
`;

const LogoutBtn = styled.button`
  padding: 6px 12px;
  background: transparent;
  border: 1px solid #2a2a2a;
  color: #999;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: #1a1a1a;
    color: #fff;
    border-color: #444;
  }
`;

const Content = styled.div`
  flex: 1;
  overflow-y: auto;
  background: #0f0f0f;
`;

const Header = styled.div`
  padding: 24px 32px;
  background: #1a1a1a;
  border-bottom: 1px solid #2a2a2a;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const PageTitle = styled.h1`
  font-size: 28px;
  margin: 0;
  color: #fff;
  font-weight: 700;
`;

const HeaderActions = styled.div`
  display: flex;
  gap: 12px;
`;

const ActionButton = styled.button`
  padding: 10px 20px;
  background: #093687;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: #0a4099;
  }
`;

const Main = styled.div`
  padding: 32px;
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
  margin-bottom: 32px;
`;

const StatCard = styled.div`
  background: linear-gradient(135deg, #1a1a1a 0%, #141414 100%);
  border: 1px solid #2a2a2a;
  border-radius: 12px;
  padding: 24px;
  transition: all 0.3s;

  &:hover {
    border-color: #093687;
    transform: translateY(-2px);
  }
`;

const StatLabel = styled.div`
  font-size: 13px;
  color: #999;
  margin-bottom: 8px;
  font-weight: 500;
`;

const StatValue = styled.div`
  font-size: 32px;
  color: #fff;
  font-weight: 700;
  margin-bottom: 4px;
`;

const StatChange = styled.div<{ positive?: boolean }>`
  font-size: 13px;
  color: ${props => props.positive ? '#22c55e' : '#ef4444'};
  font-weight: 600;
`;

const Card = styled.div`
  background: #1a1a1a;
  border: 1px solid #2a2a2a;
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 24px;
`;

const CardTitle = styled.h2`
  font-size: 18px;
  color: #fff;
  margin: 0 0 20px 0;
  font-weight: 600;
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 60px 20px;
  color: #666;
`;

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [activeMenu, setActiveMenu] = useState('dashboard');
  const userName = localStorage.getItem('name') || '관리자';

  // 로그인 상태 확인
  useEffect(() => {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('role');

    if (!token || role !== 'ADMIN') {
      navigate('/admin/login', { replace: true });
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.clear();
    navigate('/admin/login', { replace: true });
  };

  const renderContent = () => {
    switch (activeMenu) {
      case 'dashboard':
        return (
          <>
            <StatsGrid>
              <StatCard>
                <StatLabel>총 회원 수</StatLabel>
                <StatValue>1,234</StatValue>
                <StatChange positive>+12% 이번 달</StatChange>
              </StatCard>
              <StatCard>
                <StatLabel>일일 거래량</StatLabel>
                <StatValue>₩24.5M</StatValue>
                <StatChange positive>+8.3%</StatChange>
              </StatCard>
              <StatCard>
                <StatLabel>활성 주문</StatLabel>
                <StatValue>89</StatValue>
                <StatChange>-2.1%</StatChange>
              </StatCard>
              <StatCard>
                <StatLabel>보유 자산</StatLabel>
                <StatValue>₩1.2B</StatValue>
                <StatChange positive>+15.7%</StatChange>
              </StatCard>
            </StatsGrid>
            <Card>
              <CardTitle>최근 활동</CardTitle>
              <EmptyState>최근 활동 내역이 여기에 표시됩니다.</EmptyState>
            </Card>
          </>
        );
      case 'members':
        return (
          <Card>
            <CardTitle>회원 관리</CardTitle>
            <EmptyState>회원 목록 및 관리 기능이 여기에 추가됩니다.</EmptyState>
          </Card>
        );
      case 'orders':
        return (
          <Card>
            <CardTitle>거래 내역</CardTitle>
            <EmptyState>거래 내역 조회 기능이 여기에 추가됩니다.</EmptyState>
          </Card>
        );
      case 'assets':
        return (
          <Card>
            <CardTitle>자산 관리</CardTitle>
            <EmptyState>전체 자산 현황이 여기에 표시됩니다.</EmptyState>
          </Card>
        );
      case 'deposits':
        return (
          <Card>
            <CardTitle>입출금 관리</CardTitle>
            <EmptyState>입출금 내역 및 승인 대기 목록이 여기에 표시됩니다.</EmptyState>
          </Card>
        );
      case 'community':
        return (
          <Card>
            <CardTitle>커뮤니티 관리</CardTitle>
            <EmptyState>게시글 및 댓글 관리 기능이 여기에 추가됩니다.</EmptyState>
          </Card>
        );
      case 'settings':
        return (
          <Card>
            <CardTitle>시스템 설정</CardTitle>
            <EmptyState>시스템 설정 옵션이 여기에 추가됩니다.</EmptyState>
          </Card>
        );
      default:
        return null;
    }
  };

  return (
    <Container>
      <Sidebar>
        <Logo>
          🔒 VCE Admin
        </Logo>
        <Nav>
          <NavSection>
            <NavTitle>메인</NavTitle>
            <NavItem active={activeMenu === 'dashboard'} onClick={() => setActiveMenu('dashboard')}>
              📊 대시보드
            </NavItem>
          </NavSection>
          <NavSection>
            <NavTitle>거래소 관리</NavTitle>
            <NavItem active={activeMenu === 'members'} onClick={() => setActiveMenu('members')}>
              👥 회원 관리
            </NavItem>
            <NavItem active={activeMenu === 'orders'} onClick={() => setActiveMenu('orders')}>
              📈 거래 내역
            </NavItem>
            <NavItem active={activeMenu === 'assets'} onClick={() => setActiveMenu('assets')}>
              💰 자산 관리
            </NavItem>
            <NavItem active={activeMenu === 'deposits'} onClick={() => setActiveMenu('deposits')}>
              💳 입출금 관리
            </NavItem>
          </NavSection>
          <NavSection>
            <NavTitle>콘텐츠</NavTitle>
            <NavItem active={activeMenu === 'community'} onClick={() => setActiveMenu('community')}>
              💬 커뮤니티 관리
            </NavItem>
          </NavSection>
          <NavSection>
            <NavTitle>시스템</NavTitle>
            <NavItem active={activeMenu === 'settings'} onClick={() => setActiveMenu('settings')}>
              ⚙️ 설정
            </NavItem>
          </NavSection>
        </Nav>
        <UserInfo>
          <Avatar>{userName[0]}</Avatar>
          <UserDetails>
            <UserName>{userName}</UserName>
            <UserRole>시스템 관리자</UserRole>
          </UserDetails>
          <LogoutBtn onClick={handleLogout}>로그아웃</LogoutBtn>
        </UserInfo>
      </Sidebar>
      <Content>
        <Header>
          <PageTitle>
            {activeMenu === 'dashboard' && '대시보드'}
            {activeMenu === 'members' && '회원 관리'}
            {activeMenu === 'orders' && '거래 내역'}
            {activeMenu === 'assets' && '자산 관리'}
            {activeMenu === 'deposits' && '입출금 관리'}
            {activeMenu === 'community' && '커뮤니티 관리'}
            {activeMenu === 'settings' && '시스템 설정'}
          </PageTitle>
          <HeaderActions>
            <ActionButton>새로고침</ActionButton>
          </HeaderActions>
        </Header>
        <Main>
          {renderContent()}
        </Main>
      </Content>
    </Container>
  );
};

export default AdminDashboard;
