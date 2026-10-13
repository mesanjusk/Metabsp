import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Cookie Policy — SK Digital",
  description: "Learn how SK Digital uses cookies and similar technologies.",
  alternates: { canonical: 'https://meta.sanjusk.in/cookie-policy' },
  openGraph: {
    title: "Cookie Policy — SK Digital",
    description: "Learn how SK Digital uses cookies and similar technologies.",
    url: 'https://meta.sanjusk.in/cookie-policy',
  },
};

export default function PageLayout({ children }: { children: React.ReactNode }) {
  return children;
}
