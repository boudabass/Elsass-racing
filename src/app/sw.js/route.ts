import { codeServiceWorker } from "@/core/synchro/service-worker"

// Service worker (/sw.js). Servi par une route : la version de l'app est injectée au build (next.config.ts).
// Jamais mis en cache par le navigateur : une nouvelle version doit être vue tout de suite.
export const dynamic = "force-static"

export function GET() {
  return new Response(codeServiceWorker(process.env.VERSION_APP || "dev"), {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-cache",
      "Service-Worker-Allowed": "/",
    },
  })
}
