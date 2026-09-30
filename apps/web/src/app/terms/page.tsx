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

export default function TermsPage() {
  return (
    <MarketingLayout>
      <article style={{ maxWidth: 780, margin: "0 auto", padding: "44px 20px 64px" }}>
        <h1 style={{ fontSize: 34, fontWeight: 900, margin: "0 0 4px" }}>Terms &amp; Conditions</h1>
        <p className="muted" style={{ margin: 0 }}>Last updated: September 2026</p>

        <LegalSection title="About this site">
          centerestates.co.ke is operated by Center Estates to market properties for sale. By using the
          site or submitting an enquiry you agree to these terms.
        </LegalSection>

        <LegalSection title="Listing information">
          Prices, unit sizes, floor plans, images and construction progress are provided by project
          owners and are indicative until confirmed in writing in a signed sale agreement. Images may be
          artistic impressions of off-plan units. Availability shown on the site is updated regularly but
          is not a reservation — a unit is only held once a reservation is confirmed by our team.
        </LegalSection>

        <LegalSection title="Enquiries, reservations and deposits">
          Submitting an enquiry does not create a contract or obligation on either party. Reservations
          are made explicitly with a sales representative and may require a deposit, after which the
          unit is placed on hold for the stated reservation period. Failure to pay required deposits
          within the reservation period releases the unit. All purchases are completed under a separate
          written sale agreement, which governs in case of any conflict with these terms.
        </LegalSection>

        <LegalSection title="Acceptable use">
          You agree not to misuse the site — no scraping, unauthorized access, transmission of harmful
          code, or submitting false enquiry data. We may restrict access where misuse is detected.
        </LegalSection>

        <LegalSection title="Intellectual property">
          Site content — text, logos, renders and floor plans — belongs to Center Estates or its project
          partners and may not be reproduced without written permission.
        </LegalSection>

        <LegalSection title="Limitation of liability">
          To the maximum extent permitted by law, Center Estates is not liable for indirect or
          consequential loss arising from use of this site or reliance on listing information. Nothing
          in these terms excludes rights you have under applicable Kenyan consumer law.
        </LegalSection>

        <LegalSection title="Governing law">
          These terms are governed by the laws of Kenya. Disputes will be handled by the courts of Kenya
          unless the parties agree to another resolution.
        </LegalSection>

        <LegalSection title="Contact">
          Questions about these terms? Reach us via the <Link href="/contact">contact page</Link>.
        </LegalSection>
      </article>
    </MarketingLayout>
  );
}
