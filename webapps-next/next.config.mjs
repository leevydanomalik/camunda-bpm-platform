/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: false,
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },
  typescript: {
    // Mirrors cargotrain config — production builds proceed even on TS errors.
    // Tighten once the codebase is stable.
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  turbopack: {
    root: process.cwd(),
  },
  async rewrites() {
    return [
      // Proxy engine-rest through the Next.js BE so the browser only talks to one origin.
      // CAMUNDA_ENGINE_REST_URL points at the running Java engine, e.g. http://localhost:8080/engine-rest
      {
        source: "/api/engine/:path*",
        destination: `${process.env.CAMUNDA_ENGINE_REST_URL ?? "http://localhost:8080/engine-rest"}/:path*`,
      },
    ];
  },
};

export default nextConfig;
