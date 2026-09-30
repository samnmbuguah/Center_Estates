"use client";

import Link from "next/link";
import { MarketingLayout } from "@/components/monitoring/pages/MarketingLayout";

function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 28 }}>
      <h2 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 8px" }}>{title}</h2>
      <div style={{ lineHeight: 1.7, color: "var(--muted, #555)" }}>{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <MarketingLayout>
      <article style={{ maxWidth: 780, margin: "0 auto", padding: "44px 20px 64px" }}>
        <h1 style={{ fontSize: 34, fontWeight: 900, margin: "0 0 4px" }}>Privacy Policy</h1>
        <p className="muted" style={{ margin: 0 }}>Last updated: September 2026</p>

        <LegalSection title="Who we are">
          Center Estates (“we”, “us”) operates centerestates.co.ke, a property sales platform in Kenya.
          This policy explains what we collect, why, and the choices you have.
        </LegalSection>

        <LegalSection title="Information you give us">
          When you submit an enquiry on a listing we collect your name, phone number, email address and
          message so our sales team can respond. Please avoid sharing sensitive information (ID numbers,
          bank details) in enquiry messages. Staff accounts on our platform are created by your
          organisation and carry the profile data your administrator provides.
        </LegalSection>

        <LegalSection title="Information collected automatically">
          Our servers may record standard technical data — IP address, browser type, pages viewed and
          timestamps — for security, abuse prevention and aggregate traffic statistics. We use essential
          cookies to keep signed-in sessions working; they cannot be disabled while using staff areas.
        </LegalSection>

        <LegalSection title="How we use your information">
          To respond to your enquiries, arrange site visits, send property information you asked for,
          improve the platform, and comply with legal obligations. We do not sell your personal data.
        </LegalSection>

        <LegalSection title="Sharing">
          Enquiry details are shared with our sales team and, where you request it, with project owners
          or agents involved in the listing you asked about. We share data with service providers
          (hosting, email, analytics) only to the extent needed to run the platform, under confidentiality
          obligations.
        </LegalSection>

        <LegalSection title="Retention and your rights">
          Enquiry records are retained while relevant to an active negotiation and for a reasonable
          period afterwards for legal and accounting purposes. Under Kenya’s Data Protection Act, 2019
          you may request access, correction or deletion of your personal data, and object to or restrict
          certain processing. Contact us using the details on our <Link href="/contact">contact page</Link>.
        </LegalSection>

        <LegalSection title="Changes">
          We may update this policy from time to time. Material changes will be highlighted on this page
          with a revised date.
        </LegalSection>
      </article>
    </MarketingLayout>
  );
}
