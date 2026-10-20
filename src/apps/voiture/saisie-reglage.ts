// Lecture du formulaire de fiche de réglage, partagée par le serveur (modification) et le navigateur (nouvelle
// fiche, écrite dans la base locale). Module pur : ni base, ni action serveur. Il renvoie l'entrée ou un message en
// français ; chaque côté décide quoi en faire (refus côté serveur, message côté navigateur).

import type { EntreeReglage } from "./services-serveur"
import { CHAMPS_REGLAGE } from "./regles"

export type LectureSaisieReglage = { ok: true; entree: EntreeReglage } | { ok: false; message: string }

// Les valeurs arrivent en champs « v_<clé> » ; la virgule est acceptée. Un champ vide n'est pas envoyé.
const NOMBRE = /^-?\d+(?:[.,]\d+)?$/

const brut = (donnees: FormData, cle: string) => String(donnees.get(cle) ?? "").trim()
const brutOuNull = (donnees: FormData, cle: string) => brut(donnees, cle) || null

export function lireSaisieReglage(donnees: FormData): LectureSaisieReglage {
  const valeurs: Record<string, number> = {}
  for (const champ of CHAMPS_REGLAGE) {
    const texte = brutOuNull(donnees, `v_${champ.cle}`)
    if (texte === null) continue
    if (!NOMBRE.test(texte)) return { ok: false, message: `${champ.libelle} : un nombre est attendu.` }
    valeurs[champ.cle] = Number(texte.replace(",", "."))
  }

  // Épreuve : la valeur du formulaire est « entryId|eventId » (ou vide).
  const [entryId, eventId] = (brutOuNull(donnees, "epreuve") ?? "|").split("|")
  const note = brutOuNull(donnees, "note")
  return {
    ok: true,
    entree: {
      date: brut(donnees, "date"),
      eventId: eventId || null,
      entryId: entryId || null,
      conditions: brutOuNull(donnees, "conditions") as EntreeReglage["conditions"],
      revetement: brutOuNull(donnees, "revetement") as EntreeReglage["revetement"],
      valeurs,
      remarques: brut(donnees, "remarques"),
      note: note ? Number(note) : null,
      setupTemplateId: brutOuNull(donnees, "modeleId"),
    },
  }
}
