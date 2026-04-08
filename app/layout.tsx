import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Audit Gratuit Annonce Airbnb | votrephotographeimmo.com",
  description:
    "Analysez gratuitement votre annonce Airbnb et obtenez un score sur 100 avec des recommandations personnalisées pour booster vos réservations.",
  openGraph: {
    title: "Audit Gratuit Annonce Airbnb | votrephotographeimmo.com",
    description:
      "Analysez gratuitement votre annonce Airbnb et obtenez un score sur 100 avec des recommandations personnalisées.",
    type: "website",
    url: "https://audit.votrephotographeimmo.com",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>{children}</body>
    </html>
  );
}
