import type { Metadata } from "next";
import { Crimson_Pro, Inter } from "next/font/google";
import Providers from "@/components/Providers";
import "./globals.css";

const crimsonPro = Crimson_Pro({
  variable: "--font-crimson-pro",
  subsets: ["latin"],
  weight: ["400", "600"],
  style: ["normal", "italic"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Ask the Ancients",
  description: "Conversations with history's greatest philosophers.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${crimsonPro.variable} ${inter.variable} font-sans antialiased grain`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
