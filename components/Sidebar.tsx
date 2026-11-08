"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FolderOpen,
  Settings,
  ShieldCheck,
  Sparkles,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LogoMark } from "@/components/Logo";
import { TeamSwitcher } from "@/components/TeamSwitcher";
import { toast } from "sonner";
import { createClient } from "@/utils/supabase/client";

const NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/dashboard", label: "Workspace", icon: Sparkles },
  { href: "/projects", label: "Projects", icon: FolderOpen },
  { href: "/dashboard/team", label: "Team", icon: UsersRound },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-brand-blue";

export function Sidebar() {
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function checkAdmin() {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) return;

        const { data } = await supabase
          .from("profiles")
          .select("is_admin")
          .eq("id", user.id)
          .maybeSingle();

        if (!cancelled && data?.is_admin) {
          setIsAdmin(true);
        }
      } catch (error) {
        toast.error("Could not verify admin access", {
          description:
            error instanceof Error ? error.message : "Please try again.",
        });
      }
    }

    void checkAdmin();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <aside className="sticky top-0 z-30 flex w-full shrink-0 flex-row items-center gap-4 border-b border-border-gray bg-warm-white px-4 py-3 lg:h-screen lg:w-64 lg:flex-col lg:items-stretch lg:border-b-0 lg:border-r lg:px-4 lg:py-6">
      <Link
        href="/"
        aria-label="Clippboard workspace"
        className={cn(
          "flex shrink-0 items-center gap-2 rounded-lg px-2 py-1",
          focusRing
        )}
      >
        <LogoMark />
        <span className="hidden text-2xl font-bold -tracking-1 text-soft-black lg:inline">
          Clippboard
        </span>
      </Link>

      <div className="hidden lg:block">
        <TeamSwitcher />
      </div>

      <nav
        aria-label="Main"
        className="no-scrollbar flex flex-1 flex-row gap-1 overflow-x-auto lg:flex-col lg:overflow-visible"
      >
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2.5 text-[14px] font-semibold duration-200 lg:gap-3 lg:text-[16px]",
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

        {isAdmin && (
          <Link
            href="/admin"
            aria-current={pathname === "/admin" ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2.5 text-[14px] font-semibold duration-200 lg:gap-3 lg:text-[16px]",
              pathname === "/admin"
                ? "bg-white text-soft-black shadow-sm"
                : "text-soft-black/70 hover:bg-white hover:text-soft-black",
              focusRing
            )}
          >
            <ShieldCheck
              className={cn(
                "h-5 w-5",
                pathname === "/admin" && "text-brand-blue"
              )}
              aria-hidden
            />
            Admin
          </Link>
        )}
      </nav>
    </aside>
  );
}
