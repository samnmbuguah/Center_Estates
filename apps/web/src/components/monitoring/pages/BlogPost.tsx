import { ArrowLeft, CalendarDays, Clock, User } from "lucide-react";
import { Link, useParams } from "@/components/monitoring/react-router-shim";
import { BLOG_POSTS } from "./Blog";

const CONTENT: Record<string, string[]> = {
  "offline-first-construction-reporting": [
    "Construction sites are not offices. They are dusty, noisy, and — more often than not — completely offline. Yet the expectation from headquarters is the same: real-time progress data, daily logs, and photographic evidence of work completed.",
    "The reality is that most sites in Kenya and across East Africa have unreliable or non-existent internet connectivity. A cellular signal may reach the site office, but the active workface — where the pouring, fixing, and erecting happens — is almost certainly offline.",
    "This is where offline-first architecture becomes non-negotiable. The mobile app must work exactly the same way with or without an internet connection. Data is stored locally on the device, and synchronization happens automatically when connectivity is restored.",
    "<strong>What happens when connectivity drops?</strong>",
    "With an offline-first approach, the Clerk of Works continues capturing progress, taking photos, and recording observations. The app queues submissions locally. When the device enters a coverage zone, the sync engine pushes all pending data to the server in the background.",
    "The key design decisions are:",
    "Local-first storage — SQLite or similar embedded database on the device. Conflict-safe sync — if the same record was modified offline and on the server, the system resolves conflicts deterministically. Integrity-preserving — each submission is cryptographically signed on the device before sync, so the server can verify it wasn't tampered with.",
    "At MonitorERP, we built the mobile app around TinyBase and expo-sqlite with an Ed25519 signing layer. Every milestone submission carries a device-level signature that the server re-derives and verifies. This means even if the submission sat on a device for three days before syncing, the evidence chain remains intact and auditable.",
    "Offline-first isn't a nice-to-have for construction — it's a fundamental requirement. Without it, your site data is only as good as your cellular signal.",
  ],
  "clerk-of-works-digital-transformation": [
    "The Clerk of Works role is the backbone of construction quality assurance. Traditionally, this meant carrying a clipboard, a camera, and a stack of paper forms to site each day. Observations were handwritten, photos were printed and stapled, and weekly reports were compiled manually from scattered notes.",
    "Digital transformation for the CoW isn't about replacing their expertise — it's about removing the friction that comes with paper-based processes. The goal is to let the Clerk spend more time inspecting and less time filing.",
    "<strong>What changes with digital?</strong>",
    "Instead of writing notes by hand, the CoW taps structured fields on a mobile app — dropdowns for status, sliders for percentage complete, checkboxes for inspection items. Photos are captured in-app and automatically tagged with GPS coordinates, timestamps, and device identifiers.",
    "The daily log that used to take 30 minutes to compile now takes 5. The weekly report that required cutting and pasting from scattered notes is generated automatically from the week's submissions.",
    "<strong>What stays the same?</strong>",
    "The CoW remains the authoritative source of progress data. Technology supports but does not replace professional judgement. The digital signature on a milestone submission carries the same weight as a physical signature on a paper form — actually more, because it's cryptographically verifiable.",
    "The transition requires training, but the payoff is immediate. Teams that go digital see faster payment cycles (because certifiers have the evidence they need), fewer disputes (because the data is objective), and better project outcomes (because issues are visible in real time).",
  ],
  "construction-cost-control-variations": [
    "Cost overruns are the single biggest risk in construction projects. Studies consistently show that large infrastructure projects exceed their budgets by an average of 28%. The causes are well-known: design changes, unforeseen site conditions, material price fluctuations, and poor cost tracking.",
    "Effective cost control requires tracking every cost movement through its lifecycle. In MonitorERP, we model this as a state machine: Budgeted → Allowed → Ascertained → Committed → Certified → Paid.",
    "<strong>Variations</strong> handle changes to the original scope. A variation may be a construction change (different material, different dimension), a crystallised provisional sum, a contingency-funded item, or an administrative adjustment. Each variation is classified, auditable, and updates the revised budget.",
    "<strong>Provisional Sums (PS)</strong> are allowances for work that cannot be fully defined at the time of BoQ preparation. As the work is scoped, the PS is ascertained — either partially or fully. The ascertained amount moves from 'allowance' to 'committed cost', and the remaining unascertained PS becomes visible as exposure.",
    "<strong>Contingency</strong> is managed at project and element levels. Drawdowns require justification and professional approval. Once approved, the drawdown reduces available contingency and updates the forecast final cost.",
    "The dashboard shows all of these in a unified view: budget vs committed vs actual, PS ascertainment percentage, contingency consumption rate, forecast final cost, and remaining exposure. This gives project managers and financiers the complete picture without digging through spreadsheets.",
    "The key principle is traceability. Every cost movement is linked back to its source — a variation order, a PS ascertainment certificate, a contingency drawdown request. Auditors can follow the chain from final certificate back to the original BoQ item.",
  ],
  "biometric-milestone-verification": [
    "Disputes over completed work are one of the most common sources of friction between contractors and clients. The contractor says the milestone is 90% complete; the client's engineer says 60%. Without objective evidence, the argument boils down to who has more authority.",
    "Cryptographic signing changes this. When a Clerk of Works submits a milestone update, the mobile app signs the submission with a device-specific Ed25519 private key. The server derives the corresponding public key and verifies the signature. If even one byte of the submission is altered after signing, verification fails.",
    "This is not a simple checksum. Ed25519 is an asymmetric signature scheme — the private key never leaves the device, and the public key is stored on the server. This means:",
    "The device identity is bound to every submission. The server can prove which device (and therefore which user) created a record. The submission cannot be repudiated — the signer cannot later claim they didn't submit it. Any tampering with the data after submission is immediately detectable.",
    "Combined with biometric authentication on the device (fingerprint or face), this creates a strong chain of accountability. The Clerk authenticates biometrically to unlock the signing key, and the submission carries both the biometric assertion and the cryptographic signature.",
    "The result is milestone verification that is objective, auditable, and legally defensible. Payment triggers based on these milestones inherit the same integrity guarantees.",
  ],
  "geofenced-evidence-construction": [
    "\"The photo must have been taken somewhere else.\" Anyone who has worked on construction disputes has heard this. A contractor submits photos showing completed work, but the client suspects the photos were taken at a different site or on a different day.",
    "Geofencing eliminates this uncertainty. When a photo is captured through the MonitorERP mobile app, the device records the GPS coordinates at the moment of capture. If the device is outside the project's geofence boundary, the app flags the submission.",
    "This isn't optional metadata — it's locked at capture time. The coordinates are embedded in the submission payload and signed along with the rest of the data. Neither the user nor anyone else can alter the GPS coordinates after the photo is taken.",
    "The geofence is configured per project. For a building site, it might be a 50-meter radius around the plot boundaries. For a road project, it might be a corridor along the alignment. Submissions outside the geofence are still accepted but flagged for review.",
    "Photo evidence carries significantly more weight when it's geospatially anchored. A photo of a completed foundation with GPS coordinates matching the project location is much harder to dismiss than a photo with no location data.",
  ],
  "interim-payment-certificates-guide": [
    "An Interim Payment Certificate (IPC) is a formal document issued by the Engineer or Quantity Surveyor certifying the value of work completed during a specific period. It is the basis for payment applications and disbursements.",
    "A well-structured IPC includes several components:",
    "<strong>Certified Work Value</strong> — The value of work properly executed during the period, calculated as BoQ rates × verified quantities.",
    "<strong>Variations</strong> — Approved variations to the original contract sum, including construction changes, PS crystallisations, contingency-funded items, and administrative adjustments.",
    "<strong>PS & Contingency Adjustments</strong> — Amounts ascertained from provisional sums and contingency drawdowns approved during the period.",
    "<strong>Advance Recovery</strong> — Recovery of mobilisation advances or other prepayments, calculated per the agreed recovery rules (percentage of valuation, fixed amount, milestone-based, etc.).",
    "<strong>Retention</strong> — The contractually-agreed retention percentage deducted from the certified value. Staged release tracking shows amounts deducted, released, held, and outstanding.",
    "<strong>Net Payable</strong> — The final amount after all additions and deductions. This is the amount the contractor is entitled to be paid.",
    "In MonitorERP, IPCs are generated from the verified progress data. The QS/Engineer reviews the certificate, digitally certifies it, and the certificate is locked. Once locked, it cannot be modified — preserving a clean audit trail.",
    "Export to PDF and Excel is supported for submission to financiers, auditors, and client representatives.",
  ],
};

