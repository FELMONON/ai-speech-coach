import type { Metadata, Viewport } from "next";
import { Space_Grotesk, Crimson_Pro } from "next/font/google";
import { NavBar } from "@/components/NavBar";
import "./globals.css";

const display = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "500", "600", "700"],
});

const body = Crimson_Pro({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "AI Speech Coach — Practice Speaking with a Live AI Coach",
  description:
    "Real-time speaking coaching with an AI video coach. Get instant feedback on pace, filler words, eye contact, and delivery.",
};

export const viewport: Viewport = {
  themeColor: "#080c14",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${body.variable}`}>
        <NavBar />
        {children}
      </body>
    </html>
  );
}
