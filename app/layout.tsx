import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Onboarding Assistant",
  description: "Real-time AI assistant for client onboarding calls",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
