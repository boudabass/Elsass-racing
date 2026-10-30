// Sel du hachage des adresses IP dans le journal des liens (tâche 5.4). Variable PARTAGE_SEL_IP (feu vert de
// l'orchestrateur, 30/10). Hors production et sans valeur : un sel de développement fixe, avec un avertissement en console.
// En production sans valeur : pas de sel, donc pas d'ouverture de lien (la page répond « Ce lien n'est plus valable »), et
// l'erreur part dans le journal serveur. Aucun échec au démarrage.

const SEL_DEVELOPPEMENT = "elsass-racing-developpement-sel-ip"

let avertissementEmis = false

export function selIp(): string | null {
  const valeur = process.env.PARTAGE_SEL_IP?.trim()
  if (valeur) return valeur
  if (process.env.NODE_ENV === "production") {
    console.error("[documents] PARTAGE_SEL_IP absente en production : aucun lien de partage ne s'ouvre tant qu'elle manque.")
    return null
  }
  if (!avertissementEmis) {
    avertissementEmis = true
    console.warn("[documents] PARTAGE_SEL_IP absente : sel de développement utilisé (hors production).")
  }
  return SEL_DEVELOPPEMENT
}
