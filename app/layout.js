import './globals.css';

export const metadata = {
  title: 'Screened',
  description: 'Your Letterboxd receipt generator',
  icons: {
    icon: '/favicon.png',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500&display=swap" rel="stylesheet" />
        <link href="https://api.fontshare.com/v2/css?f[]=satoshi@400,401,500,501,700,701,900,901&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}