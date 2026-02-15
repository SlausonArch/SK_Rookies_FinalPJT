import React from 'react';
import styled from 'styled-components';
import { Link } from 'react-router-dom';

const HeaderContainer = styled.header`
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 60px;
  padding: 0 20px;
  background-color: #093687; // Upbit dark blue-ish header
  color: white;
`;

const Logo = styled.div`
  font-size: 24px;
  font-weight: bold;
  color: white;
  a {
    color: white;
    text-decoration: none;
  }
`;

const Nav = styled.nav`
  display: flex;
  gap: 30px;
`;

const NavItem = styled(Link)`
  color: #a7bce3;
  text-decoration: none;
  font-weight: 500;
  &:hover {
    color: white;
  }
`;

const AuthButtons = styled.div`
  display: flex;
  gap: 15px;
`;

const AuthLink = styled(Link)`
  color: white;
  text-decoration: none;
  font-size: 14px;
  &:hover {
    text-decoration: underline;
  }
`;

const Header: React.FC = () => {
    const isLoggedIn = !!localStorage.getItem('accessToken');

    const handleLogout = () => {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/';
    };

    return (
        <HeaderContainer>
            <Logo>
                <Link to="/">VCE</Link>
            </Logo>
            <Nav>
                <NavItem to="/exchange">거래소</NavItem>
                <NavItem to="/balances">입출금</NavItem>
                <NavItem to="/investments">투자내역</NavItem>
                <NavItem to="/trends">코인동향</NavItem>
                <NavItem to="/community">커뮤니티</NavItem>
            </Nav>
            <AuthButtons>
                {isLoggedIn ? (
                    <>
                        <AuthLink to="/mypage">마이페이지</AuthLink>
                        <AuthLink as="button" onClick={handleLogout} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                            로그아웃
                        </AuthLink>
                    </>
                ) : (
                    <>
                        <AuthLink to="/login">로그인</AuthLink>
                        <AuthLink to="/signup">회원가입</AuthLink>
                    </>
                )}
            </AuthButtons>
        </HeaderContainer>
    );
};

export default Header;
