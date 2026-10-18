"use server"

// Server Actions de Voiture. N'exportent que des enveloppes des fonctions gardées de services-serveur.ts,
// jamais une fonction …Dans(ctx, …). Chacune renvoie { ok: true, id? } ou { ok: false, message } en français.

import { executer, texte, texteOuNull, type Resultat } from "@/core/sdk/actions-serveur"

import { creerVehicule, type EntreeVehicule } from "./services-serveur"

export type { Resultat }

const executerVoiture = (action: () => Promise<string | void>) => executer("/apps/voiture", action)

export async function creerVehiculeAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executerVoiture(() => {
    const entree: EntreeVehicule = {
      nom: texte(donnees, "nom"),
      type: texte(donnees, "type") as EntreeVehicule["type"],
      gabaritCle: texteOuNull(donnees, "gabaritCle"),
    }
    return creerVehicule(entree)
  })
}
