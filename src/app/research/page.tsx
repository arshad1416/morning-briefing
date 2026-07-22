// app/research/page.tsx — Research reading room (Basic tier)
import { ResearchClient } from './research-client';
import { buildMetadata } from '@/lib/seo';

export const metadata = buildMetadata({
  title: 'Research Desk — News, Insider & Congress Trades',
  description:
    'The day’s market write-up, the news, what Reddit is saying, share dealings company insiders reported to the SEC, and stock trades disclosed by U.S. House members — all in one place.',
  path: '/research/',
});

export default function ResearchPage() {
  return <ResearchClient />;
}
