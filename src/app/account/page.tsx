// app/account/page.tsx — Account & subscription
import type { Metadata } from 'next';
import { AccountClient } from './account-client';

export const metadata: Metadata = {
  title: 'Account — MapleGamma',
  robots: { index: false },
};

export default function AccountPage() {
  return <AccountClient />;
}
