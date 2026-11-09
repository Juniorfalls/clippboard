"use client";

import {
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Loader2,
  Mail,
  MailCheck,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/Logo";
import { createClient } from "@/utils/supabase/client";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OTP_LENGTH = 6;
const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-brand-blue";

const AUTH_ERRORS: Record<string, string> = {
  "expired-link": "That login code has expired. Request a new one below.",
  "missing-code": "That login code is incomplete. Request a new one below.",
};

function emptyCode() {
  return Array.from({ length: OTP_LENGTH }, () => "");
}

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState<string[]>(emptyCode);
  const [codeError, setCodeError] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const codeInputs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authError = params.get("error");

    if (!authError) return;

    toast.error("Could not sign you in", {
      description:
        AUTH_ERRORS[authError] ?? "Please request a new login code.",
    });

    window.history.replaceState({}, "", "/login");
  }, []);

  function resetCode() {
    setCode(emptyCode());
    setCodeError("");
    window.requestAnimationFrame(() => codeInputs.current[0]?.focus());
  }

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
        options: { shouldCreateUser: true },
      });

      if (authError) throw authError;

      setSentTo(normalizedEmail);
      setCode(emptyCode());
      setCodeError("");
      toast.success("Login code sent", {
        description: `Check ${normalizedEmail} for your 6-digit code.`,
      });
    } catch (authError) {
      const message =
        authError instanceof Error
          ? authError.message
          : "Please try again in a moment.";

      setError(message);
      toast.error("Could not send login code", { description: message });
    } finally {
      setIsSubmitting(false);
    }
  }

  function setCodeDigit(index: number, value: string) {
    setCode((current) => {
      const next = [...current];
      next[index] = value;
      return next;
    });
    if (value && index < OTP_LENGTH - 1) {
      codeInputs.current[index + 1]?.focus();
    }
  }

  function fillCode(startIndex: number, value: string) {
    const digits = value.replace(/\D/g, "").slice(0, OTP_LENGTH - startIndex);
    if (!digits) return;

    setCode((current) => {
      const next = [...current];
      digits.split("").forEach((digit, offset) => {
        next[startIndex + offset] = digit;
      });
      return next;
    });
    setCodeError("");

    const lastIndex = Math.min(
      startIndex + digits.length,
      OTP_LENGTH - 1
    );
    codeInputs.current[lastIndex]?.focus();
  }

  function handleCodeChange(index: number, value: string) {
    const digits = value.replace(/\D/g, "");
    setCodeError("");

    if (!digits) {
      setCodeDigit(index, "");
      return;
    }

    if (digits.length > 1) {
      fillCode(index, digits);
      return;
    }

    setCodeDigit(index, digits);
  }

  function handleCodeKeyDown(
    index: number,
    event: KeyboardEvent<HTMLInputElement>
  ) {
    if (event.key === "Backspace" && !code[index] && index > 0) {
      event.preventDefault();
      codeInputs.current[index - 1]?.focus();
    }

    if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      codeInputs.current[index - 1]?.focus();
    }

    if (event.key === "ArrowRight" && index < OTP_LENGTH - 1) {
      event.preventDefault();
      codeInputs.current[index + 1]?.focus();
    }
  }

  function handleCodePaste(
    index: number,
    event: ClipboardEvent<HTMLInputElement>
  ) {
    const pasted = event.clipboardData.getData("text");
    if (!/\d/.test(pasted)) return;
    event.preventDefault();
    fillCode(index, pasted);
  }

  async function handleVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!sentTo) return;

    const token = code.join("");
    if (token.length !== OTP_LENGTH) {
      setCodeError("Enter all 6 digits.");
      toast.error("Code is incomplete", {
        description: "Enter all 6 digits from your email.",
      });
      return;
    }

    setCodeError("");
    setIsVerifying(true);

    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.verifyOtp({
        email: sentTo,
        token,
        type: "email",
      });

      if (authError) throw authError;

      toast.success("Signed in");
      router.replace("/dashboard");
      router.refresh();
    } catch (authError) {
      const message =
        authError instanceof Error
          ? authError.message
          : "The code could not be verified.";

      setCodeError(message);
      toast.error("Invalid or expired code", { description: message });
    } finally {
      setIsVerifying(false);
    }
  }

  async function handleResend() {
    if (!sentTo) return;

    setIsResending(true);

    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithOtp({
        email: sentTo,
        options: { shouldCreateUser: true },
      });

      if (authError) throw authError;

      resetCode();
      toast.success("A new login code is on its way", {
        description: `Check ${sentTo} for the new 6-digit code.`,
      });
    } catch (authError) {
      const message =
        authError instanceof Error
          ? authError.message
          : "Please try again in a moment.";
      toast.error("Could not resend code", { description: message });
    } finally {
      setIsResending(false);
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
            <div>
              <div className="flex flex-col items-center text-center">
                <span className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-blue-light text-brand-blue">
                  <MailCheck className="h-7 w-7" aria-hidden="true" />
                </span>
                <h1 className="text-[32px] font-bold leading-[1.1] -tracking-1 text-soft-black">
                  Check your email
                </h1>
                <p className="mt-3 text-[16px] text-soft-black/60">
                  We sent a 6-digit code to{" "}
                  <span className="font-semibold text-soft-black">{sentTo}</span>.
                  Enter it below.
                </p>
              </div>

              <form className="mt-7" onSubmit={handleVerify} noValidate>
                <div
                  className="grid grid-cols-6 gap-2"
                  role="group"
                  aria-label="6-digit login code"
                >
                  {code.map((digit, index) => (
                    <input
                      key={index}
                      ref={(element) => {
                        codeInputs.current[index] = element;
                      }}
                      type="text"
                      inputMode="numeric"
                      autoComplete={index === 0 ? "one-time-code" : "off"}
                      autoFocus={index === 0}
                      maxLength={1}
                      value={digit}
                      onChange={(event) =>
                        handleCodeChange(index, event.target.value)
                      }
                      onKeyDown={(event) => handleCodeKeyDown(index, event)}
                      onPaste={(event) => handleCodePaste(index, event)}
                      aria-label={`Digit ${index + 1} of ${OTP_LENGTH}`}
                      aria-invalid={Boolean(codeError)}
                      disabled={isVerifying}
                      className={`h-14 w-full rounded-2 border bg-warm-white text-center text-[24px] font-bold text-soft-black duration-200 disabled:opacity-60 ${
                        codeError
                          ? "border-red-300"
                          : "border-transparent focus:border-brand-blue"
                      } ${focusRing}`}
                    />
                  ))}
                </div>

                {codeError && (
                  <p className="mt-2 text-center text-[13px] text-red-600">
                    {codeError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={isVerifying}
                  aria-busy={isVerifying}
                  className={`group mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2 bg-brand-blue px-4 py-3 text-[16px] font-semibold text-soft-black duration-200 hover:bg-brand-blue-hover disabled:cursor-not-allowed disabled:bg-brand-blue-light disabled:text-soft-black/60 xs:rounded-3 ${focusRing}`}
                >
                  {isVerifying ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      Verify Code
                      <ArrowRight
                        className="h-4 w-4 duration-200 group-hover:translate-x-0.5"
                        aria-hidden="true"
                      />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-5 flex flex-col items-center gap-3 text-center">
                <button
                  type="button"
                  onClick={() => void handleResend()}
                  disabled={isResending}
                  className={`text-[13px] font-semibold text-soft-black/60 duration-200 hover:text-brand-blue disabled:opacity-60 ${focusRing}`}
                >
                  {isResending ? "Sending a new code..." : "Didn't get it? Resend code"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSentTo(null);
                    setCode(emptyCode());
                    setCodeError("");
                  }}
                  className={`text-[13px] font-semibold text-soft-black/60 duration-200 hover:text-brand-blue ${focusRing}`}
                >
                  Use a different email
                </button>
              </div>
            </div>
          ) : (
            <>
              <div>
                <h1 className="text-[32px] font-bold leading-[1.1] -tracking-1 text-soft-black">
                  Sign in
                </h1>
                <p className="mt-2 text-[14px] text-soft-black/60">
                  Enter your email and we will send you a 6-digit login code. No
                  password needed.
                </p>
              </div>

              <div className="mt-5 flex gap-2 rounded-2xl bg-warm-white px-3 py-2.5 text-[12px] text-soft-black/60">
                <ShieldCheck
                  className="mt-0.5 h-4 w-4 shrink-0 text-brand-blue"
                  aria-hidden="true"
                />
                <p>
                  Securely access your AI video workspace. Your video is
                  processed in your browser.
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
                      aria-hidden="true"
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
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      Sending code...
                    </>
                  ) : (
                    <>
                      Send Login Code
                      <ArrowRight
                        className="h-4 w-4 duration-200 group-hover:translate-x-0.5"
                        aria-hidden="true"
                      />
                    </>
                  )}
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
