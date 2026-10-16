import path from "node:path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produit .next/standalone : un serveur autonome n'embarquant que les
  // dépendances réellement tracées. L'image Docker n'a pas à recopier
  // node_modules en entier.
  output: "standalone",
  // Racine du projet pour le traçage. Sans cela, Next choisit un lockfile
  // parent (C:\Users\George\pnpm-lock.yaml) comme racine de workspace.
  outputFileTracingRoot: path.join(__dirname),
  // Pas d'en-tête `X-Powered-By` : il annoncerait Next à qui le lit.
  poweredByHeader: false,
  // En-têtes de sécurité. L'app ne se charge dans aucune iframe : `DENY`.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
        ],
      },
    ]
  },
};

export default nextConfig;
