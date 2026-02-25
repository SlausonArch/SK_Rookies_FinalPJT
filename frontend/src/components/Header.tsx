import React from 'react';
import styled from 'styled-components';
import { Link, useLocation } from 'react-router-dom';

// Header.tsx (스타일만 교체/추가)

const HeaderBar = styled.header`
  width: 100%;
  background: linear-gradient(180deg, #093687 0%, #082f77 100%);
  color: white;
  position: sticky;
  top: 0;
  z-index: 50;

  /* 헤더 분리감 */
  box-shadow: 0 8px 24px rgba(10, 24, 52, 0.18);
  border-bottom: 1px solid rgba(255,255,255,0.08);
`;

const HeaderInner = styled.div`
  max-width: clamp(960px, 80vw, 1200px);
  width: 100%;
  margin: 0 auto;
  padding: 0 20px;

  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 64px; /* 살짝 여유 */
`;

const Logo = styled.div`
  font-size: 22px;
  font-weight: 800;
  letter-spacing: 0.4px;
  a {
    color: #fff;
    text-decoration: none;
  }
`;

const Nav = styled.nav`
  display: flex;
  gap: 24px;
`;

const NavItem = styled(Link)`
  color: rgba(255,255,255,0.78);
  text-decoration: none;
  font-weight: 600;
  font-size: 14px;
  letter-spacing: -0.2px;
  position: relative;
  padding: 10px 0;

  transition: color 0.15s ease;

  &:hover {
    color: #fff;
  }

  /* 밑줄 애니메이션 (hover 시) */
  &::after {
    content: '';
    position: absolute;
    left: 0;
    bottom: 6px;
    width: 100%;
    height: 2px;
    background: rgba(255,255,255,0.9);
    transform: scaleX(0);
    transform-origin: left;
    transition: transform 0.2s ease;
    border-radius: 999px;
    opacity: 0.9;
  }

  &:hover::after {
    transform: scaleX(1);
  }
`;

const AuthButtons = styled.div`
  display: flex;
  gap: 14px;
  align-items: center;
`;

const AuthLink = styled(Link)`
  color: rgba(255,255,255,0.9);
  text-decoration: none;
  font-size: 13px;
  font-weight: 600;
  padding: 8px 10px;
  border-radius: 8px;

  transition: background 0.15s ease;

  &:hover {
    background: rgba(255,255,255,0.08);
  }
`;

const LogoutButton = styled.button`
  color: rgba(255,255,255,0.9);
  font-size: 13px;
  font-weight: 600;
  background: none;
  border: none;
  cursor: pointer;
  padding: 8px 10px;
  border-radius: 8px;

  transition: background 0.15s ease;

  &:hover {
    background: rgba(255,255,255,0.08);
  }
`;


const Header: React.FC = () => {
  const location = useLocation();
  const isLoggedIn = !!localStorage.getItem('accessToken');
  const redirectTarget = `${location.pathname}${location.search || ''}`;
  const loginUrl = `/login?redirect=${encodeURIComponent(redirectTarget)}`;

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    window.location.href = '/';
  };

  return (
    <HeaderBar>
      <HeaderInner>
        <Logo>
          <Link to="/crypto">VCE</Link>
        </Logo>

        <Nav>
          <NavItem to="/exchange">거래소</NavItem>
          <NavItem to="/balances">입출금</NavItem>
          <NavItem to="/investments">투자내역</NavItem>
          <NavItem to="/trends">코인동향</NavItem>
          <NavItem to="/community">커뮤니티</NavItem>
          <NavItem to="/events">이벤트</NavItem>
          <NavItem to="/support">고객센터</NavItem>
        </Nav>

        <AuthButtons>
          {isLoggedIn ? (
            <>
              <AuthLink to="/mypage">마이페이지</AuthLink>
              <LogoutButton onClick={handleLogout}>로그아웃</LogoutButton>
            </>
          ) : (
            <>
              <AuthLink to={loginUrl}>로그인</AuthLink>
              <AuthLink to="/signup">회원가입</AuthLink>
            </>
          )}
        </AuthButtons>
      </HeaderInner>
    </HeaderBar>
  );
};

export default Header;
