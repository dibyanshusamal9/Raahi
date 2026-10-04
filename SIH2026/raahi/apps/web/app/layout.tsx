import "./globals.css";
import type { Metadata } from "next";
import { Hind, Inter, Yatra_One } from "next/font/google";
import { PLATFORM } from "@/lib/brand";
import { WaveBackground } from "@/components/wave-background";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
// Devanagari names and places anywhere on the page.
const hind = Hind({
  subsets: ["devanagari", "latin"],
  weight: ["500", "600", "700"],
  variable: "--font-brand",
  display: "swap",
});
// The राही wordmark, as on the caller site.
const yatra = Yatra_One({
  subsets: ["devanagari", "latin"],
  weight: "400",
  variable: "--font-logo",
  display: "swap",
});

export const metadata: Metadata = {
  title: `RAAHI · ${PLATFORM}`,
  description: "Calls, skills and job openings by district, for officers working with RAAHI",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${hind.variable} ${yatra.variable}`}>
      <body className="min-h-screen font-sans">
        <WaveBackground />
        <div className="relative">{children}</div>
      </body>
    </html>
  );
}
