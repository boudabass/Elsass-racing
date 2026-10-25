// Règles pures des notes et photos de fiche (brief 5.0, §2). Aucun accès base : importable partout, testable sans base.
// Les droits portent sur la fiche : l'app qui appelle le service dit ce que la personne peut voir et écrire (ControleFiche).
// Ici, seulement les décisions qui ne dépendent que du niveau, de l'affectation et de l'auteur.

import { aAuMoins, type Niveau } from "@/core/droits/niveaux"
import type { VerdictEcriture } from "@/core/synchro/contribution"

// Longueur maximale d'une note : même plafond que le schéma de synchro de core_note.
export const NOTE_TAILLE_MAX = 4000

export type VerdictTexte = { ok: true; texte: string } | { ok: false; raison: string }

// Texte rogné aux extrémités. Vide ou fait d'espaces : refusé. Trop long : refusé avec la limite.
export function validerTexteNote(brut: string): VerdictTexte {
  const texte = brut.trim()
  if (texte === "") return { ok: false, raison: "La note est vide : écris ce qu'il faut retenir." }
  if (texte.length > NOTE_TAILLE_MAX) return { ok: false, raison: `La note dépasse ${NOTE_TAILLE_MAX} caractères.` }
  return { ok: true, texte }
}

// Voir une fiche : au moins « lecture » sur l'app de la fiche.
export function peutVoirFiche(niveau: Niveau): boolean {
  return aAuMoins(niveau, "lecture")
}

// Ajouter une note ou une photo : écriture et plus sur toute la fiche ; contribution seulement si la personne est affectée
// à la fiche (ordre de travail, article 954). Aucun droit en dessous de la contribution.
export function peutAjouterSurFiche({ niveau, affectee }: { niveau: Niveau; affectee: boolean }): boolean {
  if (aAuMoins(niveau, "ecriture")) return true
  return niveau === "contribution" && affectee
}

// Modifier une note : son auteur seul. La gestion ne réécrit pas les notes des autres.
export function peutModifierNote({ auteurId, userId }: { auteurId: string | null; userId: string }): boolean {
  return auteurId !== null && auteurId === userId
}

// Retirer une note ou une photo : son auteur, ou la gestion (qui retire n'importe laquelle).
export function peutRetirer({ auteurId, userId, gere }: { auteurId: string | null; userId: string; gere: boolean }): boolean {
  return gere || (auteurId !== null && auteurId === userId)
}

// Affichage de l'auteur : prénom et nom de la fiche personne liée au compte, sinon l'e-mail masqué (« j***@domaine.fr »).
export function emailMasque(email: string): string {
  const [local, domaine] = email.split("@")
  if (!domaine) return "***"
  const debut = local.slice(0, 1)
  return `${debut}***@${domaine}`
}

export function nomAuteur(personne: { prenom: string; nom: string } | null, email: string | null): string {
  if (personne) {
    const complet = `${personne.prenom} ${personne.nom}`.trim()
    if (complet !== "") return complet
  }
  return email ? emailMasque(email) : "Personne inconnue"
}

// Synchro hors ligne (brief 5.0, conditions de l'orchestrateur, point A). Une note de team porte app = core et ficheType = team.
// Une note de fiche porte l'app et le type de fiche (liste blanche, src/core/notes/fiches.ts) et l'identifiant de la fiche.
export interface FicheNote {
  app: string
  ficheType: string
  ficheId: string
}

// Fiche d'une ligne synchronisée : lue dans le contenu stocké (modification, suppression) ou dans les champs envoyés (création).
// Une ligne sans app, ficheType ni ficheId (note de team) renvoie null.
export function ficheDeLigne(source: Record<string, unknown> | undefined): FicheNote | null {
  if (!source) return null
  const { app, ficheType, ficheId } = source
  if (typeof app !== "string" || typeof ficheType !== "string" || typeof ficheId !== "string") return null
  return { app, ficheType, ficheId }
}

// Fiches dont la personne peut lire les notes hors ligne : au moins « lecture » sur l'app de la fiche.
export function fichesLisibles<F extends { app: string }>(fiches: F[], niveaux: Partial<Record<string, Niveau>>): F[] {
  return fiches.filter((fiche) => aAuMoins(niveaux[fiche.app] ?? "aucun", "lecture"))
}

// Verdict d'une écriture de note de fiche à la poussée. La création exige le droit d'ajouter sur la fiche ; la modification
// et le retrait hors ligne sont réservés à l'auteur, et supposent qu'on voit encore la fiche.
export function verdictNoteFiche({
  creation,
  peutVoir,
  peutAjouter,
  auteurId,
  userId,
}: {
  creation: boolean
  peutVoir: boolean
  peutAjouter: boolean
  auteurId: string | null
  userId: string
}): VerdictEcriture {
  if (creation) return peutAjouter ? { ok: true } : { ok: false, raison: "Tu ne peux pas ajouter de note à cette fiche." }
  if (!peutVoir) return { ok: false, raison: "Tu ne peux plus voir cette fiche : la note ne se modifie plus." }
  if (!peutModifierNote({ auteurId, userId })) return { ok: false, raison: "Hors ligne, tu ne peux modifier ou retirer que tes propres notes." }
  return { ok: true }
}
