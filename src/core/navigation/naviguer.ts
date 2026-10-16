import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime"

import { modeNavigation } from "./choix"

// Navigation commune du code : côté client quand le réseau est là, par page sinon (cf. choix.ts).
export function naviguer(routeur: Pick<AppRouterInstance, "push">, href: string): void {
  if (modeNavigation(navigator.onLine) === "client") {
    routeur.push(href)
    return
  }
  window.location.assign(href)
}
