import { Lock } from "lucide-react"

import { accesEcran } from "@/apps/documents/ecran"
import { ListePartages } from "@/apps/documents/composants/partages"
import { lirePartages, liensVisiblesPourMoi } from "@/apps/documents/lectures-partages"
import { EcranVide } from "@/components/qg/ecran-vide"

// Partages (tâche 5.4, brief §1) : liens actifs d'abord, puis expirés et révoqués. Jamais pour l'assistance.
export default async function PagePartages() {
  const acces = await accesEcran("lecture")
  if (!acces.ok) {
    return <EcranVide icone={Lock} titre={acces.titre} lignes={acces.lignes} action={{ libelle: "Retour au QG", href: "/qg" }} />
  }
  if (!(await liensVisiblesPourMoi())) {
    return (
      <EcranVide
        icone={Lock}
        titre="Partages"
        lignes={["Les liens de partage ne sont pas ouverts à l'assistance."]}
        action={{ libelle: "Retour au QG", href: "/qg" }}
      />
    )
  }
  const donnees = await lirePartages()
  return (
    <section className="flex w-full max-w-4xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="titre-rallye text-3xl">Partages</h1>
        <p className="text-texte-discret">Liens temporaires vers un document. Chaque ouverture est comptée, et chaque lien se révoque.</p>
      </header>
      <ListePartages actifs={donnees.actifs} inactifs={donnees.inactifs} />
    </section>
  )
}
