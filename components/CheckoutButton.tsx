"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-brand-blue";

export function CheckoutButton({
  plan,
  children,
  className,
}: {
  plan: "pro" | "agency";
  children: React.ReactNode;
  className?: string;
}) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  async function startCheckout() {
    setIsLoading(true);

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });

      if (response.status === 401) {
        const next = `/?checkout=${plan}#pricing`;
        router.push(`/login?next=${encodeURIComponent(next)}`);
        return;
      }

      if (!response.ok) {
        throw new Error("Checkout could not be started.");
      }

      const data = (await response.json()) as { url?: string };

      if (!data.url) {
        throw new Error("Checkout session is missing a URL.");
      }

      window.location.href = data.url;
    } catch (error) {
      toast.error("Could not start checkout", {
        description:
          error instanceof Error ? error.message : "Please try again.",
      });
      setIsLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={startCheckout}
      disabled={isLoading}
      aria-busy={isLoading}
      className={cn(className, focusRing)}
    >
      {isLoading ? "Opening checkout..." : children}
    </button>
  );
}
