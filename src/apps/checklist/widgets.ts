// Widgets de Check-lists (tâche 5.6, §3) : libellés purs, testés. Les lectures en base sont dans widgets-serveur.ts.
// Pas d'affichage des widgets ici : le Tableau de bord arrive au lot 6 (comme pour Saison et le Garage).
import type { CandidatEtape } from "./prochaine-etape"

// Terminaison du pluriel français : « s » à partir de deux.
const s = (nombre: number) => (nombre > 1 ? "s" : "")

export function libelleAvancementEpreuve(listes: number, avancement: number): string {
  if (listes === 0) return "Aucune liste pour cette épreuve"
  return `${listes} liste${s(listes)} · ${avancement} %`
}

export function libelleCritiquesOuverts(nombre: number): string {
  if (nombre === 0) return "Aucun point critique ouvert"
  return `${nombre} point${s(nombre)} critique${s(nombre)} ouvert${s(nombre)}`
}

export function libelleMesPoints(nombre: number): string {
  if (nombre === 0) return "Aucun point à faire pour vous"
  return `${nombre} point${s(nombre)} à faire pour vous`
}

export function libelleProposition(nombre: number): string {
  if (nombre === 0) return "Aucune proposition en attente"
  return `${nombre} proposition${s(nombre)} en attente`
}

// Ce que dit le bouton Prochaine étape, en une ligne.
export function libelleEtape(etape: CandidatEtape): string {
  if (etape.raison === "critique") return `Point critique : ${etape.libelle} (${etape.listeTitre})`
  if (etape.raison === "pour_moi") return `À faire pour vous : ${etape.libelle} (${etape.listeTitre})`
  return `Ouvrir la liste ${etape.listeTitre}, prochaine phase`
}

// Où mène le bouton : le point dans sa liste, ou la liste elle-même pour la phase suivante.
export function lienEtape(etape: CandidatEtape): string {
  const liste = `/apps/checklist/liste/${etape.listeId}`
  return etape.pointId ? `${liste}?point=${etape.pointId}` : liste
}
