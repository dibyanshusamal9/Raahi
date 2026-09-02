import type { Metadata } from "next";
import { Baloo_2, Hind, Yatra_One, Besley } from "next/font/google";
import Navbar from "@/components/Navbar";
import "./globals.css";

const baloo = Baloo_2({
  subsets: ["latin", "devanagari"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-baloo",
});

const hind = Hind({
  subsets: ["latin", "devanagari"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-hind",
});

const yatraOne = Yatra_One({
  subsets: ["latin", "devanagari"],
  weight: "400",
  variable: "--font-yatra-one",
});

const besley = Besley({
  subsets: ["latin"],
  variable: "--font-besley",
});

export const metadata: Metadata = {
  title: "RAAHI - Find your path to income",
  description: "Rural AI Advisor for Household Income",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${baloo.variable} ${hind.variable} ${yatraOne.variable} ${besley.variable}`}>
        <Navbar />
        <div className="noise-overlay" />
        {children}
      </body>
    </html>
  );
}
