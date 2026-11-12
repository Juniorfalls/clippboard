import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
  isPaystackPlan,
  PAYSTACK_PLAN_AMOUNTS,
} from "@/lib/paystack";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type InvoiceResponse = {
  invoice_url?: string;
  message?: string;
};

export async function POST(request: Request) {
  const apiKey = process.env.NOWPAYMENTS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Crypto payments are not configured." },
      { status: 500 }
    );
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | { plan?: unknown }
    | null;
  const plan = body?.plan;

  if (!isPaystackPlan(plan)) {
    return NextResponse.json(
      { error: "Choose a valid subscription plan." },
      { status: 400 }
    );
  }

  const origin = new URL(request.url).origin;
  const priceAmount = PAYSTACK_PLAN_AMOUNTS[plan] / 100;

  try {
    const response = await fetch("https://api.nowpayments.io/v1/invoice", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        price_amount: priceAmount,
        price_currency: "usd",
        order_id: user.id,
        order_description: `clippboard:${plan}`,
        ipn_callback_url: `${origin}/api/webhooks/crypto`,
        success_url: `${origin}/dashboard?crypto=success`,
        cancel_url: `${origin}/#pricing`,
        is_fixed_rate: true,
        is_fee_paid_by_user: false,
      }),
    });

    const data = (await response.json().catch(() => null)) as
      | InvoiceResponse
      | null;

    if (!response.ok || !data?.invoice_url) {
      console.error("[crypto-checkout] NOWPayments did not return an invoice", {
        status: response.status,
        message: data?.message,
      });
      return NextResponse.json(
        { error: "Crypto checkout could not be started." },
        { status: 502 }
      );
    }

    return NextResponse.json({ url: data.invoice_url });
  } catch (error) {
    console.error("[crypto-checkout] Could not create the invoice", error);
    return NextResponse.json(
      { error: "Crypto checkout could not be started. Please try again." },
      { status: 502 }
    );
  }
}
