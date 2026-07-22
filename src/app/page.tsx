// app/page.tsx — Landing page (default route)
import MapleGammaLanding from '@/components/landing/LandingPage';

// Product + FAQ structured data. Deliberately on the landing page only, NOT in
// layout.tsx — putting it in the layout would duplicate product/FAQ markup on
// every route. Pricing mirrors the live pricing section — keep in sync if
// tiers change.
const APP_LD = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'MapleGamma',
  applicationCategory: 'FinanceApplication',
  operatingSystem: 'Web',
  url: 'https://maplegamma.com',
  description:
    'Institutional-grade gamma exposure, options flow, and AI market conviction — GEX, DEX, and VEX in one terminal. Simulated (paper-trading) results for educational purposes only.',
  offers: [
    { '@type': 'Offer', name: 'Free', price: '0', priceCurrency: 'CAD' },
    { '@type': 'Offer', name: 'Basic', price: '49', priceCurrency: 'CAD' },
    { '@type': 'Offer', name: 'Pro', price: '99', priceCurrency: 'CAD' },
  ],
};

const FAQ_LD = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'What is gamma exposure (GEX)?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Gamma exposure (GEX) estimates how much market makers must hedge as the underlying moves. When dealers are long gamma they trade against price moves (dampening volatility); when short gamma their hedging amplifies moves. MapleGamma computes GEX, DEX and VEX by strike from option open interest, plus the zero-gamma flip level and max pain.',
      },
    },
    {
      '@type': 'Question',
      name: 'What is the zero-gamma flip level?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'The flip level is the underlying price where net dealer gamma crosses zero. Above it, dealer hedging tends to stabilize price; below it, hedging tends to accelerate moves. MapleGamma recomputes the exact flip level daily from SPX option chains.',
      },
    },
    {
      '@type': 'Question',
      name: 'How does the AI council work?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Five AI models with different mandates (risk-contrarian, quantitative/GEX, momentum, trade-selector, fundamental) independently analyze the market every weekday morning. An aggregator synthesizes their views into an S&P 500 regime call with key levels and risks. Every call is scored nightly against the realized market, and the results are published.',
      },
    },
    {
      '@type': 'Question',
      name: 'Is MapleGamma financial advice?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'No. MapleGamma provides general market information and simulated (paper-trading) results for educational purposes only. Nothing on the site is investment advice or a recommendation, and all trading results shown are simulated — no real capital is deployed.',
      },
    },
  ],
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(APP_LD) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_LD) }}
      />
      <MapleGammaLanding />
    </>
  );
}
