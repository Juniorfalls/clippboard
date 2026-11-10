import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createAdminClient } from "@/utils/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secretKey || !webhookSecret) {
    return NextResponse.json(
      { error: "Stripe webhooks are not configured." },
      { status: 500 }
    );
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json(
      { error: "Missing Stripe signature." },
      { status: 400 }
    );
  }

  const payload = await request.text();
  let event: Stripe.Event;

  try {
    const stripe = new Stripe(secretKey);
    event = stripe.webhooks.constructEvent(
      payload,
      signature,
      webhookSecret
    );
  } catch (error) {
    console.error("[stripe-webhook] Signature verification failed", error);
    return NextResponse.json(
      { error: "Invalid Stripe signature." },
      { status: 400 }
    );
  }

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const userId =
    session.metadata?.user_id ?? session.client_reference_id ?? null;
  const plan = session.metadata?.plan;

  if (!userId || (plan !== "pro" && plan !== "agency")) {
    console.error("[stripe-webhook] Checkout session is missing user or plan", {
      sessionId: session.id,
    });
    return NextResponse.json(
      { error: "Checkout session metadata is incomplete." },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("profiles")
    .update({ plan })
    .eq("id", userId);

  if (error) {
    console.error("[stripe-webhook] Could not update profile plan", error);
    return NextResponse.json(
      { error: "Could not update the user plan." },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
}
