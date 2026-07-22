// app/archive/page.tsx — Morning Briefing archive
import { ArchiveClient } from './archive-client';
import { buildMetadata } from '@/lib/seo';

// "Key levels" and "dealer gamma" were promised here but do not exist in
// data/archive/*.json — those numbers live only in the live options feed. The
// description now lists what an archived briefing actually contains, and says
// up front that the analysis follows a simulated practice portfolio.
export const metadata = buildMetadata({
  title: 'Briefing Archive — Daily Market Analysis',
  description:
    'Every MapleGamma morning briefing, archived daily: where the major indexes finished, the VIX fear gauge, what the Fed and the Bank of Canada said, and simulated (paper-trading) analysis.',
  path: '/archive/',
});

export default function ArchivePage() {
  return <ArchiveClient />;
}
