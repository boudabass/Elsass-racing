// Liaisons du Garage avec les autres apps (tâche 4.1, brief §5). Gestionnaires enregistrés à l'import, comme ceux de
// Partenaires. Un gestionnaire ne parle qu'aux services du Garage : il n'écrit jamais dans les tables d'une autre app.

import { lireUsureEngagement } from "@/apps/saison/lectures-partagees"
import type { ContexteTeam } from "@/core/contexte"
import { enregistrerGestionnaire, type EvenementRecu } from "@/core/evenements/gestionnaires"

import { chargeAbandonDeclare, chargeDecisionOrdre, chargeProblemeSignaleLu, chargeResultatValide } from "./charges"
import { ouvrirFicheAbandonDans } from "./casses-serveur"
import { appliquerUsureResultatDans } from "./services-serveur"
import { appliquerDecisionOrdre, proposerOrdreDepuisPointDans } from "./ordres-depuis-point-serveur"

// Un résultat validé ajoute ses km chronométrés et une épreuve à toutes les pièces montées du véhicule de l'engagement.
// Une seule fois par engagement (index unique) ; une annulation de résultat ne retire rien.
enregistrerGestionnaire("garage", "saison.resultat_valide", async (ctx: ContexteTeam, evenement: EvenementRecu) => {
  const analyse = chargeResultatValide.safeParse(evenement.donnees)
  if (!analyse.success) return
  const usure = await lireUsureEngagement(ctx, analyse.data.entryId)
  await appliquerUsureResultatDans(ctx, analyse.data.entryId, analyse.data.eventId, usure?.kmChronometres ?? 0)
})

// Un engagement abandonné dans Saison ouvre une fiche casse à compléter (954 §5). Une seule fiche par engagement.
enregistrerGestionnaire("garage", "saison.abandon_declare", async (ctx: ContexteTeam, evenement: EvenementRecu) => {
  const analyse = chargeAbandonDeclare.safeParse(evenement.donnees)
  if (!analyse.success) return
  await ouvrirFicheAbandonDans(ctx, analyse.data)
})

// Un problème signalé sur un point lié à un organe : Garage propose d'ouvrir un ordre (5.7a). Les autres problèmes sont
// pour le socle (tâche), pas pour Garage.
enregistrerGestionnaire("garage", "checklist.probleme_signale", async (ctx: ContexteTeam, evenement: EvenementRecu) => {
  const analyse = chargeProblemeSignaleLu.safeParse(evenement.donnees)
  if (!analyse.success || analyse.data.lienType !== "organe_garage" || !analyse.data.lienId) return
  await proposerOrdreDepuisPointDans(ctx, {
    pointId: analyse.data.pointId,
    epreuveId: analyse.data.epreuveId,
    listeTitre: analyse.data.listeTitre ?? null,
    lienId: analyse.data.lienId,
  })
})

// La décision d'une action d'ordre revient à Garage (règle 2) : Accepter ouvre l'ordre, Ignorer ne fait rien.
enregistrerGestionnaire("garage", "core.action_decidee", async (ctx: ContexteTeam, evenement: EvenementRecu) => {
  const analyse = chargeDecisionOrdre.safeParse(evenement.donnees)
  if (!analyse.success) return
  await appliquerDecisionOrdre(ctx, analyse.data)
})
