// Adresse IP du client, pour les limites de tentatives (brief 3.7, point 2). Derrière le proxy de Coolify (Traefik),
// x-real-ip est posé par le proxy en premier. À défaut, on prend la DERNIÈRE valeur de x-forwarded-for, celle que
// le proxy ajoute. La PREMIÈRE valeur vient du client : elle peut être inventée, et ne sert donc jamais à compter.

export interface EntetesLus {
  get(nom: string): string | null
}

export function ipClient(entetes: EntetesLus): string {
  const reelle = entetes.get("x-real-ip")?.trim()
  if (reelle) return reelle
  const valeurs = (entetes.get("x-forwarded-for") ?? "")
    .split(",")
    .map((valeur) => valeur.trim())
    .filter(Boolean)
  return valeurs.at(-1) ?? "inconnu"
}
