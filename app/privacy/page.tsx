import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="November 8, 2026">
      <p>
        Clippboard is designed to process video securely. This placeholder page
        will be replaced with the full privacy policy before launch.
      </p>
      <div>
        <h2 className="mb-2 text-[24px] font-bold leading-[1.25] text-soft-black">
          Information we collect
        </h2>
        <p>
          We collect the account information you provide, such as your email
          address, and the project data you create while using the workspace.
        </p>
      </div>
      <div>
        <h2 className="mb-2 text-[24px] font-bold leading-[1.25] text-soft-black">
          How your videos are processed
        </h2>
        <p>
          Video rendering happens in your browser. Only the audio needed for AI
          analysis and the text you submit to our tools are sent to our
          processing providers.
        </p>
      </div>
      <div>
        <h2 className="mb-2 text-[24px] font-bold leading-[1.25] text-soft-black">
          Contact
        </h2>
        <p>
          Questions about privacy can be sent to privacy@clippboard.com.
        </p>
      </div>
    </LegalPage>
  );
}
