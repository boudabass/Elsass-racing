// Fixture : une team jetable par scénario. Le nettoyage est dans le finally de la fixture,
// donc il s'exécute même quand le test échoue.
import { test as base, expect } from "@playwright/test"

import { creerEquipe, supprimerEquipe, type Equipe } from "./session"

export const test = base.extend<{ equipe: Equipe }>({
  equipe: async ({}, utiliser) => {
    const equipe = await creerEquipe()
    try {
      await utiliser(equipe)
    } finally {
      await supprimerEquipe(equipe)
    }
  },
})

export { expect }
