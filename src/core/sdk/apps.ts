// Assemblage des apps visibles d'une team. Pur : les données viennent de l'appelant.

import { aAuMoins, niveauEffectif, type AccesAppLigne, type DefautRoleLigne, type Niveau } from "../droits/niveaux"

import type { ManifesteApp } from "./manifeste"

export interface AppActiveeLigne {
  appCle: string
  activee: boolean
  ordre: number
}

export interface AppVisible {
  manifeste: ManifesteApp
  niveau: Niveau
  ordre: number
}

export interface ParametresApps {
  role: string
  activees: readonly AppActiveeLigne[]
  acces: readonly AccesAppLigne[]
  defauts: readonly DefautRoleLigne[]
  registre: readonly ManifesteApp[]
  avertir: (message: string) => void
}

// Une app absente du registre est signalée une seule fois par processus.
const dejaSignalees = new Set<string>()

export function calculerApps({ role, activees, acces, defauts, registre, avertir }: ParametresApps): AppVisible[] {
  const visibles: AppVisible[] = []

  for (const activee of [...activees].sort((a, b) => a.ordre - b.ordre)) {
    if (!activee.activee) continue

    const manifeste = registre.find((m) => m.cle === activee.appCle)
    if (!manifeste) {
      if (!dejaSignalees.has(activee.appCle)) {
        dejaSignalees.add(activee.appCle)
        avertir(`App « ${activee.appCle} » activée en base mais absente du registre : ignorée.`)
      }
      continue
    }

    const niveau = niveauEffectif({ role, appCle: activee.appCle, acces, defauts })
    if (!aAuMoins(niveau, "lecture")) continue

    visibles.push({ manifeste, niveau, ordre: activee.ordre })
  }

  // Réglages reste la dernière pour le responsable (article 960, section 2.1).
  if (role === "responsable") {
    const reglages = visibles.filter((v) => v.manifeste.cle === "settings")
    const autres = visibles.filter((v) => v.manifeste.cle !== "settings")
    return [...autres, ...reglages]
  }
  return visibles
}
