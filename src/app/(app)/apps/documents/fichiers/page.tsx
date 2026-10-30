import { Lock } from "lucide-react"

import { FichiersEcran } from "@/apps/documents/composants/fichiers-ecran"
import { accesEcran } from "@/apps/documents/ecran"
import { lireFichiers, type FiltresFichiers } from "@/apps/documents/lectures-fichiers"
import { EcranVide } from "@/components/qg/ecran-vide"

// Tous les fichiers (tâche 5.4, brief §1) : vue unifiée des fichiers rattachés, en lecture seule. Filtres dans l'URL.
export default async function PageFichiers({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const acces = await accesEcran("lecture")
  if (!acces.ok) {
    return <EcranVide icone={Lock} titre={acces.titre} lignes={acces.lignes} action={{ libelle: "Retour au QG", href: "/qg" }} />
  }
  const brut = await searchParams
  const lire = (cle: string) => {
    const valeur = brut[cle]
    return typeof valeur === "string" && valeur !== "" ? valeur : undefined
  }
  const page = Number.parseInt(lire("page") ?? "1", 10)
  const filtres: FiltresFichiers = {
    app: lire("app"),
    role: lire("role"),
    par: lire("par"),
    page: Number.isFinite(page) && page > 0 ? page : 1,
  }
  const donnees = await lireFichiers(filtres)
  return <FichiersEcran donnees={donnees} filtres={filtres} />
}
