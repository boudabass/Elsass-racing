// Décision de santé de l'application, en fonction pure : sans accès à la base, pour les tests.

export type RaisonSante = "base injoignable" | "droits du rôle de l'app incomplets" | "catalogue des apps absent"

export type ResultatSante = { ok: true } | { ok: false; raison: RaisonSante }

export interface EtapesSante {
  base: boolean
  droits: boolean
  catalogue: boolean
}

// La première étape en échec donne la raison. Sans étape en échec : ok.
export function decider(etapes: EtapesSante): ResultatSante {
  if (!etapes.base) return { ok: false, raison: "base injoignable" }
  if (!etapes.droits) return { ok: false, raison: "droits du rôle de l'app incomplets" }
  if (!etapes.catalogue) return { ok: false, raison: "catalogue des apps absent" }
  return { ok: true }
}
