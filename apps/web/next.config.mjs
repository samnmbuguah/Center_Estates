import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../../"),
  poweredByHeader: false,
  // Skip type-check during `next build` when SKIP_TYPE_CHECK=1 — run `npm run type-check` concurrently in CI
  typescript: process.env.SKIP_TYPE_CHECK === "1" ? { ignoreBuildErrors: true } : undefined,
  images: {
    unoptimized: true,
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://app.posthog.com https://us.posthog.com https://app-static-prod.posthog.com https://us-assets.i.posthog.com; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com; img-src 'self' data: https:; font-src 'self' data: https: https://fonts.gstatic.com; connect-src 'self' https: https://app.posthog.com https://us.posthog.com https://us.i.posthog.com https://app-static-prod.posthog.com; frame-src 'self' https://app.posthog.com https://us.posthog.com https://*.posthog.com https://preview.posthog.com https://vercel.com; frame-ancestors 'self' https://posthog.com https://*.posthog.com https://preview.posthog.com https://vercel.com https://us.posthog.com https://eu.posthog.com;"
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          }
        ],
      },
    ];
  },
};

export default nextConfig;
