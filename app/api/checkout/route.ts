import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/utils/supabase/server";
import type { Plan } from "@/lib/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function resolvePlan(priceId: string): Plan | null {
  if (priceId === process.env.STRIPE_PRICE_PRO) return "pro";
  if (priceId === process.env.STRIPE_PRICE_AGENCY) return "agency";
  return null;
}

export async function POST(request: Request) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return NextResponse.json(
      { error: "Stripe is not configured." },
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
    | { priceId?: unknown }
    | null;
  const priceId =
    typeof body?.priceId === "string" ? body.priceId.trim() : "";
  const plan = resolvePlan(priceId);

  if (!priceId || !plan) {
    return NextResponse.json(
      { error: "Choose a valid subscription plan." },
      { status: 400 }
    );
  }

  const origin = new URL(request.url).origin;

  try {
    const stripe = new Stripe(secretKey);
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: user.email,
      client_reference_id: user.id,
      metadata: { user_id: user.id, plan },
      subscription_data: {
        metadata: { user_id: user.id, plan },
      },
      success_url: `${origin}/dashboard?success=true`,
      cancel_url: `${origin}/#pricing`,
      allow_promotion_codes: true,
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Stripe did not return a checkout URL." },
        { status: 502 }
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("[checkout] Could not create Stripe session", error);
    return NextResponse.json(
      { error: "Checkout could not be started. Please try again." },
      { status: 502 }
    );
  }
}
