import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pills — Creator Studio",
  description: "Crea experiencias digitales coleccionables para tus eventos.",
  icons: { icon: [{ url: "/favicon.png", type: "image/png", sizes: "128x128" }] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
