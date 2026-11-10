import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import {
  isPaystackPlan,
  PAYSTACK_CURRENCY,
  PAYSTACK_PLAN_AMOUNTS,
} from "@/lib/paystack";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PaystackEvent = {
  event?: string;
  data?: {
    status?: string;
    amount?: number;
    currency?: string;
    metadata?: unknown;
  };
};

function readMetadata(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object"
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }

  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function hasValidSignature(payload: string, signature: string, secret: string) {
  const expected = createHmac("sha512", secret).update(payload).digest("hex");
  const expectedBuffer = Buffer.from(expected, "utf8");
  const signatureBuffer = Buffer.from(signature, "utf8");

  return (
    expectedBuffer.length === signatureBuffer.length &&
    timingSafeEqual(expectedBuffer, signatureBuffer)
  );
}

export async function POST(request: Request) {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    return NextResponse.json(
      { error: "Paystack webhooks are not configured." },
      { status: 500 }
    );
  }

  const signature = request.headers.get("x-paystack-signature");
  if (!signature) {
    return NextResponse.json(
      { error: "Missing Paystack signature." },
      { status: 401 }
    );
  }

  const payload = await request.text();

  if (!hasValidSignature(payload, signature, secretKey)) {
    return NextResponse.json(
      { error: "Invalid Paystack signature." },
      { status: 401 }
    );
  }

  let event: PaystackEvent;
  try {
    event = JSON.parse(payload) as PaystackEvent;
  } catch {
    return NextResponse.json(
      { error: "Invalid Paystack payload." },
      { status: 400 }
    );
  }

  if (event.event !== "charge.success") {
    return NextResponse.json({ received: true });
  }

  const payment = event.data;
  const metadata = readMetadata(payment?.metadata);
  const userId =
    typeof metadata.user_id === "string" ? metadata.user_id : null;
  const plan = metadata.plan;

  if (!userId || !isPaystackPlan(plan)) {
    console.error("[paystack-webhook] Charge is missing user or plan", {
      metadata,
    });
    return NextResponse.json(
      { error: "Payment metadata is incomplete." },
      { status: 400 }
    );
  }

  if (
    payment?.status !== "success" ||
    payment.currency !== PAYSTACK_CURRENCY ||
    payment.amount !== PAYSTACK_PLAN_AMOUNTS[plan]
  ) {
    console.error("[paystack-webhook] Payment amount or currency is invalid", {
      amount: payment?.amount,
      currency: payment?.currency,
      plan,
    });
    return NextResponse.json(
      { error: "Payment amount or currency is invalid." },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("profiles")
    .update({ plan })
    .eq("id", userId);

  if (error) {
    console.error("[paystack-webhook] Could not update profile plan", error);
    return NextResponse.json(
      { error: "Could not update the user plan." },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
}
