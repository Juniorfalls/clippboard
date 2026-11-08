import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="November 8, 2026">
      <p>
        These placeholder terms explain the basic rules for using Clippboard.
        They will be replaced with the full terms before launch.
      </p>
      <div>
        <h2 className="mb-2 text-[24px] font-bold leading-[1.25] text-soft-black">
          Using Clippboard
        </h2>
        <p>
          You must own or have permission to use the videos you upload. Do not
          use the service to create content that violates the law or the rights
          of others.
        </p>
      </div>
      <div>
        <h2 className="mb-2 text-[24px] font-bold leading-[1.25] text-soft-black">
          Your content
        </h2>
        <p>
          You retain ownership of your videos and projects. You grant us the
          limited rights needed to process your content and provide the service.
        </p>
      </div>
      <div>
        <h2 className="mb-2 text-[24px] font-bold leading-[1.25] text-soft-black">
          Contact
        </h2>
        <p>
          Questions about these terms can be sent to support@clippboard.com.
        </p>
      </div>
    </LegalPage>
  );
}
