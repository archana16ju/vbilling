import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Billy",
  description: "Billy - Billing Software",
};

import DataLoader from "@/components/layout/DataLoader";
import OfflineSyncManager from "@/components/terminal/OfflineSyncManager";
import CompanyThemeLoader from "@/components/layout/CompanyThemeLoader";
import GlobalShortcutsHandler from "@/components/layout/GlobalShortcutsHandler";

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} dark dark-mode h-full antialiased`}
      data-theme="dark"
    >
      <body className="min-h-full flex flex-col">
        <CompanyThemeLoader />
        <DataLoader />
        <OfflineSyncManager />
        <GlobalShortcutsHandler />
        {children}
      </body>
    </html>
  );
}
