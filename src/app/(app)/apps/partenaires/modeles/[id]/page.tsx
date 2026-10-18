import Link from "next/link"
import { notFound } from "next/navigation"
import { Lock } from "lucide-react"

import { accesEcran } from "@/apps/partenaires/ecran"
import { EditeurModele } from "@/apps/partenaires/composants/editeur-modele"
import { lireModeles } from "@/apps/partenaires/services-serveur"
import { EcranVide } from "@/components/qg/ecran-vide"
import { LIEN } from "@/lib/classes-formulaire"

// Un modèle : texte, champs à insérer, aperçu, version, dupliquer et activer. Gestion seulement.
export default async function PageModele({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const acces = await accesEcran("gestion")
  if (!acces.ok) {
    return <EcranVide icone={Lock} titre={acces.titre} lignes={acces.lignes} action={{ libelle: "Retour au QG", href: "/qg" }} />
  }
  const modele = (await lireModeles()).find((m) => m.id === id)
  if (!modele) notFound()

  return (
    <section className="flex w-full max-w-4xl flex-col gap-6">
      <Link href="/apps/partenaires/modeles" className={`${LIEN} self-start text-sm text-texte-discret`}>
        ← Modèles
      </Link>
      <h1 className="titre-rallye text-3xl">{modele.nom}</h1>
      <EditeurModele modele={{ id: modele.id, nom: modele.nom, texte: modele.texte, version: modele.version, actif: modele.actif }} />
    </section>
  )
}
