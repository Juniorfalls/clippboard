import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import {
  isPaystackPlan,
  PAYSTACK_PLAN_AMOUNTS,
} from "@/lib/paystack";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CryptoPayment = {
  payment_status?: string;
  order_id?: string;
  order_description?: string;
  price_amount?: number | string;
  price_currency?: string;
};

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((result, key) => {
        result[key] = sortValue((value as Record<string, unknown>)[key]);
        return result;
      }, {});
  }
  return value;
}

function hasValidSignature(payload: unknown, signature: string, secret: string) {
  const expected = createHmac("sha512", secret)
    .update(JSON.stringify(sortValue(payload)))
    .digest("hex");
  const expectedBuffer = Buffer.from(expected, "utf8");
  const signatureBuffer = Buffer.from(signature, "utf8");

  return (
    expectedBuffer.length === signatureBuffer.length &&
    timingSafeEqual(expectedBuffer, signatureBuffer)
  );
}

function resolvePlan(payment: CryptoPayment) {
  const description = payment.order_description?.toLowerCase() ?? "";
  const describedPlan = description.includes("agency")
    ? "agency"
    : description.includes("pro")
      ? "pro"
      : null;

  if (describedPlan) return describedPlan;

  const amount = Number(payment.price_amount);
  if (amount === 19) return "pro";
  if (amount === 49) return "agency";
  return null;
}

export async function POST(request: Request) {
  const secret = process.env.NOWPAYMENTS_IPN_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Crypto webhooks are not configured." },
      { status: 500 }
    );
  }

  const signature = request.headers.get("x-nowpayments-sig");
  if (!signature) {
    return NextResponse.json(
      { error: "Missing crypto payment signature." },
      { status: 401 }
    );
  }

  const payload = await request.text();

  let payment: CryptoPayment;
  try {
    payment = JSON.parse(payload) as CryptoPayment;
  } catch {
    return NextResponse.json(
      { error: "Invalid crypto payment payload." },
      { status: 400 }
    );
  }

  if (!hasValidSignature(payment, signature, secret)) {
    return NextResponse.json(
      { error: "Invalid crypto payment signature." },
      { status: 401 }
    );
  }

  if (
    payment.payment_status !== "confirmed" &&
    payment.payment_status !== "finished"
  ) {
    return NextResponse.json({ received: true });
  }

  const userId = payment.order_id;
  const plan = resolvePlan(payment);

  if (!userId || !isPaystackPlan(plan)) {
    console.error("[crypto-webhook] Payment is missing a user or plan", {
      orderId: payment.order_id,
      description: payment.order_description,
    });
    return NextResponse.json(
      { error: "Payment information is incomplete." },
      { status: 400 }
    );
  }

  const expectedAmount = PAYSTACK_PLAN_AMOUNTS[plan] / 100;
  if (
    payment.price_currency?.toLowerCase() !== "usd" ||
    Number(payment.price_amount) !== expectedAmount
  ) {
    console.error("[crypto-webhook] Payment amount or currency is invalid", {
      amount: payment.price_amount,
      currency: payment.price_currency,
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
    console.error("[crypto-webhook] Could not update profile plan", error);
    return NextResponse.json(
      { error: "Could not update the user plan." },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
}
