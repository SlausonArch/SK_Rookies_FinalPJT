import React from 'react';
import styled from 'styled-components';
import Header from '../components/Header';
import Footer from '../components/Footer';

const MainContainer = styled.div`
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: #f5f6f7; // Upbit background gray
`;

const ContentWrapper = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
  padding-top: 20px;
  flex: 1;
`;

const BannerSection = styled.div`
  display: flex;
  justify-content: space-between;
  margin-bottom: 20px;
`;

const MainText = styled.div`
  padding: 40px 0;
  h2 {
    font-size: 36px;
    font-weight: 300;
    color: #333;
    line-height: 1.4;
    strong {
      font-weight: 700;
      color: #093687;
    }
  }
`;

const CoinListSection = styled.div`
  background: white;
  border-radius: 4px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
  overflow: hidden;
`;

const CoinTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  
  th {
    background-color: #f9fafc;
    color: #666;
    font-size: 13px;
    padding: 12px;
    text-align: right;
    border-bottom: 1px solid #eee;
    
    &:first-child {
      text-align: left;
      padding-left: 20px;
    }
  }

  td {
    padding: 14px 12px;
    text-align: right;
    border-bottom: 1px solid #f4f4f4;
    font-size: 14px;
    color: #333;

    &:first-child {
      text-align: left;
      padding-left: 20px;
      font-weight: bold;
    }
  }

  tr:hover {
    background-color: #f8f9fa;
  }
`;

const ChangeParams = styled.span<{ rate: number }>`
  color: ${props => props.rate > 0 ? '#d60000' : props.rate < 0 ? '#0051c7' : '#333'};
`;

const Home: React.FC = () => {
    // Mock Data
    const coins = [
        { name: '비트코인', symbol: 'BTC/KRW', price: 104053000, rate: 1.17, volume: 11034 },
        { name: '이더리움', symbol: 'ETH/KRW', price: 3091000, rate: 0.65, volume: 12221 },
        { name: '리플', symbol: 'XRP/KRW', price: 2334, rate: 4.95, volume: 54325 },
        { name: '도지코인', symbol: 'DOGE/KRW', price: 169, rate: 3.68, volume: 5268 },
        { name: '솔라나', symbol: 'SOL/KRW', price: 145000, rate: -0.5, volume: 23100 },
    ];

    return (
        <MainContainer>
            <Header />
            <ContentWrapper>
                <BannerSection>
                    <MainText>
                        <h2>
                            대한민국<br />
                            <strong>가장 신뢰받는<br />디지털 자산 거래소</strong>
                        </h2>
                    </MainText>
                </BannerSection>

                <CoinListSection>
                    <CoinTable>
                        <thead>
                            <tr>
                                <th>코인명</th>
                                <th>현재가</th>
                                <th>전일대비</th>
                                <th>거래대금(백만)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {coins.map((coin) => (
                                <tr key={coin.symbol}>
                                    <td>
                                        {coin.name} <span style={{ fontSize: '11px', color: '#999' }}>{coin.symbol}</span>
                                    </td>
                                    <td>{coin.price.toLocaleString()}</td>
                                    <td>
                                        <ChangeParams rate={coin.rate}>
                                            {coin.rate > 0 ? '+' : ''}{coin.rate}%
                                        </ChangeParams>
                                    </td>
                                    <td>{coin.volume.toLocaleString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </CoinTable>
                </CoinListSection>
            </ContentWrapper>
            <Footer />
        </MainContainer>
    );
};

export default Home;
