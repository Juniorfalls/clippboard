"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FolderOpen, Settings, Sparkles, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/Logo";

const NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/", label: "Workspace", icon: Sparkles },
  { href: "/projects", label: "Projects", icon: FolderOpen },
  { href: "/settings", label: "Settings", icon: Settings },
];

const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-brand-blue";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col border-r border-border-gray bg-warm-white px-4 py-6">
      <Link
        href="/"
        className={cn("mb-10 flex items-center gap-2 rounded-lg px-2 py-1", focusRing)}
      >
        <Logo />
      </Link>

      <nav aria-label="Main" className="flex flex-col gap-1">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-[16px] font-semibold duration-200",
                active
                  ? "bg-white text-soft-black shadow-sm"
                  : "text-soft-black/70 hover:bg-white hover:text-soft-black",
                focusRing
              )}
            >
              <Icon
                className={cn("h-5 w-5", active && "text-brand-blue")}
                aria-hidden
              />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
