// app/login/page.tsx — Sign in
import type { Metadata } from 'next';
import { LoginClient } from './login-client';

export const metadata: Metadata = {
  title: 'Sign in — MapleGamma',
  robots: { index: false },
};

export default function LoginPage() {
  return <LoginClient />;
}
