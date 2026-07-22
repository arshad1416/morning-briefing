// app/models/page.tsx — Models / Trust page
import { ModelsClient } from './models-client';
import { buildMetadata } from '@/lib/seo';

export const metadata = buildMetadata({
  title: 'Prediction Engine — Backtests & Accuracy',
  description:
    'Full transparency on the AI council: backtest results, calibration, walk-forward validation and live simulated performance — every call scored nightly.',
  path: '/models/',
});

export default function ModelsPage() {
  return <ModelsClient />;
}
