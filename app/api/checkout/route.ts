import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
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
  const plan = body?.plan === "agency" ? "agency" : "pro";

  // Mock Stripe Checkout. Replace with stripe.checkout.sessions.create using
  // price IDs from STRIPE_PRICE_PRO / STRIPE_PRICE_AGENCY when keys are added.
  const session = {
    id: `mock_cs_${user.id.slice(0, 8)}_${Date.now()}`,
    plan,
  };

  return NextResponse.json({
    sessionId: session.id,
    url: `/dashboard?checkout=mock&plan=${plan}`,
  });
}
