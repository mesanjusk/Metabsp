import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Contact SK Digital",
  description: "Get in touch with SK Digital about business messaging, customer management and growth tools.",
  alternates: { canonical: 'https://meta.sanjusk.in/contact' },
  openGraph: {
    title: "Contact SK Digital",
    description: "Get in touch with SK Digital about business messaging, customer management and growth tools.",
    url: 'https://meta.sanjusk.in/contact',
  },
};

export default function PageLayout({ children }: { children: React.ReactNode }) {
  return children;
}
