export const metadata = {
  title: 'Metabsp',
  description: 'Metabsp WhatsApp Cloud API — Next.js 15 app (stateless slice)',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
