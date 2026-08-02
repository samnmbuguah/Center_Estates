import { CalendarDays, Clock, User } from "lucide-react";
import { Link } from "@/components/monitoring/react-router-shim";

interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  author: string;
  date: string;
  readTime: string;
  category: string;
  image: string;
}

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "offline-first-construction-reporting",
    title: "Why Offline-First Matters for Construction Site Reporting",
    excerpt: "Most construction sites lack reliable internet. Here's how offline-first mobile apps keep your progress data flowing even in the most remote locations.",
    author: "Samuel Mwangi",
    date: "Jun 22, 2026",
    readTime: "5 min read",
    category: "Field Technology",
    image: "",
  },
  {
    slug: "clerk-of-works-digital-transformation",
    title: "Digital Transformation for Clerk of Works: A Practical Guide",
    excerpt: "Moving from paper-based site diaries to digital evidence capture — what changes, what stays the same, and how to make the transition smoothly.",
    author: "Jane Wanjiku",
    date: "Jun 15, 2026",
    readTime: "7 min read",
    category: "Best Practices",
    image: "",
  },
  {
    slug: "construction-cost-control-variations",
    title: "Mastering Construction Cost Control: Variations, Provisional Sums & Contingency",
    excerpt: "How modern ERP tools help project managers track every cost movement from budget approval through to final certification.",
    author: "Peter Kamau",
    date: "Jun 8, 2026",
    readTime: "6 min read",
    category: "Financials",
    image: "",
  },
  {
    slug: "biometric-milestone-verification",
    title: "Biometric-Signed Milestones: Ending Progress Disputes on Site",
    excerpt: "How Ed25519 cryptographic signing and biometric verification create tamper-proof evidence chains for construction milestone approvals.",
    author: "Samuel Mwangi",
    date: "Jun 1, 2026",
    readTime: "8 min read",
    category: "Technology",
    image: "",
  },
  {
    slug: "geofenced-evidence-construction",
    title: "Geofenced Photo Evidence: Proving Work Was Done On Site",
    excerpt: "GPS-tagged photos that can't be faked. How geofencing ensures every progress photo was actually taken at the project location.",
    author: "Grace Akinyi",
    date: "May 25, 2026",
    readTime: "4 min read",
    category: "Field Technology",
    image: "",
  },
  {
    slug: "interim-payment-certificates-guide",
    title: "Interim Payment Certificates: A Complete Guide for Contractors",
    excerpt: "Understanding IPCs — from certified work valuation through retention release to net payable. What every contractor needs to know.",
    author: "Peter Kamau",
    date: "May 18, 2026",
    readTime: "10 min read",
    category: "Financials",
    image: "",
  },
];

export function Blog() {
  return (
    <section style={{ padding: "60px 24px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 999, background: "var(--surface-2)", border: "1px solid var(--border)", fontSize: 13, color: "var(--muted)", marginBottom: 16 }}>
            Resources
          </div>
          <h1 style={{ fontSize: 40, margin: "0 0 12px" }}>Blog</h1>
          <p style={{ color: "var(--muted)", fontSize: 16, maxWidth: 560, margin: "0 auto", lineHeight: 1.6 }}>
            Insights on construction management technology, best practices, and industry trends.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 24 }}>
          {BLOG_POSTS.map(post => (
            <Link key={post.slug} to={`/blog/${post.slug}`} className="card" style={{ padding: 24, display: "flex", flexDirection: "column", transition: "all 0.15s" }}
              onMouseOver={(e: React.MouseEvent<HTMLAnchorElement>) => { e.currentTarget.style.borderColor = "var(--primary)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
              onMouseOut={(e: React.MouseEvent<HTMLAnchorElement>) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.transform = "translateY(0)"; }}>

              <div style={{ fontSize: 12, color: "var(--primary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                {post.category}
              </div>
              <h3 style={{ fontSize: 17, margin: "0 0 8px", lineHeight: 1.4, color: "var(--text)" }}>{post.title}</h3>
              <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.6, margin: "0 0 auto", flex: 1 }}>{post.excerpt}</p>
              <div style={{ display: "flex", gap: 16, marginTop: 16, fontSize: 13, color: "var(--faint)" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <User size={13} /> {post.author}
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <CalendarDays size={13} /> {post.date}
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <Clock size={13} /> {post.readTime}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
