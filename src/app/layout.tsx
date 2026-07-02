import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ohr Hanachal Admin",
  description: "Ohr Hanachal commerce backend",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
