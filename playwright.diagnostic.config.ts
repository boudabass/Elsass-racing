import { defineConfig, devices } from "@playwright/test"

// Diagnostic de l'hydratation (tâche 4.3c). Serveur de développement (next dev) sur le port 3102, pour que React
// écrive le message complet de ses erreurs d'hydratation (diff client et serveur). Ne sert qu'au workflow de
// vérifications, lancé à la main (entrée diagnostic = hydratation). Hors de la suite : testIgnore dans
// playwright.config.ts. Le build de production (port 3101) n'est pas lancé ici.
export default defineConfig({
  testDir: "./e2e/diagnostic",
  testMatch: "**/*.spec.ts",
  workers: 1,
  fullyParallel: false,
  timeout: 3_600_000,
  expect: { timeout: 60_000 },
  outputDir: "test-results/diagnostic-playwright",
  reporter: [["list"]],
  use: {
    locale: "fr-FR",
    navigationTimeout: 180_000,
    actionTimeout: 30_000,
    trace: "off",
    screenshot: "off",
  },
  projects: [
    {
      name: "diagnostic-dev",
      use: { ...devices["Desktop Chrome"], baseURL: "http://localhost:3102" },
    },
  ],
  webServer: [
    {
      // La première requête compile la page : d'où le délai large.
      command: "pnpm exec next dev -p 3102",
      url: "http://localhost:3102/connexion",
      reuseExistingServer: false,
      timeout: 600_000,
      env: {
        SMTP_HOST: "",
        APP_URL: "http://localhost:3102",
        STOCKAGE_DIR: ".e2e-stockage",
        E2E: "1",
      },
    },
  ],
})
