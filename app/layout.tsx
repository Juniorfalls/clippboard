import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import { Analytics } from "@vercel/analytics/next";
import { AppShell } from "@/components/AppShell";
import { cn } from "@/lib/utils";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://clippboard.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Clippboard | AI Video Clipping",
    template: "%s | Clippboard",
  },
  description:
    "Turn long-form videos into engaging, vertical short-form clips with secure browser-based AI processing.",
  applicationName: "Clippboard",
  icons: { icon: "/icon.svg" },
  openGraph: {
    title: "Clippboard | AI Video Clipping",
    description:
      "Turn long-form videos into engaging, vertical short-form clips with secure browser-based AI processing.",
    url: siteUrl,
    siteName: "Clippboard",
    type: "website",
    images: [
      {
        // Replace /public/og-image.png with the final social preview image.
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Clippboard AI video clipping workspace",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Clippboard | AI Video Clipping",
    description:
      "Turn long-form videos into engaging, vertical short-form clips with secure browser-based AI processing.",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn(inter.variable, "scroll-smooth")}>
      <body className="min-h-screen bg-warm-white text-soft-black">
        <AppShell>{children}</AppShell>
        {/* Custom toasts replace window.alert / confirm */}
        <Toaster
          position="top-right"
          toastOptions={{
            unstyled: true,
            classNames: {
              toast:
                "flex w-[356px] items-start gap-3 rounded-3 border border-border-gray bg-white p-4 text-[14px] font-semibold text-soft-black shadow-xl",
              title: "text-[14px] font-semibold",
              description: "text-[13px] font-normal text-soft-black/60",
              error: "border-red-200",
              success: "border-brand-blue-light",
            },
          }}
        />
        <Analytics />
      </body>
    </html>
  );
}
