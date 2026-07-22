import type { Metadata } from 'next';
// app/research/page.tsx — Research reading room (Basic tier)
import { ResearchClient } from './research-client';


export const metadata: Metadata = {
  title: 'Research Desk — News, Insider & Congress Trades',
  description:
    'The day’s market write-up, the news, what Reddit is saying, share dealings company insiders reported to the SEC, and stock trades disclosed by U.S. House members — all in one place.',
  alternates: { canonical: '/research/' },
};

export default function ResearchPage() {
  return <ResearchClient />;
}
