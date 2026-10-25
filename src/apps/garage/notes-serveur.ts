// Notes et photos des ordres de travail (brief 5.0, §4). Le Garage fournit le contrôle de la fiche « ordre » :
// - en ligne, le ControleFiche du service du socle (src/core/notes/notes-serveur.ts) ;
// - hors ligne, la fiche notable (src/core/notes/fiches.ts) : le tirage ne renvoie que les ordres visibles, la poussée contrôle
//   dans la transaction de la synchro.
// Voir : lecture du Garage, et l'ordre visible (écriture et plus : tous ; sinon : ceux où la personne est affectée, comme
// lireOrdre). Ajouter : écriture, ou contribution sur un ordre où la personne est affectée.

import type { ContexteTeam } from "@/core/contexte"
import { niveauDe } from "@/core/actions/actions-serveur"
import { estFicheVisible, idsFichesVisibles, peutAjouterSurFiche, peutVoirFiche } from "@/core/notes/regles"
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

// Ordres où la personne du compte est affectée (même règle que l'avancement, 4.3, et que lireOrdre).
async function ordresAffectes(tx: Tx, ctx: ContexteTeam): Promise<string[]> {
  const personne = await tx.corePerson.findFirst({ where: { teamId: ctx.teamId, userId: ctx.userId, deletedAt: null }, select: { id: true } })
  if (!personne) return []
  const liens = await tx.garageWorkOrderPerson.findMany({
    where: { teamId: ctx.teamId, personId: personne.id, deletedAt: null },
    select: { workOrderId: true },
  })
  return liens.map((lien) => lien.workOrderId)
}

// Ordres visibles pour la personne : tous à écriture et plus, sinon ceux où elle est affectée. Vide sans lecture du Garage.
async function ordresVisibles(tx: Tx, ctx: ContexteTeam): Promise<string[] | null> {
  const niveau = await niveauDe(ctx, APP)
  if (!peutVoirFiche(niveau)) return []
  return idsFichesVisibles(niveau, await ordresAffectes(tx, ctx))
}

// Fiche notable pour la synchro. Le niveau vient de l'app Garage (niveauDe).
export const ficheOrdreNotable: FicheNotable = {
  app: APP,
  ficheType: TYPE_FICHE,

  // Tirage hors ligne : l'ensemble des ordres visibles. La lecture est faite hors transaction (le tirage n'en ouvre pas).
  async idsVisibles(ctx) {
    return executerPourTeam(ctx.teamId, ctx.userId, (tx) => ordresVisibles(tx, ctx))
  },

  async peutVoir(tx, ctx, ordreId) {
    const visibles = await ordresVisibles(tx, ctx)
    if (!estFicheVisible(visibles, ordreId)) return false
    return ordreExiste(tx, ctx.teamId, ordreId)
  },

  async peutAjouter(tx, ctx, ordreId) {
    const niveau = await niveauDe(ctx, APP)
    if (!peutVoirFiche(niveau) || !(await ordreExiste(tx, ctx.teamId, ordreId))) return false
    const affectee = (await ordresAffectes(tx, ctx)).includes(ordreId)
    return peutAjouterSurFiche({ niveau, affectee })
  },
}

// Contrôle en ligne d'un ordre pour le service des notes et photos.
export function controleOrdre(ordreId: string): ControleFiche {
  const fiche: FicheNotes = { app: APP, ficheType: TYPE_FICHE, ficheId: ordreId }
  return {
    ...fiche,

    async voir(ctx: ContexteTeam) {
      const visibles = await executerPourTeam(ctx.teamId, ctx.userId, (tx) => ordresVisibles(tx, ctx))
      if (!estFicheVisible(visibles, ordreId)) refus("Ordre de travail introuvable.")
      const existe = await executerPourTeam(ctx.teamId, ctx.userId, (tx) => ordreExiste(tx, ctx.teamId, ordreId))
      if (!existe) refus("Ordre de travail introuvable.")
    },

    async contribuer(ctx: ContexteTeam) {
      const niveau = await niveauDe(ctx, APP)
      if (!peutVoirFiche(niveau)) refus("Tu n'as pas accès au Garage.")
      const affectee = await executerPourTeam(ctx.teamId, ctx.userId, async (tx) => (await ordresAffectes(tx, ctx)).includes(ordreId))
      if (!peutAjouterSurFiche({ niveau, affectee })) {
        if (niveau === "contribution") refus("Cet ordre ne t'est pas affecté.")
        refus("Tu n'as pas le droit d'ajouter une note ici.")
      }
    },

    async gerer(ctx: ContexteTeam) {
      return (await niveauDe(ctx, APP)) === "gestion"
    },
  }
}
