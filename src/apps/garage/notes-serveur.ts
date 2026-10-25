// Notes et photos des ordres de travail (brief 5.0, §4). Le Garage fournit le contrôle de la fiche « ordre » :
// - en ligne, le ControleFiche du service du socle (src/core/notes/notes-serveur.ts) ;
// - hors ligne, la fiche notable (src/core/notes/fiches.ts), contrôlée dans la transaction de la synchro.
// Voir : lecture du Garage. Ajouter : écriture, ou contribution sur un ordre où la personne est affectée.

import type { ContexteTeam } from "@/core/contexte"
import { aAuMoins } from "@/core/droits/niveaux"
import { niveauDe } from "@/core/actions/actions-serveur"
import { peutAjouterSurFiche, peutVoirFiche } from "@/core/notes/regles"
import type { ControleFiche, FicheNotes } from "@/core/notes/notes-serveur"
import type { FicheNotable } from "@/core/notes/fiches"
import type { Tx } from "@/core/synchro/registre"
import { executerPourTeam } from "@/lib/prisma"

import { refus } from "./erreurs"

const APP = "garage"
const TYPE_FICHE = "ordre"

// L'ordre existe encore dans la team (non supprimé).
async function ordreExiste(tx: Tx, teamId: string, ordreId: string): Promise<boolean> {
  const ordre = await tx.garageWorkOrder.findFirst({ where: { id: ordreId, teamId, deletedAt: null }, select: { id: true } })
  return ordre !== null
}

// La personne du compte est affectée à l'ordre (même règle que l'avancement, 4.3).
async function estAffecteeA(tx: Tx, teamId: string, userId: string, ordreId: string): Promise<boolean> {
  const personne = await tx.corePerson.findFirst({ where: { teamId, userId, deletedAt: null }, select: { id: true } })
  if (!personne) return false
  const lien = await tx.garageWorkOrderPerson.findFirst({ where: { workOrderId: ordreId, personId: personne.id, teamId, deletedAt: null }, select: { id: true } })
  return lien !== null
}

// Fiche notable pour la synchro : contrôle dans la transaction. Le niveau vient de l'app Garage (niveauDe).
export const ficheOrdreNotable: FicheNotable = {
  app: APP,
  ficheType: TYPE_FICHE,

  async peutVoir(tx, ctx, ordreId) {
    const niveau = await niveauDe(ctx, APP)
    if (!peutVoirFiche(niveau)) return false
    return ordreExiste(tx, ctx.teamId, ordreId)
  },

  async peutAjouter(tx, ctx, ordreId) {
    const niveau = await niveauDe(ctx, APP)
    if (!peutVoirFiche(niveau) || !(await ordreExiste(tx, ctx.teamId, ordreId))) return false
    const affectee = await estAffecteeA(tx, ctx.teamId, ctx.userId, ordreId)
    return peutAjouterSurFiche({ niveau, affectee })
  },
}

// Contrôle en ligne d'un ordre pour le service des notes et photos.
export function controleOrdre(ordreId: string): ControleFiche {
  const fiche: FicheNotes = { app: APP, ficheType: TYPE_FICHE, ficheId: ordreId }
  return {
    ...fiche,

    async voir(ctx: ContexteTeam) {
      const niveau = await niveauDe(ctx, APP)
      if (!peutVoirFiche(niveau)) refus("Tu n'as pas accès au Garage.")
      const existe = await executerPourTeam(ctx.teamId, ctx.userId, (tx) => ordreExiste(tx, ctx.teamId, ordreId))
      if (!existe) refus("Ordre de travail introuvable.")
    },

    async contribuer(ctx: ContexteTeam) {
      const niveau = await niveauDe(ctx, APP)
      if (!peutVoirFiche(niveau)) refus("Tu n'as pas accès au Garage.")
      const affectee = await executerPourTeam(ctx.teamId, ctx.userId, (tx) => estAffecteeA(tx, ctx.teamId, ctx.userId, ordreId))
      if (!peutAjouterSurFiche({ niveau, affectee })) {
        if (aAuMoins(niveau, "contribution")) refus("Cet ordre ne vous est pas affecté.")
        refus("Tu n'as pas le droit d'ajouter une note ici.")
      }
    },

    async gerer(ctx: ContexteTeam) {
      return aAuMoins(await niveauDe(ctx, APP), "gestion")
    },
  }
}
