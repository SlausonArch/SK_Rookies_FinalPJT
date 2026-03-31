'use client'

import React from 'react';
import styled from 'styled-components';
import Link from 'next/link';
import { APP_MODE, getExchangeFrontendUrl } from '@/config/publicEnv';

const FooterContainer = styled.footer`
  background-color: white;
  padding: 40px 20px;
  border-top: 1px solid #e1e1e1;
  color: #666;
  font-size: 12px;
  margin-top: auto;
`;

const FooterContent = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
`;

const Info = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const Copy = styled.div`
  margin-top: 20px;
  color: #999;
`;

const PolicyLinks = styled.div`
  display: flex;
  gap: 12px;

  a {
    color: #4b5563;
    text-decoration: none;
    font-weight: 600;
  }

  a:hover {
    text-decoration: underline;
  }
`;

const Footer: React.FC = () => {
  const mode = APP_MODE;
  const exchangeUrl = mode === 'bank' ? getExchangeFrontendUrl() : '';
  return (
    <FooterContainer>
      <FooterContent>
        <Info>
          <strong>VCE (Vulnerability Crypto Exchange)</strong>
          <span>SK Rookies Final Project</span>
          <span>Designed for Security Research & Education</span>
          <PolicyLinks>
            {mode === 'bank' ? (
              <a href={`${exchangeUrl}/privacy-policy`}>개인정보처리방침</a>
            ) : (
              <Link href="/privacy-policy">개인정보처리방침</Link>
            )}
          </PolicyLinks>
          <Copy>Copyright © 2026 VCE. All rights reserved.</Copy>
        </Info>
        <Info>
          <strong>고객센터</strong>
          <span>1588-XXXX</span>
          <span>평일 09:00 - 18:00</span>
        </Info>
      </FooterContent>
    </FooterContainer>
  );
};

export default Footer;
