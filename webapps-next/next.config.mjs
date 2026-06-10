import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
  experimental: {
    // Barrel-file imports (lucide-react, radix, recharts) explode into thousands
    // of resolved files during build. Next rewrites these into per-file imports
    // automatically when listed here — large win on cold builds.
    optimizePackageImports: ["lucide-react", "@radix-ui/react-icons", "recharts", "date-fns"],
  },
  turbopack: {
    root: process.cwd(),
    resolveAlias: {
      // dmn-js-drd `import Ids from 'ids'` needs a default export; ids@3.x is named-only.
      ids: "./src/lib/dmn/ids-shim.js",
      // dmn-moddle's `dist/index.js` is plain CJS (`module.exports = simple`) with no
      // __esModule marker — Turbopack's interop ends up with `.default = undefined`,
      // so `new DmnModdle()` inside dmn-js-shared crashes with "default is not a
      // constructor". The companion `dist/index.esm.js` ends with `export default simple`
      // and resolves cleanly, so pin the alias to it. (Do NOT put dmn-moddle in
      // transpilePackages — that duplicates the shared `moddle` instance and breaks
      // the saxen-based parser with a stack overflow.)
      "dmn-moddle": "./node_modules/dmn-moddle/dist/index.esm.js",
    },
  },
  transpilePackages: [
    "dmn-js",
    "dmn-js-drd",
    "dmn-js-shared",
    "dmn-js-decision-table",
    "dmn-js-literal-expression",
    "ids",
  ],
  // Mirror the Turbopack aliases for the webpack build path so
  // `next build --webpack` also handles the ids@3.x and dmn-moddle CJS-interop
  // edge cases.
  //
  // Both keys use webpack's `$` exact-match suffix. Without it, the `ids` alias
  // would prefix-match every `ids/...` request (including the shim's own
  // resolution) and recurse until "Maximum call stack size exceeded".
  webpack: (config) => {
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      ids$: path.resolve(__dirname, "src/lib/dmn/ids-shim.js"),
      "dmn-moddle$": path.resolve(__dirname, "node_modules/dmn-moddle/dist/index.esm.js"),
    };
    return config;
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
