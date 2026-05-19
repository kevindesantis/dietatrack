import './globals.css';
import RegisterSW from './register-sw';

export const metadata = {
  title: 'DietaTrack',
  description: 'Web app per dieta, calorie, misure e allenamenti',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'DietaTrack',
    statusBarStyle: 'default'
  }
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#0f766e'
};

export default function RootLayout({ children }) {
  return (
    <html lang="it">
      <body><RegisterSW />{children}</body>
    </html>
  );
}
