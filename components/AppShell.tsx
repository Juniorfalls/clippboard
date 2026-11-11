"use client";

import { useCallback, useState } from "react";
import { usePathname } from "next/navigation";
import { PanelLeftOpen } from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { Logo } from "@/components/Logo";
import { TeamProvider } from "@/components/TeamProvider";
import { cn } from "@/lib/utils";

const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-brand-blue";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const closeMobileSidebar = useCallback(
    () => setIsMobileSidebarOpen(false),
    []
  );

  const isAppPage =
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/") ||
    pathname.startsWith("/admin") ||
    pathname === "/help" ||
    pathname === "/support";

  if (!isAppPage) {
    return <>{children}</>;
  }

  return (
    <TeamProvider>
      <div className="min-h-screen lg:flex">
        <Sidebar
          isOpen={isSidebarOpen}
          onToggle={() => setIsSidebarOpen((open) => !open)}
          isMobileOpen={isMobileSidebarOpen}
          onMobileClose={closeMobileSidebar}
        />

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border-gray bg-warm-white/95 px-4 py-3 backdrop-blur lg:hidden">
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(true)}
              aria-label="Open sidebar"
              aria-expanded={isMobileSidebarOpen}
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-lg text-soft-black/70 duration-200 hover:bg-white hover:text-soft-black",
                focusRing
              )}
            >
              <PanelLeftOpen className="h-5 w-5" aria-hidden />
            </button>
            <Logo />
          </header>

          <main className="min-h-screen min-w-0 overflow-y-auto px-4 py-8 sm:px-6 md:px-10 lg:py-10">
            <div className="mx-auto w-full max-w-shell">{children}</div>
          </main>
        </div>
      </div>
    </TeamProvider>
  );
}
