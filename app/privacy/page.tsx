import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy Policy",
  alternates: { canonical: `${SITE_URL}/privacy` },
};

const heading = "mb-2 text-[24px] font-bold leading-[1.25] text-soft-black";

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="November 8, 2026">
      <p>
        This Privacy Policy explains how Clippboard collects, uses, and protects
        information when you use our website, workspace, and related services.
        It is standard placeholder copy and should be reviewed by legal counsel
        before launch.
      </p>
      <div>
        <h2 className={heading}>Information we collect</h2>
        <p>
          We collect account details such as your name, email address, and
          company name. We also store the projects, clips, captions, brand
          settings, and publishing preferences you create in the workspace.
        </p>
      </div>
      <div>
        <h2 className={heading}>How we use information</h2>
        <p>
          We use your information to provide the service, process video
          analysis requests, render and store clips, connect publishing
          accounts, respond to support requests, prevent abuse, and improve the
          product.
        </p>
      </div>
      <div>
        <h2 className={heading}>Video processing</h2>
        <p>
          Video rendering happens in your browser. Only the audio, transcript,
          prompts, and related metadata needed for AI analysis are sent to our
          processing providers. Rendered clips may be stored in encrypted cloud
          storage so you can publish and revisit them.
        </p>
      </div>
      <div>
        <h2 className={heading}>Sharing and service providers</h2>
        <p>
          We share information with vendors that help us operate Clippboard,
          including hosting, authentication, storage, analytics, AI processing,
          and social publishing providers. We do not sell your personal
          information.
        </p>
      </div>
      <div>
        <h2 className={heading}>Retention and security</h2>
        <p>
          We retain account and project information for as long as needed to
          provide the service or meet legal obligations. We use access controls,
          encryption for connected-account tokens, and other safeguards, but no
          system can guarantee absolute security.
        </p>
      </div>
      <div>
        <h2 className={heading}>Cookies and analytics</h2>
        <p>
          We use essential cookies for authentication and may use privacy-minded
          analytics to understand product usage. You can control cookies through
          your browser settings, though some features may not work without them.
        </p>
      </div>
      <div>
        <h2 className={heading}>Your choices and rights</h2>
        <p>
          Depending on your location, you may request access, correction,
          export, or deletion of your personal information. You can also
          disconnect social accounts and delete projects from the workspace.
        </p>
      </div>
      <div>
        <h2 className={heading}>Changes to this policy</h2>
        <p>
          We may update this policy as the service evolves. We will post the
          revised version on this page and update the date above. Continued use
          after an update means you accept the revised policy.
        </p>
      </div>
      <div>
        <h2 className={heading}>Contact</h2>
        <p>
          Questions about privacy can be sent to privacy@clippboard.com.
        </p>
      </div>
    </LegalPage>
  );
}
