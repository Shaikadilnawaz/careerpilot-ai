import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * 📌 Bundle firebase-admin instead of leaving it external.
   *
   * firebase-admin is on Next's DEFAULT serverExternalPackages list, so it is
   * not bundled — it is require()d from node_modules at runtime. On Vercel,
   * something in its traced dependency tree resolves to an ESM entry, and the
   * require() throws ERR_REQUIRE_ESM during module load. That killed every
   * route and Server Action importing the Admin SDK, with a bare 500 that no
   * try/catch could reach. It worked locally because module resolution differs.
   *
   * transpilePackages forces Next to compile and bundle it, so resolution
   * happens at build time where the CJS/ESM condition is settled correctly.
   */
  transpilePackages: ["firebase-admin"],
};

export default nextConfig;
