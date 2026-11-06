"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname.startsWith("/login")) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <Sidebar />
      <main className="min-h-screen min-w-0 flex-1 overflow-y-auto px-4 py-8 sm:px-6 md:px-10 lg:py-10">
        <div className="mx-auto w-full max-w-shell">{children}</div>
      </main>
    </div>
  );
}
