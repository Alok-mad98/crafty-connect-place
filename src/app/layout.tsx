import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Roboto_Mono } from "next/font/google";
import "./globals.css";
import Providers from "@/providers/PrivyProvider";
import CinematicBackground from "@/components/CinematicBackground";
import Navbar from "@/components/Navbar";
import MasterAIChat from "@/components/MasterAIChat";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const geistMono = Roboto_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

// Force dynamic rendering — app requires runtime auth (Privy)
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Nexus | AI Skills Marketplace",
  description: "Equip your AI with premium skills instantly via MCP",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.variable} ${geistMono.variable} font-sans antialiased bg-navy text-white min-h-screen overflow-x-hidden`}
      >
        <Providers>
          <CinematicBackground />
          <Navbar />
          <main className="relative z-10 pt-16">
            {children}
          </main>
          <MasterAIChat />
        </Providers>
      </body>
    </html>
  );
}
