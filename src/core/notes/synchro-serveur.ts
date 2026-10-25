// Synchro hors ligne des notes de fiche (brief 5.0, point A de l'orchestrateur). Le registre (core_note) appelle ces
// fonctions : la lecture ne renvoie une note de fiche qu'à qui voit la fiche, la poussée ne crée, ne modifie et ne retire
// une note de fiche qu'après le contrôle de la fiche. Les notes de team ne passent pas ici (controleNoteSynchro renvoie null).

import { niveauDe } from "@/core/actions/actions-serveur"
import type { ContexteTeam } from "@/core/contexte"
import type { VerdictEcriture } from "@/core/synchro/contribution"
import type { EtatLigneSynchro, Tx } from "@/core/synchro/registre"

import { fichesNotables } from "./fiches"
import { ficheDeLigne, fichesLisibles, verdictNoteFiche } from "./regles"

// Fiches notables dont la personne peut lire les notes hors ligne (au moins « lecture » sur leur app).
export async function fichesNotesLisibles(ctx: ContexteTeam): Promise<{ app: string; ficheType: string }[]> {
  const fiches = fichesNotables()
  const niveaux = Object.fromEntries(await Promise.all(fiches.map(async (fiche) => [fiche.app, await niveauDe(ctx, fiche.app)])))
  return fichesLisibles(fiches, niveaux).map(({ app, ficheType }) => ({ app, ficheType }))
}

// Contrôle d'une opération sur une note de fiche. null : la ligne n'est pas une note de fiche (la règle de la table s'applique).
// La fiche vient des champs envoyés (création) ou du contenu stocké (modification, suppression).
export async function controleNoteSynchro(
  tx: Tx,
  ctx: ContexteTeam,
  champs: Record<string, unknown> | undefined,
  etat: EtatLigneSynchro | null,
): Promise<VerdictEcriture | null> {
  const fiche = ficheDeLigne(etat ? etat.contenu : champs)
  if (!fiche) return null

  const notable = fichesNotables().find((candidate) => candidate.app === fiche.app && candidate.ficheType === fiche.ficheType)
  // Fiche absente de la liste blanche : refus visible, comme une table non déclarée.
  if (!notable) return { ok: false, raison: "Les notes de cette fiche ne se prennent pas hors ligne." }

  const creation = etat === null
  const peutVoir = await notable.peutVoir(tx, ctx, fiche.ficheId)
  const peutAjouter = creation ? await notable.peutAjouter(tx, ctx, fiche.ficheId) : false
  return verdictNoteFiche({ creation, peutVoir, peutAjouter, auteurId: etat?.auteurId ?? null, userId: ctx.userId })
}
