"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function CheckoutResume({
  plan,
}: {
  plan?: "pro" | "agency";
}) {
  const router = useRouter();
  const started = useRef(false);

  useEffect(() => {
    if (!plan || started.current) return;

    const currentUrl = new URL(window.location.href);
    if (!currentUrl.searchParams.has("checkout")) return;

    started.current = true;
    currentUrl.searchParams.delete("checkout");
    window.history.replaceState(
      {},
      "",
      `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`
    );

    async function resumeCheckout() {
      try {
        const response = await fetch("/api/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan }),
        });

        if (response.status === 401) {
          const next = `/?checkout=${plan}#pricing`;
          router.replace(`/login?next=${encodeURIComponent(next)}`);
          return;
        }

        if (!response.ok) {
          const data = (await response.json().catch(() => null)) as
            | { error?: string }
            | null;
          throw new Error(data?.error ?? "Checkout could not be started.");
        }

        const data = (await response.json()) as { url?: string };
        if (!data.url) {
          throw new Error("Checkout session is missing a URL.");
        }

        window.location.href = data.url;
      } catch (error) {
        toast.error("Could not resume checkout", {
          description:
            error instanceof Error ? error.message : "Please try again.",
        });
      }
    }

    void resumeCheckout();
  }, [plan, router]);

  return null;
}
