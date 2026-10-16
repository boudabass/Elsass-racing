import { defineConfig, devices } from "@playwright/test"

// Tests de bout en bout. Un serveur dédié sur le port 3100, avec son propre dossier de build
// (.next-e2e) : le serveur de développement du port 3000 n'est jamais touché.
// SMTP_HOST vide : les mails s'affichent dans la console du serveur, rien ne part vers l'extérieur.
export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  // Un seul worker : le serveur de développement compile les pages à la demande, et les
  // scénarios se succèdent proprement sur la même base.
  workers: 1,
  fullyParallel: false,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  outputDir: "test-results",
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL: "http://localhost:3100",
    locale: "fr-FR",
    navigationTimeout: 60_000,
    actionTimeout: 20_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "pnpm dev --port 3100",
    url: "http://localhost:3100/connexion",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      NEXT_DIST_DIR: ".next-e2e",
      SMTP_HOST: "",
    },
  },
})
