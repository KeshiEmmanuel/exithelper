import type { Metadata } from "next";
import { Instrument_Serif, Instrument_Sans } from "next/font/google";
import "./globals.css";

const SerifFont = Instrument_Serif({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: "400"
});

const InstrumentSans  = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
});
export const metadata: Metadata = {
  title: "ALEX -  University Exeat Assistant",
  description:
    "Apply for an exeat (leave of absence)",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${SerifFont.variable} ${InstrumentSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
