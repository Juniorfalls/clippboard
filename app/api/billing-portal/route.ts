import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Mock Stripe billing portal. Replace this redirect with a real
  // stripe.billingPortal.sessions.create call when billing keys are added.
  return NextResponse.redirect(
    new URL("/dashboard/settings?billing=portal", request.url)
  );
}