function renderSafeHtml(html: string): React.ReactNode {
  // Split on <strong> tags and render safely — no raw HTML injection
  const parts = html.split(/(<\/?strong>)/);
  const elements: React.ReactNode[] = [];
  let bold = false;
  for (const part of parts) {
    if (part === "<strong>") { bold = true; continue; }
    if (part === "</strong>") { bold = false; continue; }
    if (part) elements.push(bold ? <strong key={elements.length}>{part}</strong> : part);
  }
  return elements;
}

export function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const post = BLOG_POSTS.find(p => p.slug === slug);

  if (!post) {
    return (
      <section style={{ padding: "80px 24px", textAlign: "center" }}>
        <h2 style={{ fontSize: 28, marginBottom: 12 }}>Post not found</h2>
        <p style={{ color: "var(--muted)", marginBottom: 24 }}>The article you're looking for doesn't exist.</p>
        <Link to="/blog" className="btn">Back to Blog</Link>
      </section>
    );
  }

  const paragraphs = CONTENT[post.slug] ?? ["Content coming soon."];

  return (
    <article style={{ padding: "40px 24px 80px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <Link to="/blog" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 14, color: "var(--muted)", marginBottom: 24 }}>
          <ArrowLeft size={14} /> Back to Blog
        </Link>

        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 12, color: "var(--primary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
            {post.category}
          </div>
          <h1 style={{ fontSize: 34, lineHeight: 1.2, margin: "0 0 16px" }}>{post.title}</h1>
          <div style={{ display: "flex", gap: 20, fontSize: 14, color: "var(--faint)" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <User size={14} /> {post.author}
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <CalendarDays size={14} /> {post.date}
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <Clock size={14} /> {post.readTime}
            </span>
          </div>
        </div>

        <div style={{ fontSize: 16, lineHeight: 1.8, color: "var(--text)" }}>
          {paragraphs.map((p, i) => {
            if (p.startsWith("<strong>")) {
              return <p key={i} style={{ fontWeight: 600, fontSize: 18, marginTop: 28, marginBottom: 8 }}>{renderSafeHtml(p)}</p>;
            }
            return <p key={i} style={{ marginBottom: 16 }}>{renderSafeHtml(p)}</p>;
          })}
        </div>
      </div>
    </article>
  );
}
