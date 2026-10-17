import { defineConfig, devices } from "@playwright/test"

// Tests de bout en bout, sur le build de production du port 3101 (dossier .next-e2e-prod), pour que
// le serveur de développement du port 3000 ne soit jamais touché.
// SMTP_HOST vide : les mails s'affichent dans la console du serveur, rien ne part vers l'extérieur.
export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  // Un seul worker : les scénarios se succèdent proprement sur la même base.
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
      use: { ...devices["Desktop Chrome"], baseURL: "http://localhost:3101" },
    },
    {
      // Hors ligne : le service worker n'existe qu'en production.
      name: "hors-ligne",
      testMatch: /hors-ligne\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], baseURL: "http://localhost:3101" },
    },
  ],
  // Un seul serveur, le build de production (next build puis next start) : environ 200 Mo.
  // L'ancien serveur next dev du port 3100 montait à plusieurs Go en pleine suite et se relançait
  // seul (chrome-error) ; il est retiré. Les captures sortent donc aussi du build de production.
  webServer: [
    {
      command: "pnpm exec next build && pnpm exec next start --port 3101",
      url: "http://localhost:3101/connexion",
      reuseExistingServer: false,
      timeout: 600_000,
      env: {
        NEXT_DIST_DIR: ".next-e2e-prod",
        SMTP_HOST: "",
        APP_URL: "http://localhost:3101",
        // Build de test : mails en console et page /erreur-test ouverte (voir mail-serveur.ts).
        E2E: "1",
      },
    },
  ],
})
