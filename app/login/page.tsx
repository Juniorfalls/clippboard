import type { Metadata } from "next";
import { LoginForm } from "@/components/LoginForm";

export const metadata: Metadata = {
  title: "Sign In",
  description:
    "Sign in to Clippboard securely with a magic link and start turning long videos into engaging short-form clips.",
  openGraph: {
    title: "Sign In | Clippboard",
    description:
      "Sign in to Clippboard securely with a magic link and access your AI video clipping workspace.",
    images: [
      {
        // Replace /public/og-image.png with the final social preview image.
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Clippboard sign-in",
      },
    ],
  },
};

export default function LoginPage() {
  return <LoginForm />;
}
