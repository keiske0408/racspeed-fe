import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { PwaRegister } from "@/components/layout/pwa-register";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#E11D48",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "RacSpeed — Rotaract Club Operations Platform",
  description: "Rotaract Club of San Pedro East · Rotary International District 3820 operations platform for membership, attendance, treasury, and district reporting.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "RacSpeed",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.classList.remove('dark');
                }
              } catch (_) {}
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-[#F8F9FB] dark:bg-[#0A0D14] text-[#111625] dark:text-[#F8FAFC] transition-colors duration-200">
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
