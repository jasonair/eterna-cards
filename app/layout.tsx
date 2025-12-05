import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import MobileNav from "@/components/MobileNav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Eterna Cards",
  description: "Inventory and purchase order management",
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#111111] text-gray-100 font-mono`}
      >
        <div className="min-h-screen flex bg-[#1a1a1a]">
          <MobileNav />
          <Sidebar />
          <main className="flex-1 pb-20 sm:pb-0 sm:ml-48 lg:ml-56">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
