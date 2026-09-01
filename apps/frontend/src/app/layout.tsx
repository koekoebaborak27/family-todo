import type { Metadata } from "next";
import { M_PLUS_Rounded_1c } from "next/font/google";
import { ThemeProvider } from "@/shared/theme-provider";
import { Toaster } from "@/shared/ui/sonner";
import "./globals.css";

// 見出し・本文共通のフォント（DESIGN.md「タイポグラフィ」）。本文500・見出し700を使う。
const mPlusRounded = M_PLUS_Rounded_1c({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["500", "700"],
});

export const metadata: Metadata = {
  title: "家族 de TODO！",
  description: "家族間で日常のちょっとしたToDoを共有・管理するアプリ",
  manifest: "/manifest.json",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className={mPlusRounded.variable} suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
