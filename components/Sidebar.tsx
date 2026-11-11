"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  FolderOpen,
  HelpCircle,
  LifeBuoy,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  ShieldCheck,
  Sparkles,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo, LogoMark } from "@/components/Logo";
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

export function Sidebar({
  isOpen,
  onToggle,
  isMobileOpen,
  onMobileClose,
}: {
  isOpen: boolean;
  onToggle: () => void;
  isMobileOpen: boolean;
  onMobileClose: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [email, setEmail] = useState("");
  const [isSigningOut, setIsSigningOut] = useState(false);
  const showLabels = isOpen || isMobileOpen;

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

  useEffect(() => {
    onMobileClose();
  }, [pathname, onMobileClose]);

  useEffect(() => {
    if (!isMobileOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onMobileClose();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMobileOpen, onMobileClose]);

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

  const toggleLabel = isMobileOpen
    ? "Close sidebar"
    : isOpen
      ? "Collapse sidebar"
      : "Expand sidebar";

  return (
    <>
      {isMobileOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={onMobileClose}
          className="fixed inset-0 z-30 bg-soft-black/40 backdrop-blur-[2px] lg:hidden"
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex h-screen w-64 max-w-[85vw] shrink-0 flex-col border-r border-border-gray bg-warm-white px-4 py-6 transition-all duration-300",
          isMobileOpen ? "translate-x-0" : "-translate-x-full",
          "lg:sticky lg:top-0 lg:z-30 lg:flex lg:translate-x-0",
          isOpen ? "lg:w-64" : "lg:w-20"
        )}
      >
        <div
          className={cn(
            "flex items-center gap-2",
            showLabels ? "justify-between" : "flex-col justify-center"
          )}
        >
          <Link
            href="/"
            aria-label="Clippboard workspace"
            className={cn(
              "flex min-w-0 shrink items-center gap-2 rounded-lg px-1 py-1",
              focusRing
            )}
          >
            {showLabels ? <Logo /> : <LogoMark />}
          </Link>

          <button
            type="button"
            onClick={isMobileOpen ? onMobileClose : onToggle}
            aria-label={toggleLabel}
            aria-expanded={isMobileOpen || isOpen}
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-soft-black/60 duration-200 hover:bg-white hover:text-soft-black",
              focusRing
            )}
          >
            {isMobileOpen || isOpen ? (
              <PanelLeftClose className="h-5 w-5" aria-hidden />
            ) : (
              <PanelLeftOpen className="h-5 w-5" aria-hidden />
            )}
          </button>
        </div>

        {showLabels && (
          <div className="mt-4">
            <TeamSwitcher />
          </div>
        )}

        <nav
          aria-label="Main"
          className="no-scrollbar mt-4 flex flex-1 flex-col gap-1 overflow-y-auto"
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
                title={showLabels ? undefined : label}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex shrink-0 items-center rounded-lg px-3 py-2.5 text-[14px] font-semibold duration-200 lg:text-[16px]",
                  showLabels ? "gap-3" : "justify-center",
                  active
                    ? "bg-brand-blue-light/70 text-soft-black"
                    : "text-soft-black/70 hover:bg-white hover:text-soft-black",
                  focusRing
                )}
              >
                <Icon
                  className={cn("h-5 w-5 shrink-0", active && "text-brand-blue")}
                  aria-hidden
                />
                {showLabels && <span className="truncate">{label}</span>}
              </Link>
            );
          })}

          {isAdmin && (
            <Link
              href="/admin"
              title={showLabels ? undefined : "Admin"}
              aria-current={pathname === "/admin" ? "page" : undefined}
              className={cn(
                "flex shrink-0 items-center rounded-lg px-3 py-2.5 text-[14px] font-semibold duration-200 lg:text-[16px]",
                showLabels ? "gap-3" : "justify-center",
                pathname === "/admin"
                  ? "bg-brand-blue-light/70 text-soft-black"
                  : "text-soft-black/70 hover:bg-white hover:text-soft-black",
                focusRing
              )}
            >
              <ShieldCheck
                className={cn(
                  "h-5 w-5 shrink-0",
                  pathname === "/admin" && "text-brand-blue"
                )}
                aria-hidden
              />
              {showLabels && <span className="truncate">Admin</span>}
            </Link>
          )}
        </nav>

        <div className="mt-auto flex flex-col gap-1 border-t border-border-gray pt-4">
          <Link
            href="/help"
            title={showLabels ? undefined : "Help"}
            aria-current={pathname === "/help" ? "page" : undefined}
            className={cn(
              "flex items-center rounded-lg px-3 py-2 text-[14px] font-semibold text-soft-black/50 duration-200 hover:bg-white hover:text-soft-black",
              showLabels ? "gap-2.5" : "justify-center",
              pathname === "/help" && "bg-brand-blue-light/70 text-soft-black",
              focusRing
            )}
          >
            <HelpCircle className="h-4 w-4 shrink-0" aria-hidden />
            {showLabels && <span>Help</span>}
          </Link>
          <Link
            href="/support"
            title={showLabels ? undefined : "Support"}
            aria-current={pathname === "/support" ? "page" : undefined}
            className={cn(
              "flex items-center rounded-lg px-3 py-2 text-[14px] font-semibold text-soft-black/50 duration-200 hover:bg-white hover:text-soft-black",
              showLabels ? "gap-2.5" : "justify-center",
              pathname === "/support" && "bg-brand-blue-light/70 text-soft-black",
              focusRing
            )}
          >
            <LifeBuoy className="h-4 w-4 shrink-0" aria-hidden />
            {showLabels && <span>Support</span>}
          </Link>

          {showLabels ? (
            <div className="mt-3 flex items-center gap-2 rounded-2 border border-border-gray bg-white p-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-blue-light text-[13px] font-bold text-brand-blue">
                {email.trim().charAt(0).toUpperCase() || "?"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-semibold text-soft-black">
                  {email || "Signed in"}
                </p>
                <p className="text-[10px] text-soft-black/50">
                  Creator workspace
                </p>
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
          ) : (
            <button
              type="button"
              onClick={handleSignOut}
              disabled={isSigningOut}
              aria-label="Sign out"
              aria-busy={isSigningOut}
              className={cn(
                "mt-3 flex h-10 w-full items-center justify-center rounded-lg text-soft-black/50 duration-200 hover:bg-white hover:text-soft-black disabled:cursor-not-allowed disabled:opacity-50",
                focusRing
              )}
            >
              <LogOut className="h-4 w-4" aria-hidden />
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
