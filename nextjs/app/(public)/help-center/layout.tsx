import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "SK Digital Help Center",
  description: "Find help and answers about your SK Digital business workspace and WhatsApp tools.",
  alternates: { canonical: 'https://meta.sanjusk.in/help-center' },
  openGraph: {
    title: "SK Digital Help Center",
    description: "Find help and answers about your SK Digital business workspace and WhatsApp tools.",
    url: 'https://meta.sanjusk.in/help-center',
  },
};

export default function PageLayout({ children }: { children: React.ReactNode }) {
  return children;
}
