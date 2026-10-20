// Socle des Server Actions d'une app : lecture de FormData, message d'erreur en français,
// remise à jour des écrans. Chaque app l'utilise au lieu de recopier ces fonctions.
import { revalidatePath } from "next/cache"
import { z } from "zod"

import { ErreurAcces, libelleErreurAcces } from "@/core/droits/erreurs"

export type Resultat = { ok: true; id?: string } | { ok: false; message: string }

// Refus métier d'une app : le message est en français et s'affiche tel quel.
export class ErreurMetier extends Error {}

export function texte(donnees: FormData, cle: string): string {
  return String(donnees.get(cle) ?? "").trim()
}

// Champ optionnel : vide devient null.
export function texteOuNull(donnees: FormData, cle: string): string | null {
  const valeur = texte(donnees, cle)
  return valeur === "" ? null : valeur
}

export function messageDe(erreur: unknown): string {
  if (erreur instanceof ErreurMetier) return erreur.message
  if (erreur instanceof ErreurAcces) return libelleErreurAcces(erreur)
  if (erreur instanceof z.ZodError) return erreur.issues[0]?.message ?? "Donnée invalide."
  return "L'enregistrement n'a pas pu être fait. Réessaie."
}

// Erreur ni métier ni d'accès : un bug ou un incident. Le journal du serveur garde le détail (chemin de l'app et
// pile) ; l'utilisateur ne voit que le message générique de messageDe.
export function journaliserErreurInattendue(chemin: string, erreur: unknown): void {
  if (erreur instanceof ErreurMetier || erreur instanceof ErreurAcces) return
  const pile = erreur instanceof Error ? (erreur.stack ?? erreur.message) : String(erreur)
  console.error(`[executer] Erreur inattendue dans ${chemin} :\n${pile}`)
}

export async function executer(chemin: string, action: () => Promise<string | void>): Promise<Resultat> {
  try {
    const id = await action()
    revalidatePath(chemin, "layout")
    return { ok: true, id: id ?? undefined }
  } catch (erreur) {
    journaliserErreurInattendue(chemin, erreur)
    return { ok: false, message: messageDe(erreur) }
  }
}
