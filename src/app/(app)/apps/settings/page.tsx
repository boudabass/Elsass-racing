import { redirect } from "next/navigation"

import { contexteQg } from "@/core/qg/donnees"
import { niveauDe } from "@/core/actions/actions-serveur"
import { aAuMoins } from "@/core/droits/niveaux"

// Réglages s'ouvre sur l'identité de la team pour qui peut la lire, sinon sur l'affichage personnel.
export default async function PageReglages() {
  const { contexte } = await contexteQg()
  if (aAuMoins(await niveauDe(contexte, "settings"), "lecture")) redirect("/apps/settings/identite")
  redirect("/apps/settings/affichage")
}
