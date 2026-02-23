import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  // Turbopack（dev時デフォルト）とwebpack（PWA build時）の共存
  turbopack: {},
};

export default withPWA(nextConfig);
