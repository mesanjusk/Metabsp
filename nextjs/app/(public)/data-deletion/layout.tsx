import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Data Deletion — SK Digital",
  description: "Learn how to request deletion of personal data associated with SK Digital.",
  alternates: { canonical: 'https://meta.sanjusk.in/data-deletion' },
  openGraph: {
    title: "Data Deletion — SK Digital",
    description: "Learn how to request deletion of personal data associated with SK Digital.",
    url: 'https://meta.sanjusk.in/data-deletion',
  },
};

export default function PageLayout({ children }: { children: React.ReactNode }) {
  return children;
}
