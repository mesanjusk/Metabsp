import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "SK Digital System Status",
  description: "View service status and availability information for SK Digital business tools.",
  alternates: { canonical: 'https://meta.sanjusk.in/status' },
  openGraph: {
    title: "SK Digital System Status",
    description: "View service status and availability information for SK Digital business tools.",
    url: 'https://meta.sanjusk.in/status',
  },
};

export default function PageLayout({ children }: { children: React.ReactNode }) {
  return children;
}
