// lib/seo.ts — per-route metadata builder.
// Next merges metadata shallowly per top-level key and the `%s | MapleGamma`
// title template never applies to og/twitter, so every page must ship complete
// openGraph/twitter blocks or social cards fall back to the homepage defaults.
import type { Metadata } from 'next';

const SITE_NAME = 'MapleGamma';
const OG_IMAGE = { url: '/og.png', width: 1200, height: 630, alt: 'MapleGamma — Options Intelligence' };

export function buildMetadata({
  title,
  description,
  path,
  ogType = 'website',
  publishedTime,
  noIndex = false,
}: {
  /** Page title without the site suffix; the layout template renders `<title>`. */
  title: string;
  description: string;
  /** Canonical path with trailing slash, e.g. '/screener/'. */
  path: `/${string}`;
  ogType?: 'website' | 'article';
  publishedTime?: string;
  noIndex?: boolean;
}): Metadata {
  const fullTitle = `${title} | ${SITE_NAME}`;
  return {
    title,
    description,
    alternates: { canonical: path },
    ...(noIndex ? { robots: { index: false } } : {}),
    openGraph: {
      type: ogType,
      siteName: SITE_NAME,
      url: path,
      title: fullTitle,
      description,
      images: [OG_IMAGE],
      locale: 'en_US',
      ...(ogType === 'article' && publishedTime ? { publishedTime } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
      images: [OG_IMAGE.url],
    },
  };
}
