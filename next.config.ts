import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Include CSV data files in Vercel serverless function output
  outputFileTracingIncludes: {
    "/*": ["./data/**/*"],
  },
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
