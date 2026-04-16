import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CompleteStayz",
  description: "Dynamically generated follow-up questions that fill hotel information gaps for Expedia reviewers.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // translate="no" prevents Google Translate from injecting <font> elements
    // into React-managed text nodes, which causes removeChild crashes when
    // React tries to update/remove those nodes during reconciliation.
    // suppressHydrationWarning handles any attribute mutations by extensions
    // (Grammarly data-gr-*, Translate translated-ltr class) that happen
    // between SSR and client hydration.
    <html lang="en" className="h-full antialiased" translate="no" suppressHydrationWarning>
      <head>
        {/* Belt-and-suspenders: also tells Chrome's built-in translation UI not to translate */}
        <meta name="google" content="notranslate" />
      </head>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
