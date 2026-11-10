import type { Metadata } from "next";
import { LoginForm } from "@/components/LoginForm";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Sign In",
  description:
    "Sign in to Clippboard securely with a 6-digit email code and start turning long videos into engaging short-form clips.",
  alternates: { canonical: `${SITE_URL}/login` },
  openGraph: {
    title: "Sign In | Clippboard",
    url: `${SITE_URL}/login`,
    description:
      "Sign in to Clippboard securely with a 6-digit email code and access your AI video clipping workspace.",
    images: [
      {
        url: `${SITE_URL}/og-image.png`,
        width: 1200,
        height: 630,
        alt: "Clippboard sign-in",
      },
    ],
  },
};

export default function LoginPage({
  searchParams,
}: {
  searchParams?: { next?: string };
}) {
  const nextPath =
    typeof searchParams?.next === "string" &&
    searchParams.next.startsWith("/") &&
    !searchParams.next.startsWith("//")
      ? searchParams.next
      : undefined;

  return <LoginForm nextPath={nextPath} />;
}
