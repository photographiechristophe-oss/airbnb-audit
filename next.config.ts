import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https://a0.muscache.com https://a1.muscache.com https://a2.muscache.com https://images.airbnb.com; connect-src 'self' https://generativelanguage.googleapis.com https://api.anthropic.com https://api.brevo.com; frame-ancestors https://www.votrephotographeimmo.com https://votrephotographeimmo.com https://*.wix.com https://*.wixsite.com",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
