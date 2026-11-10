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

  // Billing management is not yet connected to the Paystack dashboard.
  return NextResponse.redirect(
    new URL("/dashboard/settings?billing=portal", request.url)
  );
}
