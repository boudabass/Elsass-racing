// Pages de partage d'un document (tâche 5.4) : hors du groupe (app), donc sans barre haute, sans menu et sans session.
// Les métadonnées demandent aux moteurs de ne pas indexer, et au navigateur de ne pas transmettre l'adresse (qui contient le
// jeton). Les en-têtes HTTP sont posés par le middleware.
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Document partagé",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
}

export default function LayoutPartage({ children }: { children: React.ReactNode }) {
  return children
}
