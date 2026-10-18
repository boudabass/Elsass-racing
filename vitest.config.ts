import { fileURLToPath } from "node:url"

import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  // Runtime JSX automatique, comme Next : les tests peuvent rendre les composants .tsx (documents PDF).
  esbuild: { jsx: "automatic" },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Pas encore de test : sans cette option, `vitest run` sort en erreur.
    passWithNoTests: true,
  },
})
