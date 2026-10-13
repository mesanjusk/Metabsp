import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Privacy Policy — SK Digital",
  description: "Read how SK Digital collects, uses and protects personal information in its business platform.",
  alternates: { canonical: 'https://meta.sanjusk.in/privacy-policy' },
  openGraph: {
    title: "Privacy Policy — SK Digital",
    description: "Read how SK Digital collects, uses and protects personal information in its business platform.",
    url: 'https://meta.sanjusk.in/privacy-policy',
  },
};

export default function PageLayout({ children }: { children: React.ReactNode }) {
  return children;
}
