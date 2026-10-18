import path from "node:path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produit .next/standalone : un serveur autonome n'embarquant que les
  // dépendances réellement tracées. L'image Docker n'a pas à recopier
  // node_modules en entier.
  output: "standalone",
  // Builds de vérification dans un autre dossier (NEXT_DIST_DIR=.next-build) : le serveur dev
  // garde le sien, et un build ne le casse pas.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Racine du projet pour le traçage. Sans cela, Next choisit un lockfile
  // parent (C:\Users\George\pnpm-lock.yaml) comme racine de workspace.
  outputFileTracingRoot: path.join(__dirname),
  // Pas d'en-tête `X-Powered-By` : il annoncerait Next à qui le lit.
  poweredByHeader: false,
  // Le rendu PDF (tâche 3.1b) reste hors du traçage et du bundle serveur de Next.
  serverExternalPackages: ["@react-pdf/renderer"],
  // Version de l'app, figée au build : le service worker s'en sert pour nommer son cache. Un
  // nouveau build crée un nouveau cache, l'ancien est supprimé à l'activation.
  env: {
    VERSION_APP: process.env.VERSION_APP || new Date().toISOString(),
  },
  // En-têtes de sécurité. L'app ne se charge dans aucune iframe : `DENY`.
  // Les fichiers (/api/fichiers) posent leur propre Content-Security-Policy, avec sandbox (tâche 3.1) :
  // cette règle globale l'écraserait, donc elle les exclut. Ils gardent le reste des en-têtes.
  async headers() {
    const transport = [
      { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
    ]
    return [
      {
        source: "/:path((?!api/fichiers(?:/|$)).*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Le service worker vient du même site uniquement.
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'; worker-src 'self'" },
          ...transport,
        ],
      },
      {
        source: "/api/fichiers/:path*",
        headers: transport,
      },
      {
        source: "/api/fichiers",
        headers: transport,
      },
    ]
  },
};

export default nextConfig;
