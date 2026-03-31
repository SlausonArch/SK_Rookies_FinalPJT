import type { Metadata } from 'next'
import { Providers } from './providers'
import '../index.css'

export const metadata: Metadata = {
  title: 'VCE - 가장 신뢰 받는 거래소',
  description: 'Vulnerable Crypto Exchange Platform',
  icons: {
    icon: '/vce-logo.svg',
    shortcut: '/vce-logo.svg',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
