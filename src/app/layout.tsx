import type { Metadata } from "next";
import { Instrument_Serif, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const serifFont = Instrument_Serif({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-serif",
});

const interFont = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const monoFont = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Pensieve — Grounded AI Notebook",
  description: "A vessel for your knowledge sources and grounded research.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${serifFont.variable} ${interFont.variable} ${monoFont.variable}`}
    >
      <body className="antialiased bg-[#F5F7F8] text-[#141A22] font-sans-body selection:bg-[#3B4CC0] selection:text-white">
        {children}
      </body>
    </html>
  );
}
