import { defineConfig, devices } from "@playwright/test"

// Tests de bout en bout. Deux serveurs, chacun avec son dossier de build, pour que le serveur de
// développement du port 3000 ne soit jamais touché :
// - 3100 : développement (suite principale) ;
// - 3101 : production (next build puis next start), pour le service worker (projet « hors-ligne »).
// SMTP_HOST vide : les mails s'affichent dans la console du serveur, rien ne part vers l'extérieur.
export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  // Un seul worker : les serveurs compilent les pages à la demande, et les scénarios se
  // succèdent proprement sur la même base.
  workers: 1,
  fullyParallel: false,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  outputDir: "test-results",
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    locale: "fr-FR",
    navigationTimeout: 60_000,
    actionTimeout: 20_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      testIgnore: /hors-ligne\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], baseURL: "http://localhost:3100" },
    },
    {
      // Hors ligne : le service worker n'existe qu'en production.
      name: "hors-ligne",
      testMatch: /hors-ligne\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], baseURL: "http://localhost:3101" },
    },
  ],
  webServer: [
    {
      command: "pnpm dev --port 3100",
      url: "http://localhost:3100/connexion",
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        NEXT_DIST_DIR: ".next-e2e",
        SMTP_HOST: "",
      },
    },
    {
      command: "pnpm exec next build && pnpm exec next start --port 3101",
      url: "http://localhost:3101/connexion",
      reuseExistingServer: false,
      timeout: 600_000,
      env: {
        NEXT_DIST_DIR: ".next-e2e-prod",
        SMTP_HOST: "",
        APP_URL: "http://localhost:3101",
      },
    },
  ],
})
