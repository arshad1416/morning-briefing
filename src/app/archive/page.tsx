// app/archive/page.tsx — Morning Briefing archive
import { ArchiveClient } from './archive-client';
import { narrativeRepeats } from './corpus';
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
  // 51 of the 76 archived briefings only repeat an earlier date's note — one of
  // them 48 files deep — and the cards here previewed and expanded every copy
  // as that morning's reading. The rule that decides this reads the whole
  // corpus off disk and so lives in ./corpus.ts, shared with the per-date
  // pages; ArchiveClient fetches the same JSON in the browser and cannot run
  // it. Resolved once here, at build time, rather than written a second time.
  return <ArchiveClient repeats={narrativeRepeats()} />;
}
