// Libellés affichés pour les rôles de membre. Les valeurs techniques restent dans le schéma.

const libellesRole: Record<string, string> = {
  responsable: "Responsable",
  equipage: "Équipage",
  assistance: "Assistance",
  invite: "Invité",
}

export function libelleRole(role: string): string {
  return libellesRole[role] ?? role
}
