import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Elsass Racing",
  description: "Plateforme de gestion de team",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className="dark">
      <body className="font-sans">{children}</body>
    </html>
  );
}
