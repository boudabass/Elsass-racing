// Liaisons du Garage avec les autres apps (tâche 4.1, brief §5). Gestionnaires enregistrés à l'import, comme ceux de
// Partenaires. Un gestionnaire ne parle qu'aux services du Garage : il n'écrit jamais dans les tables d'une autre app.

import { lireUsureEngagement } from "@/apps/saison/lectures-partagees"
import type { ContexteTeam } from "@/core/contexte"
import { enregistrerGestionnaire, type EvenementRecu } from "@/core/evenements/gestionnaires"

import { chargeAbandonDeclare, chargeResultatValide } from "./charges"
import { ouvrirFicheAbandonDans } from "./casses-serveur"
import { appliquerUsureResultatDans } from "./services-serveur"

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
