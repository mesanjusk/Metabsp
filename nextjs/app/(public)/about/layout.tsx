import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "About SK Digital",
  description: "Learn about SK Digital's official WhatsApp API, CRM and business automation platform.",
  alternates: { canonical: 'https://meta.sanjusk.in/about' },
  openGraph: {
    title: "About SK Digital",
    description: "Learn about SK Digital's official WhatsApp API, CRM and business automation platform.",
    url: 'https://meta.sanjusk.in/about',
  },
};

export default function PageLayout({ children }: { children: React.ReactNode }) {
  return children;
}
