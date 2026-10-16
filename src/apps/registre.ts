// Registre des apps : les manifestes importés. Statique, pour l'instant.
//
// Incomplet pendant le lot 1 : seule Réglages (app témoin) y figure. Les autres apps
// s'y ajouteront à leur tâche. Une app activée en base mais absente d'ici est ignorée
// par appsVisibles, avec un avertissement console unique.

import type { AppCle } from "@/core/catalogue"
import type { ManifesteApp } from "@/core/sdk/manifeste"

import { manifesteSettings } from "./settings/manifest"

const MANIFESTES: readonly ManifesteApp[] = [manifesteSettings]

export function manifestes(): readonly ManifesteApp[] {
  return MANIFESTES
}

export function manifeste(cle: AppCle): ManifesteApp | undefined {
  return MANIFESTES.find((m) => m.cle === cle)
}
