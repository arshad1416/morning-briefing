// app/archive/page.tsx — Morning Briefing archive
import { ArchiveClient } from './archive-client';
import { buildMetadata } from '@/lib/seo';

export const metadata = buildMetadata({
  title: 'Briefing Archive — Daily Market Analysis',
  description:
    'Every MapleGamma morning briefing: S&P 500 regime calls, key levels, dealer gamma and macro analysis — archived daily.',
  path: '/archive/',
});

export default function ArchivePage() {
  return <ArchiveClient />;
}
