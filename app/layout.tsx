import type { Metadata } from "next";
import "leaflet/dist/leaflet.css";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://ahr-jakarta.vercel.app"),
  title: "AHR Jakarta — Koridor MRT & LRT",
  description:
    "Peta interaktif kandidat apartemen, hunian, dan rumah di sekitar jaringan MRT Jakarta dan LRT Jabodebek.",
  openGraph: {
    title: "AHR Jakarta",
    description: "Hunian dalam koridor MRT & LRT",
    images: [{ url: "/og.png", width: 1536, height: 1024, alt: "AHR Jakarta WebGIS" }],
  },
  twitter: { card: "summary_large_image", images: ["/og.png"] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
