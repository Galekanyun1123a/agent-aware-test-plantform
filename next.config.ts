import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 设置 turbopack 根目录，避免多 lockfile 警告
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
