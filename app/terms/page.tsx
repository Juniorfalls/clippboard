import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms of Service",
  alternates: { canonical: `${SITE_URL}/terms` },
};

const heading = "mb-2 text-[24px] font-bold leading-[1.25] text-soft-black";

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="November 8, 2026">
      <p>
        These Terms of Service govern your use of Clippboard. By creating an
        account or using the service, you agree to these terms. This is standard
        placeholder copy and should be reviewed by legal counsel before launch.
      </p>
      <div>
        <h2 className={heading}>Using Clippboard</h2>
        <p>
          You must be old enough to form a binding contract and must provide
          accurate account information. You are responsible for activity under
          your account and for keeping your login credentials secure.
        </p>
      </div>
      <div>
        <h2 className={heading}>Your content</h2>
        <p>
          You retain ownership of the videos, audio, transcripts, and other
          content you upload. You grant us the limited rights needed to host,
          process, render, store, and publish that content when you ask us to.
          You must own or have permission to use everything you upload.
        </p>
      </div>
      <div>
        <h2 className={heading}>Acceptable use</h2>
        <p>
          Do not use Clippboard to break the law, infringe intellectual property,
          distribute malware, harass others, evade platform rules, or interfere
          with the security and operation of the service. We may suspend accounts
          that violate these rules.
        </p>
      </div>
      <div>
        <h2 className={heading}>Plans and billing</h2>
        <p>
          Paid plans renew automatically until cancelled. Prices, limits, and
          features may change with notice. Unless required by law, payments are
          non-refundable. Free plans and trials may have usage limits or
          watermarks.
        </p>
      </div>
      <div>
        <h2 className={heading}>Social integrations</h2>
        <p>
          When you connect TikTok, YouTube, or another platform, you authorize
          us to upload and schedule content on your behalf. You must comply with
          that platform&apos;s terms. A connected account may be disconnected at
          any time from Settings.
        </p>
      </div>
      <div>
        <h2 className={heading}>Third-party services</h2>
        <p>
          Clippboard relies on third-party providers for hosting, AI processing,
          storage, analytics, and publishing. We are not responsible for
          third-party services, and their terms may apply to your use of them.
        </p>
      </div>
      <div>
        <h2 className={heading}>Disclaimers</h2>
        <p>
          The service is provided &quot;as is&quot; and &quot;as available.&quot;
          We do not guarantee uninterrupted operation, error-free processing, or
          any particular commercial result from using Clippboard.
        </p>
      </div>
      <div>
        <h2 className={heading}>Limitation of liability</h2>
        <p>
          To the extent permitted by law, Clippboard is not liable for indirect,
          incidental, special, consequential, or punitive damages, or for lost
          profits, data, or content. Our total liability is limited to the amount
          you paid us in the twelve months before the claim.
        </p>
      </div>
      <div>
        <h2 className={heading}>Termination</h2>
        <p>
          You may stop using the service at any time. We may suspend or terminate
          access if you violate these terms, create risk for other users, or if
          we discontinue the service. Provisions that by nature should survive
          termination will continue to apply.
        </p>
      </div>
      <div>
        <h2 className={heading}>Changes to these terms</h2>
        <p>
          We may update these terms as the service evolves. We will post the
          revised version on this page and update the date above. Continued use
          after an update means you accept the revised terms.
        </p>
      </div>
      <div>
        <h2 className={heading}>Contact</h2>
        <p>
          Questions about these terms can be sent to support@clippboard.com.
        </p>
      </div>
    </LegalPage>
  );
}
