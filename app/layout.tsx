import type { Metadata } from "next";
import { Outfit, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/sidebar";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "HiveState | Multi-Agent Orchestration",
  description: "The Invisible Engine for AI-powered coordinated agent networks.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${outfit.variable} ${jetbrainsMono.variable} h-full antialiased dark`}
    >
      <body className="h-full bg-background text-foreground flex overflow-hidden">
        {/* Fixed Navigation Sidebar */}
        <Sidebar />

        {/* Dynamic Content Area */}
        <main className="flex-1 flex flex-col min-w-0 bg-grid relative overflow-y-auto">
          {/* subtle overlay for blueprint effect */}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background/5 pointer-events-none" />
          
          <div className="relative p-4 w-full h-full">
            {children}
          </div>
        </main>
      </body>
    </html>
  );
}
