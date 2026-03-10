import type { NextConfig } from "next";

// Convex cloud origin (EU west deployment)
const CONVEX_ORIGIN = "https://*.convex.cloud";
const CONVEX_SITE = "https://*.convex.site";

// Content-Security-Policy — intentionally permissive for Next.js + Convex + Clerk:
// - unsafe-inline is required for Next.js inline hydration scripts
// - connect-src includes Convex WebSocket (wss://) and REST, Clerk accounts, AI providers
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://clerk.accounts.dev https://*.clerk.accounts.dev",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  [
    "connect-src 'self'",
    CONVEX_ORIGIN,
    CONVEX_SITE,
    "wss://*.convex.cloud",
    "https://clerk.accounts.dev",
    "https://*.clerk.accounts.dev",
    // AI providers (BYOK streaming)
    "https://api.groq.com",
    "https://api.openai.com",
    "https://openrouter.ai",
    "https://api.anthropic.com",
  ].join(" "),
  "img-src 'self' data: blob: https://img.clerk.com https://images.clerk.dev https://upload.wikimedia.org",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: CSP },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-XSS-Protection", value: "1; mode=block" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "upload.wikimedia.org" },
      { protocol: "https", hostname: "img.clerk.com" },
      { protocol: "https", hostname: "images.clerk.dev" },
    ],
  },
  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
