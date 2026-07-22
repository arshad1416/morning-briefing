import type { Metadata } from 'next';
// app/models/page.tsx — Models / Trust page
import { ModelsClient } from './models-client';


export const metadata: Metadata = {
  title: 'Prediction Engine — Backtests & Accuracy',
  description:
    'Full transparency on model performance: backtest results, calibration, walk-forward validation and live simulated performance — every call scored nightly, with no real money involved.',
  alternates: { canonical: '/models/' },
};

export default function ModelsPage() {
  return <ModelsClient />;
}
