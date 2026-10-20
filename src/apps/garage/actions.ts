"use server"

// Server Actions du Garage. N'exportent que des enveloppes des fonctions gardées de services-serveur.ts, jamais une
// fonction …Dans(ctx, …). Chacune renvoie { ok: true, id? } ou { ok: false, message } en français.

import { executer, texte, texteOuNull, type Resultat } from "@/core/sdk/actions-serveur"

import { refus } from "./erreurs"
import { modifierOrgane, type EntreeOrgane } from "./services-serveur"

export type { Resultat }

const executerGarage = (action: () => Promise<string | void>) => executer("/apps/garage", action)

// Nombre facultatif d'un formulaire : vide devient null, un texte qui n'est pas un entier positif est refusé.
function entierOuNull(donnees: FormData, cle: string, libelle: string): number | null {
  const valeur = texteOuNull(donnees, cle)
  if (valeur === null) return null
  if (!/^\d+$/.test(valeur) || Number(valeur) < 1) refus(`${libelle} doit être un nombre entier, supérieur à zéro.`)
  return Number(valeur)
}

// Durées de vie de référence de l'organe. Le mode d'usure dit lesquelles sont saisies : seules les durées présentes
// dans le formulaire sont écrites, une durée absente du mode reste telle quelle.
export async function renseignerDureeVieAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executerGarage(() => {
    const entree: Partial<EntreeOrgane> = {}
    if (donnees.has("dureeVieReferenceKm")) {
      entree.dureeVieReferenceKm = entierOuNull(donnees, "dureeVieReferenceKm", "La durée en kilomètres")
    }
    if (donnees.has("dureeVieReferenceEpreuves")) {
      entree.dureeVieReferenceEpreuves = entierOuNull(donnees, "dureeVieReferenceEpreuves", "La durée en épreuves")
    }
    return modifierOrgane(texte(donnees, "organeId"), entree)
  })
}
