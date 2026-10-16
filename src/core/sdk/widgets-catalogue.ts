// Widgets déclarés par app (article 962, section 3). Seule la liste est ici : le code
// de chaque widget viendra avec son app. Clés en kebab-case, noms en français.

import type { AppCle } from "../catalogue"

export interface WidgetDeclare {
  cle: string
  nom: string
}

export const WIDGETS: Record<AppCle, readonly WidgetDeclare[]> = {
  saison: [
    { cle: "prochaine-epreuve", nom: "Prochaine épreuve et compte à rebours" },
    { cle: "pret-pour-epreuve", nom: "Prêt pour l'épreuve" },
    { cle: "resultats-a-valider", nom: "Résultats à valider" },
    { cle: "bilan-saison", nom: "Bilan de la saison" },
  ],
  budget: [
    { cle: "saison-vs-previsionnel", nom: "Saison en cours contre prévisionnel" },
    { cle: "mon-solde", nom: "Mon solde" },
    { cle: "mouvements-a-confirmer", nom: "Mouvements à confirmer" },
  ],
  partenaires: [
    { cle: "relances-semaine", nom: "Relances de la semaine" },
    { cle: "contreparties-en-retard", nom: "Contreparties en retard" },
    { cle: "partenaires-actifs", nom: "Partenaires actifs et apports" },
  ],
  voiture: [
    { cle: "papiers-a-renouveler", nom: "Papiers à renouveler" },
    { cle: "emplacements-libres", nom: "Emplacements libres" },
  ],
  garage: [
    { cle: "fiabilite", nom: "Fiabilité de chaque voiture" },
    { cle: "pieces-zone-rouge", nom: "Pièces en zone rouge" },
    { cle: "travaux-livraisons", nom: "Travaux et livraisons" },
  ],
  equipe: [
    { cle: "presents-prochaine-epreuve", nom: "Présents à la prochaine épreuve" },
    { cle: "licences-a-renouveler", nom: "Licences et homologations à renouveler" },
    { cle: "mes-taches", nom: "Mes tâches d'assistance" },
  ],
  checklist: [
    { cle: "avancement-prochaine-epreuve", nom: "Avancement des listes de la prochaine épreuve" },
    { cle: "points-critiques", nom: "Points critiques ouverts" },
    { cle: "mes-points", nom: "Mes points" },
    { cle: "propositions-en-attente", nom: "Propositions en attente" },
  ],
  documents: [
    { cle: "echeances", nom: "Échéances" },
    { cle: "prochaine-echeance", nom: "Prochaine échéance" },
    { cle: "coffre-fort", nom: "Coffre-fort" },
    { cle: "partages-actifs", nom: "Partages actifs" },
  ],
  medias: [
    { cle: "dernier-album", nom: "Dernier album" },
    { cle: "credits", nom: "Crédits" },
    { cle: "visibilite-partenaires", nom: "Visibilité partenaires" },
    { cle: "file-envoi", nom: "File d'envoi" },
    { cle: "dossier-partenariat", nom: "Dossier de partenariat" },
    { cle: "dernier-trophee", nom: "Dernier trophée" },
  ],
  dashboard: [
    { cle: "objectifs", nom: "Objectifs" },
    { cle: "niveau", nom: "Niveau" },
    { cle: "derniers-trophees", nom: "Derniers trophées" },
    { cle: "journal", nom: "Journal" },
    { cle: "chiffres-saison", nom: "Chiffres de la saison" },
    { cle: "retrospective", nom: "Rétrospective" },
  ],
  settings: [],
}
