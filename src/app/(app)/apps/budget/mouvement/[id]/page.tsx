import Link from "next/link"
import { Lock } from "lucide-react"

import { accesEcran } from "@/apps/budget/ecran"
import { EncaisserRecette } from "@/apps/budget/composants/encaisser"
import { FormulaireMouvement } from "@/apps/budget/composants/mouvement"
import { lireChoix, lireMouvement } from "@/apps/budget/lectures-serveur"
import { aAuMoins } from "@/core/droits/niveaux"
import { jourDeParis, jourEnFrancais } from "@/core/dates"
import { comptesEncaissement } from "@/apps/budget/regles"
import { EcranVide } from "@/components/qg/ecran-vide"

// Modifier ou supprimer un mouvement. Écriture : tout mouvement. Contribution : ses propres dépenses seulement.

export default async function PageMouvement({ params }: { params: Promise<{ id: string }> }) {
  const acces = await accesEcran("contribution")
  if (!acces.ok) {
    return <EcranVide icone={Lock} titre={acces.titre} lignes={acces.lignes} action={{ libelle: "Retour au QG", href: "/qg" }} />
  }
  const { id } = await params
  const mouvement = await lireMouvement(id)
  if (!mouvement) {
    return <EcranVide icone={Lock} titre="Mouvement introuvable" lignes={["Il n'existe pas, ou il ne te concerne pas."]} action={{ libelle: "Retour aux mouvements", href: "/apps/budget" }} />
  }
  if (mouvement.type === "recette" && !aAuMoins(acces.niveau, "ecriture")) {
    return <EcranVide icone={Lock} titre="Tu ne peux pas modifier cette recette" lignes={["Seule l'écriture modifie les recettes."]} action={{ libelle: "Retour aux mouvements", href: "/apps/budget" }} />
  }
  const choix = await lireChoix()
  const peutChoisirPayeur = aAuMoins(acces.niveau, "ecriture")
  const peutEncaisser = aAuMoins(acces.niveau, "gestion")
  const payeurs = peutChoisirPayeur ? choix.payeurs : choix.payeurs.filter((payeur) => payeur.id === choix.moiId)

  return (
    <section className="flex max-w-2xl flex-col gap-6">
      <Link href="/apps/budget" className="cible-tactile inline-flex items-center text-sm text-texte-discret">
        ← Mouvements
      </Link>
      <h1 className="titre-rallye text-3xl">{mouvement.type === "depense" ? "Modifier la dépense" : "Modifier la recette"}</h1>
      {mouvement.type === "recette" && mouvement.encaisseeLe && (
        <p className="text-sm text-etat-ok">Encaissée le {jourEnFrancais(new Date(`${mouvement.encaisseeLe}T00:00:00Z`))}</p>
      )}
      {mouvement.type === "recette" && mouvement.statut === "prevue" && peutEncaisser && (
        <EncaisserRecette recetteId={mouvement.id} comptes={comptesEncaissement(choix.payeurs)} dateDefaut={jourDeParis(new Date())} />
      )}
      <FormulaireMouvement
        valeurs={{
          id: mouvement.id,
          type: mouvement.type,
          montantCentimes: mouvement.montantCentimes,
          categorieId: mouvement.categorieId,
          libelle: mouvement.libelle,
          date: mouvement.date,
          eventId: mouvement.eventId,
          payerId: mouvement.payeurId,
          moyen: mouvement.moyen,
          justificatif: mouvement.justificatif,
        }}
        categories={mouvement.type === "depense" ? choix.categoriesDepense : choix.categoriesRecette}
        payeurs={payeurs.map(({ id: payeurId, nom }) => ({ id: payeurId, nom }))}
        epreuves={choix.epreuves.map(({ id: epreuveId, nom }) => ({ id: epreuveId, nom }))}
        peutChoisirPayeur={peutChoisirPayeur}
      />
    </section>
  )
}
