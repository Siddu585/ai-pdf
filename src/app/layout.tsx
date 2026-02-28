import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    template: "%s | Free Online PDF Tools",
    default: "Convert PDF to Word Free | OCR Scanner | PDF Utility Hub"
  },
  description: "The ultimate 100% private, free online PDF toolkit. Compress PDFs, convert PDF to Word, scan images with OCR, and instantly transfer files across devices.",
  keywords: ["PDF to Word", "Compress PDF", "Free PDF Converter", "OCR Scanner", "Extract Text from Image", "InstantDrop", "File Transfer"],
  openGraph: {
    title: "Free online PDF processing toolkit",
    description: "Convert, compress, and scan your PDFs securely for free.",
    type: "website",
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="google-adsense-account" content="ca-pub-7932640955334855" />
        <Script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7932640955334855"
          crossOrigin="anonymous"
          strategy="beforeInteractive"
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
