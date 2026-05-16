import type { NextConfig } from "next";

const isElectron = process.env.ELECTRON === "true";

const nextConfig: NextConfig = {
  serverExternalPackages: ["node-pty"],

  async headers() {
    if (isElectron) {
      return [
        {
          source: "/(.*)",
          headers: [
            { key: "X-Frame-Options", value: "" },
            {
              key: "Content-Security-Policy",
              value: [
                "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:",
                "child-src * blob:",
              ].join("; "),
            },
          ],
        },
      ];
    }

    return [];
  },
};

export default nextConfig;
