"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, Mail, MailCheck, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/Logo";
import { createClient } from "@/utils/supabase/client";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-brand-blue";

const AUTH_ERRORS: Record<string, string> = {
  "expired-link": "That sign-in link has expired. Request a new one below.",
  "missing-code": "That sign-in link is incomplete. Request a new one below.",
};

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authError = params.get("error");

    if (!authError) return;

    toast.error("Could not sign you in", {
      description: AUTH_ERRORS[authError] ?? "Please request a new sign-in link.",
    });

    window.history.replaceState({}, "", "/login");
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setError("Enter your email address.");
      toast.error("Email is required", {
        description: "Enter the email address linked to your Clippboard account.",
      });
      return;
    }

    if (
      normalizedEmail.length > 254 ||
      !EMAIL_PATTERN.test(normalizedEmail)
    ) {
      setError("Enter a valid email address.");
      toast.error("That email does not look right", {
        description: "Check for a typo and try again.",
      });
      return;
    }

    setError("");
    setIsSubmitting(true);

    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
          shouldCreateUser: true,
        },
      });

      if (authError) {
        throw authError;
      }

      setSentTo(normalizedEmail);
      toast.success("Magic link sent", {
        description: `Check ${normalizedEmail} for your sign-in link.`,
      });
    } catch (authError) {
      const message =
        authError instanceof Error
          ? authError.message
          : "Please try again in a moment.";

      setError(message);
      toast.error("Could not send magic link", { description: message });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-warm-white px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo />
          <p className="mt-2 text-[14px] font-semibold text-soft-black/50">
            AI Video Clipping Workspace
          </p>
        </div>

        <section className="rounded-3 border border-border-gray bg-white p-6 shadow-xl shadow-soft-black/5 sm:p-8">
          {sentTo ? (
            <div className="flex flex-col items-center text-center">
              <span className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-blue-light text-brand-blue">
                <MailCheck className="h-7 w-7" aria-hidden />
              </span>
              <h1 className="text-[32px] font-bold leading-[1.1] -tracking-1 text-soft-black">
                Check your inbox
              </h1>
              <p className="mt-3 text-[16px] text-soft-black/60">
                We sent a secure sign-in link to{" "}
                <span className="font-semibold text-soft-black">{sentTo}</span>.
              </p>
              <p className="mt-2 text-[14px] text-soft-black/50">
                The link expires shortly. Check your spam folder if it does not
                arrive.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSentTo(null);
                  setError("");
                }}
                className={`mt-6 inline-flex w-full items-center justify-center rounded-2 bg-warm-white px-4 py-3 text-[16px] font-semibold text-soft-black duration-200 hover:bg-brand-blue-light ${focusRing}`}
              >
                Use a different email
              </button>
            </div>
          ) : (
            <>
              <div>
                <h1 className="text-[32px] font-bold leading-[1.1] -tracking-1 text-soft-black">
                  Sign in
                </h1>
                <p className="mt-2 text-[14px] text-soft-black/60">
                  Enter your email and we will send you a secure magic link. No
                  password needed.
                </p>
              </div>

              <div className="mt-5 flex gap-2 rounded-2xl bg-warm-white px-3 py-2.5 text-[12px] text-soft-black/60">
                <ShieldCheck
                  className="mt-0.5 h-4 w-4 shrink-0 text-brand-blue"
                  aria-hidden
                />
                <p>
                  This workspace uses client-side rendering. Access is limited
                  to authorised creators.
                </p>
              </div>

              <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="email"
                    className="text-[14px] font-semibold text-soft-black"
                  >
                    Email
                  </label>
                  <div className="relative">
                    <Mail
                      className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-soft-black/40"
                      aria-hidden
                    />
                    <input
                      id="email"
                      name="email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      autoFocus
                      spellCheck={false}
                      value={email}
                      onChange={(event) => {
                        setEmail(event.target.value);
                        if (error) setError("");
                      }}
                      placeholder="you@example.com"
                      aria-required="true"
                      aria-invalid={Boolean(error)}
                      aria-describedby={error ? "email-error" : undefined}
                      disabled={isSubmitting}
                      className={`block w-full rounded-2 border-0 bg-warm-white py-3 pl-11 pr-4 text-[16px] text-soft-black placeholder:text-soft-black/40 duration-200 disabled:opacity-60 ${focusRing}`}
                    />
                  </div>
                  {error && (
                    <p id="email-error" className="text-[13px] text-red-600">
                      {error}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  aria-busy={isSubmitting}
                  className={`group inline-flex w-full items-center justify-center gap-2 rounded-2 bg-brand-blue px-4 py-3 text-[16px] font-semibold text-soft-black duration-200 hover:bg-brand-blue-hover disabled:cursor-not-allowed disabled:bg-brand-blue-light disabled:text-soft-black/60 xs:rounded-3 ${focusRing}`}
                >
                  {isSubmitting ? "Sending link..." : "Send magic link"}
                  <ArrowRight
                    className="h-4 w-4 duration-200 group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </button>
              </form>
            </>
          )}
        </section>

        <p className="mt-6 text-center text-[12px] text-soft-black/40">
          Browser-based processing · keep tab open during export
        </p>
      </div>
    </main>
  );
}
