import { redirect } from 'next/navigation'

export default function RootPage() {
  const mode = process.env.NEXT_PUBLIC_APP_MODE || 'exchange'
  if (mode === 'bank') {
    redirect('/bank')
  }
  redirect('/crypto')
}
