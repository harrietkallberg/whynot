import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // An Owner Link token sits in the path of /d/<token>. A Referer header
        // would hand that credential to any site linked from the page, so no
        // response from this app ever sends one (ADR-0002).
        source: "/:path*",
        headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
      },
    ];
  },
};

export default nextConfig;
