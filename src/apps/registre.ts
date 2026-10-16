// Registre des apps : les manifestes importés, dans l'ordre du catalogue des apps.
// Une app sans manifeste ici n'apparaît pas dans le QG (règle de la tâche 1.7).

import type { AppCle } from "@/core/catalogue"
import type { ManifesteApp } from "@/core/sdk/manifeste"

import { manifesteSaison } from "./saison/manifest"
import { manifesteBudget } from "./budget/manifest"
import { manifestePartenaires } from "./partenaires/manifest"
import { manifesteVoiture } from "./voiture/manifest"
import { manifesteGarage } from "./garage/manifest"
import { manifesteEquipe } from "./equipe/manifest"
import { manifesteChecklist } from "./checklist/manifest"
import { manifesteDocuments } from "./documents/manifest"
import { manifesteMedias } from "./medias/manifest"
import { manifesteDashboard } from "./dashboard/manifest"
import { manifesteSettings } from "./settings/manifest"

const MANIFESTES: readonly ManifesteApp[] = [
  manifesteSaison,
  manifesteBudget,
  manifestePartenaires,
  manifesteVoiture,
  manifesteGarage,
  manifesteEquipe,
  manifesteChecklist,
  manifesteDocuments,
  manifesteMedias,
  manifesteDashboard,
  manifesteSettings,
]

export function manifestes(): readonly ManifesteApp[] {
  return MANIFESTES
}

export function manifeste(cle: AppCle): ManifesteApp | undefined {
  return MANIFESTES.find((m) => m.cle === cle)
}
