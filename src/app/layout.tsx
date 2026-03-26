import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NYT Dateline Viewer",
  description: "A new Node-powered web app ready for GitHub and Vercel.",
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
