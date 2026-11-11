import type { Metadata } from "next";
import { Geist, Geist_Mono, Noto_Serif_SC } from "next/font/google";
import "./globals.css";
import "highlight.js/styles/vs2015.css";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { AppConfigProvider } from "@/components/providers/AppConfigProvider";
import { ToastProvider } from "@/components/providers/ToastProvider";
import { BackgroundProvider } from "@/components/providers/BackgroundProvider";
import { MusicProvider } from "@/components/providers/MusicProvider";
import { EffectProvider } from "@/components/providers/EffectProvider";
import BackgroundRenderer from "@/components/layout/BackgroundRenderer";
import Navbar from "@/components/layout/Navbar";
import ClientWidgets from "@/components/layout/ClientWidgets";
import ClickEffect from "@/components/ui/ClickEffect";
import RadialMenu from "@/components/ui/RadialMenu";
import MouseTrail from "@/components/ui/MouseTrail";
import SeasonalEffect from "@/components/ui/SeasonalEffect";
import KiraSparkle from "@/components/ui/KiraSparkle";
import WelcomeScreen from "@/components/layout/WelcomeScreen";
import VisitorTracker from "@/components/layout/VisitorTracker";
import { NavigationPendingProvider } from "@/components/providers/NavigationPendingProvider";
import { MainContentSlot } from "@/components/navigation/RouteFallback";
import {
  fetchPublicSiteSettings,
  siteSettingString,
} from "@/lib/public-config";
import { siteConfig } from "@/siteConfig";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const notoSerifSC = Noto_Serif_SC({
  variable: "--font-noto-serif-sc",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export async function generateMetadata(): Promise<Metadata> {
  const siteSettings = await fetchPublicSiteSettings();
  const title = siteSettingString(
    siteSettings,
    "site_title",
    siteConfig.title
  );
  const description = siteSettingString(
    siteSettings,
    "bio",
    siteConfig.bio
  );

  return {
    title,
    description,
    alternates: {
      types: {
        "application/rss+xml": "/feed",
      },
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable} ${notoSerifSC.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col font-sans">
        <ThemeProvider>
          <AppConfigProvider>
            <EffectProvider>
              <WelcomeScreen />
              <BackgroundProvider>
                <MusicProvider>
                  <ToastProvider>
                    <NavigationPendingProvider>
                      <BackgroundRenderer />
                      <VisitorTracker />
                      <ClickEffect />
                      <RadialMenu />
                      <MouseTrail />
                      <SeasonalEffect />
                      <KiraSparkle />
                      <Navbar />
                      <main className="flex-1 pt-16">
                        <MainContentSlot>{children}</MainContentSlot>
                      </main>
                      <ClientWidgets />
                    </NavigationPendingProvider>
                  </ToastProvider>
                </MusicProvider>
              </BackgroundProvider>
            </EffectProvider>
          </AppConfigProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
