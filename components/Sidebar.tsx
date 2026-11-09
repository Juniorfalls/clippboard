"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  FolderOpen,
  HelpCircle,
  LifeBuoy,
  LogOut,
  Settings,
  ShieldCheck,
  Sparkles,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/Logo";
import { TeamSwitcher } from "@/components/TeamSwitcher";
import { toast } from "sonner";
import { createClient } from "@/utils/supabase/client";

const NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/dashboard", label: "Workspace", icon: Sparkles },
  { href: "/dashboard/projects", label: "Projects", icon: FolderOpen },
  { href: "/dashboard/team", label: "Team", icon: UsersRound },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-brand-blue";

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [email, setEmail] = useState("");
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function checkAdmin() {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) return;

        if (!cancelled) setEmail(user.email ?? "");

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

  async function handleSignOut() {
    setIsSigningOut(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      toast.success("Signed out");
      router.replace("/login");
      router.refresh();
    } catch (error) {
      toast.error("Could not sign out", {
        description:
          error instanceof Error ? error.message : "Please try again.",
      });
      setIsSigningOut(false);
    }
  }

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
<Logo className="text-soft-black" />
      </Link>

      <div className="hidden lg:block">
        <TeamSwitcher />
      </div>

      <nav
        aria-label="Main"
        className="no-scrollbar flex flex-1 flex-row gap-1 overflow-x-auto lg:flex-col lg:overflow-visible"
      >
        {NAV.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/dashboard"
              ? pathname === href
              : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2.5 text-[14px] font-semibold duration-200 lg:gap-3 lg:text-[16px]",
                active
                  ? "bg-brand-blue-light/70 text-soft-black"
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
                ? "bg-brand-blue-light/70 text-soft-black"
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

      <div className="mt-auto hidden flex-col gap-1 border-t border-border-gray pt-4 lg:flex">
        <Link
          href="/help"
          aria-current={pathname === "/help" ? "page" : undefined}
          className={cn(
            "flex items-center gap-2.5 rounded-lg px-3 py-2 text-[14px] font-semibold text-soft-black/50 duration-200 hover:bg-white hover:text-soft-black",
            pathname === "/help" && "bg-brand-blue-light/70 text-soft-black",
            focusRing
          )}
        >
          <HelpCircle className="h-4 w-4" aria-hidden />
          Help
        </Link>
        <Link
          href="/support"
          aria-current={pathname === "/support" ? "page" : undefined}
          className={cn(
            "flex items-center gap-2.5 rounded-lg px-3 py-2 text-[14px] font-semibold text-soft-black/50 duration-200 hover:bg-white hover:text-soft-black",
            pathname === "/support" && "bg-brand-blue-light/70 text-soft-black",
            focusRing
          )}
        >
          <LifeBuoy className="h-4 w-4" aria-hidden />
          Support
        </Link>

        <div className="mt-3 flex items-center gap-2 rounded-2 border border-border-gray bg-white p-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-blue-light text-[13px] font-bold text-brand-blue">
            {email.trim().charAt(0).toUpperCase() || "?"}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-semibold text-soft-black">
              {email || "Signed in"}
            </p>
            <p className="text-[10px] text-soft-black/50">Creator workspace</p>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={isSigningOut}
            aria-label="Sign out"
            aria-busy={isSigningOut}
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-soft-black/50 duration-200 hover:bg-warm-white hover:text-soft-black disabled:cursor-not-allowed disabled:opacity-50",
              focusRing
            )}
          >
            <LogOut className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>
    </aside>
  );
}
