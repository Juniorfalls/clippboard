"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Check, Coins, CreditCard, Loader2, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Plan } from "@/lib/plans";

type PaidPlan = "pro" | "agency";
type PaymentMethod = "card" | "crypto";

const PLAN_OPTIONS: Array<{
  id: PaidPlan;
  name: string;
  price: string;
  description: string;
}> = [
  {
    id: "pro",
    name: "Pro",
    price: "$19/mo",
    description: "Unlimited clips, 4K exports, and no watermark.",
  },
  {
    id: "agency",
    name: "Agency",
    price: "$49/mo",
    description: "Everything in Pro plus FCPXML and MCP access.",
  },
];

const PLAN_LABELS: Record<Plan, string> = {
  starter: "Starter",
  pro: "Pro",
  agency: "Agency",
};

const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-brand-blue";

export function UpgradeModal({
  open,
  onOpenChange,
  currentPlan,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPlan: Plan;
}) {
  const [selectedPlan, setSelectedPlan] = useState<PaidPlan>(
    currentPlan === "agency" ? "agency" : "pro"
  );
  const [pendingMethod, setPendingMethod] = useState<PaymentMethod | null>(
    null
  );

  async function startCheckout(method: PaymentMethod) {
    if (pendingMethod) return;
    setPendingMethod(method);

    try {
      const endpoint =
        method === "card" ? "/api/checkout" : "/api/crypto-checkout";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: selectedPlan,
          source: "settings",
        }),
      });
      const data = (await response.json().catch(() => null)) as
        | { url?: string; error?: string }
        | null;

      if (!response.ok || !data?.url) {
        throw new Error(
          data?.error ?? "Checkout could not be started. Please try again."
        );
      }

      window.location.href = data.url;
    } catch (error) {
      toast.error("Could not start checkout", {
        description:
          error instanceof Error ? error.message : "Please try again.",
      });
      setPendingMethod(null);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-soft-black/50 backdrop-blur-sm" />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3 border border-border-gray bg-white p-6 shadow-xl sm:p-8",
            focusRing
          )}
        >
          <div className="flex items-start justify-between gap-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-2 bg-brand-blue-light text-brand-blue">
              <Sparkles className="h-6 w-6" aria-hidden />
            </span>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Close upgrade dialog"
                disabled={Boolean(pendingMethod)}
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full border border-border-gray bg-warm-white text-soft-black duration-200 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50",
                  focusRing
                )}
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </Dialog.Close>
          </div>

          <Dialog.Title className="mt-5 text-[28px] font-bold leading-[1.15] -tracking-1 text-soft-black">
            Upgrade your plan
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-[14px] leading-relaxed text-soft-black/60">
            You&apos;re currently on{" "}
            <strong className="font-semibold text-soft-black">
              {PLAN_LABELS[currentPlan]}
            </strong>
            . Choose a plan and payment method below.
          </Dialog.Description>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {PLAN_OPTIONS.map((option) => {
              const selected = selectedPlan === option.id;
              const isCurrent = currentPlan === option.id;

              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={selected}
                  disabled={Boolean(pendingMethod)}
                  onClick={() => setSelectedPlan(option.id)}
                  className={cn(
                    "relative rounded-2 border p-4 text-left duration-200 disabled:cursor-not-allowed disabled:opacity-60",
                    selected
                      ? "border-2 border-brand-blue bg-brand-blue-light/40"
                      : "border-border-gray bg-white hover:bg-warm-white",
                    focusRing
                  )}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-[16px] font-bold text-soft-black">
                      {option.name}
                    </span>
                    <span className="text-[14px] font-semibold text-soft-black/70">
                      {option.price}
                    </span>
                  </span>
                  <span className="mt-2 block text-[12px] leading-relaxed text-soft-black/60">
                    {option.description}
                  </span>
                  <span className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-soft-black/50">
                    {isCurrent ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-brand-blue" aria-hidden />
                        Current plan
                      </>
                    ) : selected ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-brand-blue" aria-hidden />
                        Selected
                      </>
                    ) : (
                      "Select plan"
                    )}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-6 flex flex-col gap-3">
            <button
              type="button"
              onClick={() => void startCheckout("card")}
              disabled={Boolean(pendingMethod)}
              aria-busy={pendingMethod === "card"}
              className={cn(
                "inline-flex w-full items-center justify-center gap-2 rounded-2 bg-brand-blue px-5 py-3.5 text-[14px] font-semibold text-soft-black duration-200 hover:bg-brand-blue-hover disabled:cursor-not-allowed disabled:bg-brand-blue-light disabled:text-soft-black/60",
                focusRing
              )}
            >
              {pendingMethod === "card" ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <CreditCard className="h-4 w-4" aria-hidden />
              )}
              {pendingMethod === "card"
                ? "Opening secure checkout..."
                : "Pay with Card (Paystack)"}
            </button>

            <button
              type="button"
              onClick={() => void startCheckout("crypto")}
              disabled={Boolean(pendingMethod)}
              aria-busy={pendingMethod === "crypto"}
              className={cn(
                "inline-flex w-full items-center justify-center gap-2 rounded-2 border border-border-gray bg-warm-white px-5 py-3.5 text-[14px] font-semibold text-soft-black duration-200 hover:bg-white disabled:cursor-not-allowed disabled:opacity-60",
                focusRing
              )}
            >
              {pendingMethod === "crypto" ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Coins className="h-4 w-4 text-brand-blue" aria-hidden />
              )}
              {pendingMethod === "crypto"
                ? "Opening crypto checkout..."
                : "Pay with Crypto (USDC/USDT)"}
            </button>
          </div>

          <p className="mt-4 text-center text-[12px] leading-relaxed text-soft-black/45">
            Secure checkout. Your plan activates automatically after payment.
          </p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
