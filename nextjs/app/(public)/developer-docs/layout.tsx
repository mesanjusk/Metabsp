import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "SK Digital Developer Documentation",
  description: "Explore developer documentation and integration guidance for SK Digital business tools.",
  alternates: { canonical: 'https://meta.sanjusk.in/developer-docs' },
  openGraph: {
    title: "SK Digital Developer Documentation",
    description: "Explore developer documentation and integration guidance for SK Digital business tools.",
    url: 'https://meta.sanjusk.in/developer-docs',
  },
};

export default function PageLayout({ children }: { children: React.ReactNode }) {
  return children;
}
