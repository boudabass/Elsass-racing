import { notFound } from "next/navigation"

import { Controle } from "./controle"

// Page de contrôle du diagnostic d'hydratation (tâche 4.3c). Hors production seulement, comme /erreur-test : elle rend
// volontairement un élément qui n'existe que côté client. React doit donc signaler un désaccord d'hydratation, et la
// capture du diagnostic doit le recevoir. Rendue à la requête, pour que la garde s'applique à chaque appel.
export const dynamic = "force-dynamic"

export default function PageControle() {
  if (process.env.NODE_ENV === "production" && process.env.E2E !== "1") notFound()
  return <Controle />
}
