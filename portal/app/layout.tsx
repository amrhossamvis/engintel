import type { Metadata } from "next";
import { Bricolage_Grotesque, Hanken_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AppProvider } from "@/components/AppProvider";
import { AppShell } from "@/components/AppShell";
import { FeedbackButton } from "@/components/FeedbackButton";
import { NunDrawer } from "@/components/ideas/NunDrawer";

const themeScript = `(function(){try{var t=localStorage.getItem('theme')||'dark';document.documentElement.dataset.theme=t;}catch(e){document.documentElement.dataset.theme='dark';}})();`;

const display = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display-src",
  weight: ["400", "500", "600", "700", "800"],
});

const body = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-body-src",
  weight: ["400", "500", "600", "700"],
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono-src",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Hub — AI Engineering Console",
  description:
    "One console for every AI-powered delivery capability — Azure DevOps today; Jira, GitHub and more next. Runs under your own token.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${display.variable} ${body.variable} ${mono.variable}`}>
        <AppProvider>
          <div className="bg-glow" />
          <div className="bg-grid" />
          <div className="bg-grain" />
          <AppShell />
          {children}
          <FeedbackButton variant="fab" />
          <NunDrawer />
        </AppProvider>
      </body>
    </html>
  );
}
