import type { MetadataRoute } from 'next';

// Only intended public marketing, help and policy pages.
// Dashboard, sign-in, account, API and private customer routes must not appear.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://meta.sanjusk.in';
  return [
    { url: `${base}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/about`, changeFrequency: 'monthly', priority: 0.65 },
    { url: `${base}/contact`, changeFrequency: 'monthly', priority: 0.65 },
    { url: `${base}/help-center`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/developer-docs`, changeFrequency: 'monthly', priority: 0.55 },
    { url: `${base}/security-info`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/status`, changeFrequency: 'weekly', priority: 0.4 },
    { url: `${base}/privacy-policy`, changeFrequency: 'yearly', priority: 0.4 },
    { url: `${base}/terms-of-service`, changeFrequency: 'yearly', priority: 0.4 },
    { url: `${base}/cookie-policy`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/data-deletion`, changeFrequency: 'yearly', priority: 0.3 },
  ];
}
