import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import { Sidebar } from "@/components/Sidebar";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: { default: "Clippboard", template: "%s | Clippboard" },
  description: "Clippboard turns raw videos into vertical social clips.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="flex min-h-screen flex-col bg-warm-white text-soft-black lg:flex-row">
        <Sidebar />
        <main className="min-h-screen min-w-0 flex-1 overflow-y-auto px-4 py-8 sm:px-6 md:px-10 lg:py-10">
          <div className="mx-auto w-full max-w-shell">{children}</div>
        </main>
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
      </body>
    </html>
  );
}
