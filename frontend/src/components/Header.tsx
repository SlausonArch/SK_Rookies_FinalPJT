'use client'

import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import axios from 'axios';
import { clearUserSession, getUserAccessToken, getUserRefreshToken } from '../utils/auth';

// Header.tsx (스타일만 교체/추가)

const HeaderBar = styled.header`
width: 100%;
background: linear-gradient(180deg, #093687 0%, #082f77 100%);
color: white;
position: sticky;
top: 0;
z-index: 50;

  box-shadow: 0 8px 24px rgba(10, 24, 52, 0.18);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
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
  color: rgba(255, 255, 255, 0.78);
  text-decoration: none;
  font-weight: 600;
  font-size: 14px;
  letter-spacing: -0.2px;
  position: relative;
  padding: 10px 0;

  transition: color 0.15s ease;

  &:hover, &.active {
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
    background: rgba(255, 255, 255, 0.9);
    transform: scaleX(0);
    transform-origin: left;
    transition: transform 0.2s ease;
    border-radius: 999px;
    opacity: 0.9;
  }

  &:hover::after, &.active::after {
    transform: scaleX(1);
  }
`;

const ExternalNavItem = styled.a`
  color: rgba(255, 255, 255, 0.78);
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

  &::after {
    content: '';
    position: absolute;
    left: 0;
    bottom: 6px;
    width: 100%;
    height: 2px;
    background: rgba(255, 255, 255, 0.9);
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

const ExternalAuthLink = styled.a`
  color: rgba(255, 255, 255, 0.9);
  text-decoration: none;
  font-size: 13px;
  font-weight: 600;
  padding: 8px 10px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.1);
  transition: background 0.15s ease, color 0.15s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.2);
    color: #fff;
  }
`;

const AuthLink = styled(Link)`
  color: rgba(255, 255, 255, 0.9);
  text-decoration: none;
  font-size: 13px;
  font-weight: 600;
  padding: 8px 10px;
  border-radius: 8px;
  transition: background 0.15s ease;

  &:hover {
  background: rgba(255, 255, 255, 0.08);
}
`;

const LogoutButton = styled.button`
  color: rgba(255, 255, 255, 0.9);
  font-size: 13px;
  font-weight: 600;
  background: none;
  border: none;
  cursor: pointer;
  padding: 8px 10px;
  border-radius: 8px;

  transition: background 0.15s ease;

  &:hover {
  background: rgba(255, 255, 255, 0.08);
}
`;


const Header: React.FC = () => {
  const pathname = usePathname();
  const mode = process.env.NEXT_PUBLIC_APP_MODE || 'exchange';
  const exchangeUrl = process.env.NEXT_PUBLIC_EXCHANGE_FRONTEND_URL || 'http://localhost:15173';
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:18080';
  const [isLoggedIn, setIsLoggedIn] = useState(!!getUserAccessToken());

  useEffect(() => {
    const checkAuth = () => {
      setIsLoggedIn(!!getUserAccessToken());
    };

    window.addEventListener('storage', checkAuth);
    const interval = setInterval(checkAuth, 1000);

    return () => {
      window.removeEventListener('storage', checkAuth);
      clearInterval(interval);
    };
  }, []);

  const loginUrl = `/login?redirect=${encodeURIComponent(pathname)}`;

  const handleLogout = async () => {
    const token = getUserAccessToken();
    const refreshToken = getUserRefreshToken();

    if (token) {
      try {
        await axios.post(
          `${API_BASE}/api/auth/logout`,
          { refreshToken },
          { headers: { Authorization: `Bearer ${token}` } },
        );
      } catch {
        // Clear the client session even if server-side logout fails.
      }
    }

    clearUserSession(true);
    window.location.href = '/';
  };

  return (
    <HeaderBar>
      <HeaderInner>
        <Logo>
          {mode === 'bank' ? (
            <a href={`${exchangeUrl}/crypto`} style={{ color: '#fff', textDecoration: 'none' }}>VCE</a>
          ) : (
            <Link href="/crypto">VCE</Link>
          )}
        </Logo>

        <Nav>
          {mode === 'bank' ? (
            <>
              <ExternalNavItem href={`${exchangeUrl}/exchange`}>거래소</ExternalNavItem>
              <ExternalNavItem href={`${exchangeUrl}/balances`}>입출금</ExternalNavItem>
              <ExternalNavItem href={`${exchangeUrl}/investments`}>투자내역</ExternalNavItem>
              <ExternalNavItem href={`${exchangeUrl}/trends`}>코인동향</ExternalNavItem>
              <ExternalNavItem href={`${exchangeUrl}/community`}>커뮤니티</ExternalNavItem>
              <ExternalNavItem href={`${exchangeUrl}/events`}>이벤트</ExternalNavItem>
              <ExternalNavItem href={`${exchangeUrl}/support`}>고객센터</ExternalNavItem>
            </>
          ) : (
            <>
              <NavItem href="/exchange" className={pathname.startsWith('/exchange') ? 'active' : ''}>거래소</NavItem>
              <NavItem href="/balances" className={pathname.startsWith('/balances') ? 'active' : ''}>입출금</NavItem>
              <NavItem href="/investments" className={pathname.startsWith('/investments') ? 'active' : ''}>투자내역</NavItem>
              <NavItem href="/trends" className={pathname.startsWith('/trends') ? 'active' : ''}>코인동향</NavItem>
              <NavItem href="/community" className={pathname.startsWith('/community') ? 'active' : ''}>커뮤니티</NavItem>
              <NavItem href="/events" className={pathname.startsWith('/events') ? 'active' : ''}>이벤트</NavItem>
              <NavItem href="/support" className={pathname.startsWith('/support') ? 'active' : ''}>고객센터</NavItem>
            </>
          )}
        </Nav>

        <AuthButtons>
          {isLoggedIn ? (
            <>
              {mode === 'bank' ? (
                <ExternalAuthLink href={`${exchangeUrl}/mypage`}>마이페이지</ExternalAuthLink>
              ) : (
                <AuthLink href="/mypage">마이페이지</AuthLink>
              )}
              <LogoutButton onClick={handleLogout}>로그아웃</LogoutButton>
            </>
          ) : (
            <>
              <AuthLink href={loginUrl}>로그인</AuthLink>
              <AuthLink href="/signup">회원가입</AuthLink>
            </>
          )}
        </AuthButtons>
      </HeaderInner >
    </HeaderBar >
  );
};

export default Header;
