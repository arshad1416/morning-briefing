import type { MetadataRoute } from 'next';

const SITE = 'https://maplegamma.com';

export const dynamic = 'force-static';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: ['/api/', '/account/', '/login/', '/signup/'] },
      { userAgent: ['GPTBot', 'ClaudeBot', 'Claude-User', 'PerplexityBot', 'Google-Extended'], allow: '/' },
    ],
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
