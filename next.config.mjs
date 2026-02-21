const isDesktopExport = process.env.ORBIT_DESKTOP_EXPORT === "1";
const rawBasePath = process.env.ORBIT_BASE_PATH?.trim();
const exportBasePath =
  isDesktopExport && rawBasePath
    ? `/${rawBasePath.replace(/^\/+/, "").replace(/\/+$/, "")}`
    : "";

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  output: isDesktopExport ? "export" : undefined,
  trailingSlash: isDesktopExport,
  basePath: exportBasePath || undefined,
  images: {
    unoptimized: isDesktopExport,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
      {
        protocol: "http",
        hostname: "**",
      },
    ],
  },
};

export default nextConfig;
