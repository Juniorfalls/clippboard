"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Coins } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-brand-blue";

export function CryptoCheckoutButton({
  plan,
  className,
}: {
  plan: "pro" | "agency";
  className?: string;
}) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  async function startCryptoCheckout() {
    setIsLoading(true);

    try {
      const response = await fetch("/api/crypto-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });

      if (response.status === 401) {
        const next = `/#pricing`;
        router.push(`/login?next=${encodeURIComponent(next)}`);
        return;
      }

      const data = (await response.json().catch(() => null)) as
        | { url?: string; error?: string }
        | null;

      if (!response.ok) {
        throw new Error(data?.error ?? "Crypto checkout could not be started.");
      }

      if (!data?.url) {
        throw new Error("Crypto invoice is missing a URL.");
      }

      window.location.href = data.url;
    } catch (error) {
      toast.error("Could not start crypto checkout", {
        description:
          error instanceof Error ? error.message : "Please try again.",
      });
      setIsLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={startCryptoCheckout}
      disabled={isLoading}
      aria-busy={isLoading}
      className={cn(
        "inline-flex w-full items-center justify-center gap-2 rounded-2 border border-border-gray bg-warm-white px-4 py-3 text-[14px] font-semibold text-soft-black duration-200 hover:bg-white",
        focusRing,
        className
      )}
    >
      <Coins className="h-4 w-4 text-brand-blue" aria-hidden />
      {isLoading ? "Opening crypto checkout..." : "Or Pay with Crypto (USDC/USDT)"}
    </button>
  );
}
