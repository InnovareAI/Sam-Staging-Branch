import React from "react";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import MainContent from "@/components/layout/main";

const inter = Inter({
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["latin"]
});

export const metadata: Metadata = {
  title: "Neofolio - Portfolio Template",
  description:
    "Dashboard style portfolio and directory website template. Built with Next.js, Tailwind CSS & shadcn/ui.",
  openGraph: {
    images: ["/seo.jpg"]
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className}`} suppressHydrationWarning>
        <MainContent>{children}</MainContent>
      </body>
    </html>
  );
}
