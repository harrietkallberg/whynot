import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "WhyNot",
  description: "Collect the reasons people said no, anonymously.",
  // An Owner Link lives in the URL, so no page may hand it to another site in
  // a Referer header (ADR-0002). next.config.ts sets the same policy as a
  // response header; this is the belt to that pair of braces.
  referrer: "no-referrer",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
