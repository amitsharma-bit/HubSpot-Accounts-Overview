import type { Metadata } from "next";
import Link from "next/link";
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
  title: "HubSpot US Accounts Overview",
  description: "US account ownership and team distribution, computed server-side from HubSpot.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <nav className="topnav">
          <Link href="/">Overview</Link>
          <Link href="/control-center">Control Center</Link>
        </nav>
        <main className="page">{children}</main>
      </body>
    </html>
  );
}
