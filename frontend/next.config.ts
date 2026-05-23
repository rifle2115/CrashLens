import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emits a self-contained server bundle for production Docker images
  // (~80% smaller than the default output).
  output: "standalone",
  reactCompiler: true,
};

export default nextConfig;
