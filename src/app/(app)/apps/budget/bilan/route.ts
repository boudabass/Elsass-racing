import { createElement } from "react"
import { NextResponse } from "next/server"

import { accesEcran } from "@/apps/budget/ecran"
import { bilanSaison, type MouvementBilan } from "@/apps/budget/bilan"
import { listerMouvements, lireChoix, lireCoutsParEpreuve, lireMembres, lirePrevisionnel } from "@/apps/budget/lectures-serveur"
import { BilanSaisonPdf } from "@/apps/budget/pdf/bilan-saison"
import { jourDeParis } from "@/core/dates"
import { exigerContexte } from "@/core/droits/garde-serveur"
import { nomFichierPdf } from "@/core/pdf/nom-fichier"
import { lireLogoPourPdf } from "@/core/pdf/logo-serveur"
import { reponsePdf, rendrePdf } from "@/core/pdf/rendu-serveur"

// Bilan de saison de Budget en PDF (brief 3.1b, section 4.3). Garde : au moins le niveau écriture, sinon 403.
// Sans `saison`, c'est la saison de l'année en cours (ou la plus récente).
export const dynamic = "force-dynamic"

export async function GET(requete: Request): Promise<Response> {
  const acces = await accesEcran("ecriture")
  if (!acces.ok) return new NextResponse("Accès refusé.", { status: 403 })

  const choix = await lireChoix()
  const anneeCourante = Number(jourDeParis(new Date()).slice(0, 4))
  const demandee = new URL(requete.url).searchParams.get("saison")
  const saison = demandee
    ? choix.saisons.find((ligne) => ligne.id === demandee)
    : (choix.saisons.find((ligne) => ligne.annee === anneeCourante) ?? choix.saisons[0])
  if (!saison) return new NextResponse("Saison introuvable.", { status: 404 })

  const { session, team } = await exigerContexte()
  const { mouvements } = await listerMouvements({ saisonId: saison.id })
  const previsions = (await lirePrevisionnel(saison.id, null))
    .filter((ligne) => ligne.prevu !== null)
    .map((ligne) => ({ categorieId: ligne.categorieId, montant: ligne.prevu ?? 0 }))
  const { epreuves } = await lireCoutsParEpreuve(saison.id)
  const membres = await lireMembres()

  const bilan = bilanSaison({
    mouvements: mouvements.map(
      (mouvement): MouvementBilan => ({
        type: mouvement.type,
        montant: mouvement.montantCentimes,
        categorieId: mouvement.categorieId,
        categorieNom: mouvement.categorieNom,
        valide: mouvement.type === "depense" ? mouvement.statut === "confirmee" : mouvement.statut === "encaissee",
      }),
    ),
    previsions,
    epreuves,
    membres,
  })

  const logo = await lireLogoPourPdf(team.id, session.userId)
  const octets = await rendrePdf(
    createElement(BilanSaisonPdf, {
      bilan,
      saisonNom: String(saison.annee),
      team: { nom: team.nom, couleur: team.couleurPrincipale, logo },
      date: new Date(),
    }),
  )
  return reponsePdf(octets, nomFichierPdf(["bilan", team.nom, `saison ${saison.annee}`]))
}
