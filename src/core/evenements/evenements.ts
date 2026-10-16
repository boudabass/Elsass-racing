// Accès au catalogue des événements : validité d'un nom, émetteur, abonnés. Pur.

import { APPS, type AppCle } from "../catalogue"

import { EVENEMENTS, type Destinataire } from "./catalogue"

const CLES_APPS: readonly string[] = APPS.map((app) => app.cle)

// Motifs génériques : <app>.action_requise et <app>.action_levee, pour toute app du catalogue.
const MOTIF_ACTION = /^([a-z]+)\.(action_requise|action_levee)$/

const NOM_DEVENEMENT_CORE_ACTION_DECIDEE = "core.action_decidee"

export function estNomValide(nom: string): boolean {
  if (EVENEMENTS.some((evenement) => evenement.nom === nom)) return true
  const motif = MOTIF_ACTION.exec(nom)
  return motif !== null && CLES_APPS.includes(motif[1])
}

// Émetteur d'un nom valide : une clé d'app, ou "core". Undefined pour un nom inconnu.
export function emetteurDe(nom: string): AppCle | "core" | undefined {
  const evenement = EVENEMENTS.find((e) => e.nom === nom)
  if (evenement) return evenement.emisPar
  const motif = MOTIF_ACTION.exec(nom)
  if (motif && CLES_APPS.includes(motif[1])) return motif[1] as AppCle
  return undefined
}

// Destinataires d'un nom valide : clés d'apps et/ou "core". "*" s'étend à toutes les
// apps sauf l'émetteur. Les motifs action_requise et action_levee vont au socle.
// core.action_decidee renvoie une liste vide : son destinataire est porté par les données.
export function abonnesDe(nom: string): Array<AppCle | "core"> {
  if (!estNomValide(nom)) return []
  if (nom === NOM_DEVENEMENT_CORE_ACTION_DECIDEE) return []

  const evenement = EVENEMENTS.find((e) => e.nom === nom)
  if (!evenement) return ["core"]

  const abonnes = new Set<AppCle | "core">()
  for (const destinataire of evenement.ecoutePar as readonly Destinataire[]) {
    if (destinataire === "*") {
      for (const app of APPS) {
        if (app.cle !== evenement.emisPar) abonnes.add(app.cle)
      }
    } else {
      abonnes.add(destinataire)
    }
  }
  return Array.from(abonnes)
}

// Vrai si ce nom est livré à l'app, par le catalogue ou par le motif dynamique du socle.
export function ecouteParCatalogue(nom: string, cle: AppCle): boolean {
  return abonnesDe(nom).includes(cle)
}
