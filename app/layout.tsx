import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pills — Creator Studio",
  description: "Crea experiencias digitales coleccionables para tus eventos.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
