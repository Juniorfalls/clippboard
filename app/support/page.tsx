"use client";

import { useState, type FormEvent } from "react";
import { Loader2, Mail, MessageSquareText, Send, UserRound } from "lucide-react";
import { toast } from "sonner";
import { CustomTextArea } from "@/components/CustomTextArea";
import { cn } from "@/lib/utils";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-brand-blue";

const inputClass = cn(
  "block w-full rounded-2xl border border-border-gray bg-white px-4 py-3 text-[16px] text-soft-black placeholder:text-soft-black/40 duration-200",
  focusRing
);

export default function SupportPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!name.trim()) {
      toast.error("Add your name");
      return;
    }

    if (!EMAIL_PATTERN.test(email.trim())) {
      toast.error("Enter a valid email address");
      return;
    }

    if (message.trim().length < 10) {
      toast.error("Add a little more detail", {
        description: "Your message should be at least 10 characters.",
      });
      return;
    }

    setIsSubmitting(true);
    await new Promise((resolve) => setTimeout(resolve, 500));

    toast.success("Message sent! We'll get back to you within 24 hours.");
    setName("");
    setEmail("");
    setMessage("");
    setIsSubmitting(false);
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <header className="flex flex-col gap-3">
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-brand-blue-light bg-brand-blue-light/50 px-3 py-1.5 text-[12px] font-semibold text-soft-black/70">
          <MessageSquareText className="h-4 w-4 text-brand-blue" aria-hidden />
          Support
        </span>
        <h1 className="text-[40px] font-bold leading-[1] -tracking-1 md:text-[48px]">
          Contact Support
        </h1>
        <p className="max-w-xl text-[16px] text-soft-black/70 md:text-[18px]">
          Need help with your account or have a feature request? We&apos;re here
          for you.
        </p>
      </header>

      <form
        onSubmit={handleSubmit}
        noValidate
        className="flex flex-col gap-5 rounded-3 border border-border-gray bg-white p-6 sm:p-8"
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="support-name" className="text-[14px] font-semibold text-soft-black">
              Name
            </label>
            <div className="relative">
              <UserRound
                className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-soft-black/35"
                aria-hidden
              />
              <input
                id="support-name"
                name="name"
                autoComplete="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Your name"
                className={cn(inputClass, "pl-11")}
                maxLength={100}
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="support-email" className="text-[14px] font-semibold text-soft-black">
              Email
            </label>
            <div className="relative">
              <Mail
                className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-soft-black/35"
                aria-hidden
              />
              <input
                id="support-email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                spellCheck={false}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                className={cn(inputClass, "pl-11")}
                maxLength={254}
                disabled={isSubmitting}
              />
            </div>
          </div>
        </div>

        <CustomTextArea
          label="Message"
          value={message}
          onChange={setMessage}
          placeholder="Tell us what you need help with..."
          hint="Include your workspace email if it is different from the one above."
          maxLength={1000}
          rows={6}
          disabled={isSubmitting}
        />

        <button
          type="submit"
          disabled={isSubmitting}
          aria-busy={isSubmitting}
          className={cn(
            "inline-flex w-fit items-center justify-center gap-2 rounded-2 bg-brand-blue px-6 py-3 text-[16px] font-semibold text-soft-black duration-200 hover:bg-brand-blue-hover disabled:cursor-not-allowed disabled:bg-brand-blue-light disabled:text-soft-black/60",
            focusRing
          )}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Sending message...
            </>
          ) : (
            <>
              <Send className="h-4 w-4" aria-hidden />
              Send message
            </>
          )}
        </button>
      </form>
    </div>
  );
}
