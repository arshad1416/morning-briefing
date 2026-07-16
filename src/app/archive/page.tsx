import type { Metadata } from 'next';
// app/archive/page.tsx — Morning Briefing archive
import { ArchiveClient } from './archive-client';


export const metadata: Metadata = {
  title: 'Briefing Archive — Daily Market Analysis',
  description:
    'Every MapleGamma morning briefing: S&P 500 regime calls, key levels, dealer gamma and macro analysis — archived daily.',
  alternates: { canonical: '/archive/' },
};

export default function ArchivePage() {
  return <ArchiveClient />;
}
