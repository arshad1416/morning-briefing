// app/research/page.tsx — Research reading room (Basic tier)
import { ResearchClient } from './research-client';
import { buildMetadata } from '@/lib/seo';

export const metadata = buildMetadata({
  title: 'Research Desk — News, Insider & Congress Trades',
  description:
    'Daily market narrative, live news wire, Reddit sentiment, SEC Form 4 insider trades and U.S. House congressional trades — one reading room.',
  path: '/research/',
});

export default function ResearchPage() {
  return <ResearchClient />;
}
