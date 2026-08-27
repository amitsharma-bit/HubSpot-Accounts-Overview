import type { Metadata } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { NavLink } from "@/components/SideNav";
import { FilterPanel } from "@/components/FilterPanel";
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
        <div className="shell">
          <aside className="sidebar">
            <div className="brand">
              <span className="brand-mark">HS</span>
              <span className="brand-text">
                US Accounts
                <span>Overview</span>
              </span>
            </div>
            <nav className="sidenav">
              <NavLink href="/" label="Overview" icon="grid" />
              <Suspense fallback={null}>
                <FilterPanel />
              </Suspense>
              <NavLink href="/control-center" label="Control Center" icon="shield" />
            </nav>
          </aside>
          <main className="content">{children}</main>
        </div>
      </body>
    </html>
  );
}
