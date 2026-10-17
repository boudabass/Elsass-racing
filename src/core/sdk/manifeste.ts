// Contrat d'une app : son manifeste. Pur : aucun accès base.
//
// Le manifeste déclare ce que l'app fait connaître au socle : son identité (identique à
// l'entrée du catalogue des apps), son menu, ses widgets, et les événements qu'elle émet
// et écoute. validerManifeste vérifie tout cela contre les catalogues.

import { APPS, type AppCle } from "../catalogue"
import { abonnesDe, emetteurDe, estNomValide } from "../evenements/evenements"
import { EVENEMENTS } from "../evenements/catalogue"

import { aAuMoins, type Niveau } from "../droits/niveaux"

import { WIDGETS } from "./widgets-catalogue"

export interface EntreeMenu {
  libelle: string
  // Relatif à /apps/<cle>, avec une barre oblique initiale : "/identite".
  chemin: string
  // Droits de l'entrée (la page garde ses propres contrôles) : niveau minimum requis, et niveaux
  // pour lesquels l'entrée est masquée. Sans règle, l'entrée suit le niveau d'accès à l'app.
  niveauMinimum?: Niveau
  masquePour?: Niveau[]
}

// Vrai si l'entrée doit apparaître pour un membre de ce niveau sur l'app. Pur.
export function entreeVisible(entree: EntreeMenu, niveau: Niveau): boolean {
  if (entree.niveauMinimum && !aAuMoins(niveau, entree.niveauMinimum)) return false
  return !(entree.masquePour ?? []).includes(niveau)
}

export interface ManifesteApp {
  cle: AppCle
  nom: string
  icone: string
  version: string
  requiert: AppCle[]
  menu: EntreeMenu[]
  widgets: Array<{ cle: string; nom: string }>
  evenementsEmis: string[]
  evenementsEcoutes: string[]
}

export function validerManifeste(manifeste: ManifesteApp): string[] {
  const erreurs: string[] = []
  const { cle } = manifeste

  const entree = APPS.find((app) => app.cle === cle)
  if (!entree) {
    return [`La clé d'app « ${cle} » n'existe pas dans le catalogue des apps.`]
  }

  if (manifeste.nom !== entree.nom) {
    erreurs.push(`Le nom « ${manifeste.nom} » ne correspond pas au catalogue (« ${entree.nom} »).`)
  }
  if (manifeste.icone !== entree.icone) {
    erreurs.push(`L'icône « ${manifeste.icone} » ne correspond pas au catalogue (« ${entree.icone} »).`)
  }
  if (manifeste.version !== entree.version) {
    erreurs.push(`La version « ${manifeste.version} » ne correspond pas au catalogue (« ${entree.version} »).`)
  }
  if (manifeste.requiert.join(",") !== entree.requiert.join(",")) {
    erreurs.push(`Les apps requises ne correspondent pas au catalogue (« ${entree.requiert.join(", ") || "aucune"} »).`)
  }

  // Événements émis : ceux dont l'émetteur est cette app, plus les deux motifs génériques.
  const emisAutorises = new Set<string>([
    ...EVENEMENTS.filter((e) => e.emisPar === cle).map((e) => e.nom),
    `${cle}.action_requise`,
    `${cle}.action_levee`,
  ])
  for (const nom of manifeste.evenementsEmis) {
    if (!emisAutorises.has(nom)) {
      erreurs.push(`L'événement émis « ${nom} » n'est pas émis par « ${cle} » dans le catalogue.`)
    }
  }

  // Événements écoutés : ceux dont cette app est destinataire, plus core.action_decidee.
  for (const nom of manifeste.evenementsEcoutes) {
    if (!estNomValide(nom)) {
      erreurs.push(`L'événement écouté « ${nom} » n'existe pas dans le catalogue.`)
      continue
    }
    const destinataire = nom === "core.action_decidee" || abonnesDe(nom).includes(cle)
    if (!destinataire) {
      erreurs.push(`« ${cle} » n'écoute pas « ${nom} » dans le catalogue.`)
    }
  }

  // Widgets : clés uniques, et déclarés dans le catalogue des widgets de cette app.
  const clesWidgets = new Set<string>()
  const widgetsDeclares = new Set(WIDGETS[cle].map((w) => w.cle))
  for (const widget of manifeste.widgets) {
    if (clesWidgets.has(widget.cle)) {
      erreurs.push(`Le widget « ${widget.cle} » est déclaré deux fois.`)
    }
    clesWidgets.add(widget.cle)
    if (!widgetsDeclares.has(widget.cle)) {
      erreurs.push(`Le widget « ${widget.cle} » n'est pas dans le catalogue des widgets de « ${cle} ».`)
    }
  }

  for (const entreeMenu of manifeste.menu) {
    if (!entreeMenu.chemin.startsWith("/") || entreeMenu.chemin.startsWith("//")) {
      erreurs.push(`Le chemin de menu « ${entreeMenu.chemin} » doit commencer par une seule barre oblique.`)
    }
  }

  return erreurs
}
