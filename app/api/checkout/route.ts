import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { Paystack } from "@paystack/paystack-sdk";
import { createClient } from "@/utils/supabase/server";
import {
  isPaystackPlan,
  PAYSTACK_CURRENCY,
  PAYSTACK_PLAN_AMOUNTS,
} from "@/lib/paystack";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type InitializeData = {
  authorization_url?: string;
  access_code?: string;
  reference?: string;
};

export async function POST(request: Request) {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    return NextResponse.json(
      { error: "Paystack is not configured." },
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

  if (!user.email) {
    return NextResponse.json(
      { error: "Your account does not have an email address." },
      { status: 400 }
    );
  }

  const origin = new URL(request.url).origin;
  const reference = `clippboard_${user.id.slice(0, 8)}_${randomUUID()}`;

  try {
    const paystack = new Paystack(secretKey);
    const result = await paystack.transaction.initialize({
      email: user.email,
      amount: PAYSTACK_PLAN_AMOUNTS[plan],
      currency: PAYSTACK_CURRENCY,
      reference,
      callback_url: `${origin}/dashboard?success=true`,
      metadata: JSON.stringify({ user_id: user.id, plan }),
    });
    const data = result.data as InitializeData | undefined;

    if (!result.status || !data?.authorization_url) {
      console.error("[checkout] Paystack did not return an authorization URL", {
        message: result.message,
      });
      return NextResponse.json(
        { error: "Paystack did not return a checkout URL." },
        { status: 502 }
      );
    }

    return NextResponse.json({
      url: data.authorization_url,
      reference: data.reference ?? reference,
    });
  } catch (error) {
    console.error("[checkout] Could not initialize Paystack transaction", error);
    return NextResponse.json(
      { error: "Checkout could not be started. Please try again." },
      { status: 502 }
    );
  }
}
