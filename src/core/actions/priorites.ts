// Table unique des priorités de la boîte d'actions (article 960, section 5). Pur : aucun accès base.
// Une app ne met jamais un chiffre en dur : elle prend un rang nommé ici. Le socle s'en sert pour trier
// (prochaine-etape.ts) et l'écran pour expliquer le choix (« pourquoi »). db:verifier-priorites contrôle la base contre ces valeurs.

export const PRIORITE = {
  // Bloquant pour une épreuve. Aucune app ne l'émet à ce jour (plan §5.8, « reportés après le lot 5 »).
  bloquant: 1,
  // Échéance dépassée ou du jour (voir prioriteEcheance).
  echeance_depassee: 2,
  // Résultat à saisir ou à valider : les trophées et statistiques attendent.
  resultat: 3,
  mouvement_a_confirmer: 4,
  // Contrepartie due à un partenaire, ou preuve à poser.
  contrepartie: 5,
  relance: 6,
  // Suggestion de préparation : tâche de problème, point critique, reconnaissance, programme du jour, disponibilité.
  suggestion: 7,
  // Proposition d'une autre app à confirmer : Check-lists, Garage, Partenaires, Voiture, clôture de saison.
  proposition: 8,
  // Échéance à venir : la date n'est ni dépassée ni aujourd'hui.
  echeance_proche: 9,
} as const

export type Priorite = (typeof PRIORITE)[keyof typeof PRIORITE]

// Rang par type d'action, quand il ne dépend pas d'une échéance. Les types à échéance n'y sont pas : leur rang vient de prioriteEcheance.
// db:verifier-priorites et les tests lisent cette table ; les apps passent le rang (PRIORITE.x) à l'émission.
export const RANG_PAR_TYPE: Record<string, Priorite> = {
  ajouter_point: PRIORITE.proposition,
  cocher_point: PRIORITE.proposition,
  creer_liste_retour: PRIORITE.proposition,
  relire_liste: PRIORITE.proposition,
  creer_listes: PRIORITE.proposition,
  reassigner_points: PRIORITE.proposition,
  ordre_depuis_point: PRIORITE.proposition,
  message_partenaire: PRIORITE.proposition,
  emplacement_pris: PRIORITE.proposition,
  emplacement_supprime: PRIORITE.proposition,
  reserver_emplacement: PRIORITE.proposition,
  liberer_emplacement: PRIORITE.proposition,
  cloture_saison_proposee: PRIORITE.proposition,
  point_critique: PRIORITE.suggestion,
  tache_probleme: PRIORITE.suggestion,
  reconnaissance: PRIORITE.suggestion,
  programme_du_jour: PRIORITE.suggestion,
  disponibilite_a_repondre: PRIORITE.suggestion,
  mouvement_a_confirmer: PRIORITE.mouvement_a_confirmer,
  preuve_pose: PRIORITE.contrepartie,
  publications_promises: PRIORITE.contrepartie,
  contrepartie_en_retard: PRIORITE.contrepartie,
  tache_relance: PRIORITE.relance,
  resultat_a_saisir: PRIORITE.resultat,
  resultat_a_valider: PRIORITE.resultat,
}

// Types dont le rang dépend de la date d'échéance (prioriteEcheance).
export const TYPES_A_ECHEANCE = [
  "cloture_engagements",
  "licence_a_renouveler",
  "homologation_a_renouveler",
  "papier_a_renouveler",
  "renouveler_document",
  "marquer_engagement_paye",
] as const

// Jour civil « AAAA-MM-JJ » de Paris pour un instant.
function jourParis(instant: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(instant)
}

// Échéance dépassée ou du jour : 2. À venir : 9. L'échéance est un jour (stocké à minuit UTC).
export function prioriteEcheance(echeance: Date, maintenant: Date): Priorite {
  const jourEcheance = echeance.toISOString().slice(0, 10)
  return jourEcheance <= jourParis(maintenant) ? PRIORITE.echeance_depassee : PRIORITE.echeance_proche
}

// Ligne « pourquoi » du bouton Prochaine étape, par rang. Le nom de l'épreuve sert au rang 1.
export function pourquoi(priorite: number, epreuveNom?: string): string {
  switch (priorite) {
    case PRIORITE.bloquant:
      return epreuveNom ? `Bloquant pour ${epreuveNom}` : "Bloquant"
    case PRIORITE.echeance_depassee:
      return "Échéance dépassée ou aujourd'hui"
    case PRIORITE.resultat:
      return "Résultat à saisir ou à valider : trophées et statistiques en attente"
    case PRIORITE.mouvement_a_confirmer:
      return "Mouvement à confirmer"
    case PRIORITE.contrepartie:
      return "Contrepartie ou preuve de partenaire à régler"
    case PRIORITE.relance:
      return "Relance due"
    case PRIORITE.suggestion:
      return "Suggestion de préparation"
    case PRIORITE.proposition:
      return "Proposition à confirmer"
    default:
      return "Échéance proche"
  }
}
