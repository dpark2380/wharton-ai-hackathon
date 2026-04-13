import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ask What Matters — Expedia Hotel Review Intelligence",
  description: "Dynamically generated follow-up questions that fill hotel information gaps for Expedia reviewers.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
