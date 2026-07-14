// app/signup/page.tsx — Create account
import type { Metadata } from 'next';
import { SignupClient } from './signup-client';

export const metadata: Metadata = {
  title: 'Create account — MapleGamma',
  robots: { index: false },
};

export default function SignupPage() {
  return <SignupClient />;
}
