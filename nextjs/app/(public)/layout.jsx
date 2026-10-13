import PublicShell from './public-shell';

export const metadata = {
  metadataBase: new URL('https://meta.sanjusk.in'),
  title: 'SK Digital — Business Growth OS | Official WhatsApp Business Tools',
  description: 'Manage WhatsApp Cloud API conversations, CRM, leads, campaigns and business operations in one SK Digital business growth workspace.',
  openGraph: {
    type: 'website',
    url: 'https://meta.sanjusk.in/',
    title: 'SK Digital — Business Growth OS',
    description: 'Official WhatsApp API communication, CRM, automation and business management tools by SK Digital.',
  },
};

export default function PublicLayout({ children }) {
  return <PublicShell>{children}</PublicShell>;
}
