// app/predictions/page.tsx — Prediction Engine tuning (Pro tier)
import { PredictionsClient } from './predictions-client';
import { buildMetadata } from '@/lib/seo';

export const metadata = buildMetadata({
  title: 'AI Council Predictions',
  description:
    'A 5-model AI council calls S&P 500 regime, key levels and risks every weekday morning — with outcomes scored nightly against realized moves.',
  path: '/predictions/',
});

export default function PredictionsPage() {
  return <PredictionsClient />;
}
