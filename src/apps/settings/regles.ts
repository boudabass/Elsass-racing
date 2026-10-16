// Règles de Réglages, en fonctions pures (testables sans base).

export interface MembreRegle {
  id: string
  role: string
  statut: string
}

export interface ApresChangement {
  role: string
  statut: string
}

export type VerdictChangement = { ok: true } | { ok: false; raison: string }

// Une team garde toujours au moins un responsable actif. Retirer, rétrograder ou
// désactiver le dernier responsable est refusé.
export function peutChangerAcces(
  membres: readonly MembreRegle[],
  cibleId: string,
  apres: ApresChangement,
): VerdictChangement {
  const cible = membres.find((m) => m.id === cibleId)
  if (!cible) return { ok: false, raison: "Membre introuvable." }

  const etaitResponsableActif = cible.role === "responsable" && cible.statut === "actif"
  const resteResponsableActif = apres.role === "responsable" && apres.statut === "actif"
  if (!etaitResponsableActif || resteResponsableActif) return { ok: true }

  const autresResponsables = membres.filter(
    (m) => m.id !== cibleId && m.role === "responsable" && m.statut === "actif",
  )
  if (autresResponsables.length === 0) {
    return { ok: false, raison: "Nomme d'abord un autre responsable." }
  }
  return { ok: true }
}
