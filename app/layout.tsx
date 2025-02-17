import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import GitHubCorner from "@/components/github-corner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Satori DataViz",
  description: "Satori DataViz",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <div className="min-h-screen bg-yellow-100 text-black p-4">
          <GitHubCorner />
          <header className="mb-8">
            <h1 className="text-6xl font-bold uppercase">Satori DataViz</h1>
          </header>
          <main>{children}</main>
          <footer className="mt-8 text-xl font-bold">
            {/* <p>Data updated daily</p> */}
          </footer>
        </div>
      </body>
    </html>

  );
}
