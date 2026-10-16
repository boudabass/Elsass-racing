import { notFound } from "next/navigation"

// Page de test de l'écran d'erreur. Hors production seulement : en production, elle n'existe pas.
// (Le brief parle de /__erreur-test ; un dossier qui commence par « _ » est privé dans Next, d'où ce nom.)
export default function PageErreurTest() {
  if (process.env.NODE_ENV === "production") notFound()
  throw new Error("Erreur de test (page /erreur-test, hors production).")
}
