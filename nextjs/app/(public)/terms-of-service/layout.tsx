import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Terms of Service — SK Digital",
  description: "Read the terms governing access to and use of the SK Digital business platform.",
  alternates: { canonical: 'https://meta.sanjusk.in/terms-of-service' },
  openGraph: {
    title: "Terms of Service — SK Digital",
    description: "Read the terms governing access to and use of the SK Digital business platform.",
    url: 'https://meta.sanjusk.in/terms-of-service',
  },
};

export default function PageLayout({ children }: { children: React.ReactNode }) {
  return children;
}
