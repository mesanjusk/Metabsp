import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Security and Trust at SK Digital",
  description: "Learn how SK Digital approaches business account security and customer data protection.",
  alternates: { canonical: 'https://meta.sanjusk.in/security-info' },
  openGraph: {
    title: "Security and Trust at SK Digital",
    description: "Learn how SK Digital approaches business account security and customer data protection.",
    url: 'https://meta.sanjusk.in/security-info',
  },
};

export default function PageLayout({ children }: { children: React.ReactNode }) {
  return children;
}
