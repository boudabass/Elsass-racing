// Catalogue des événements de domaine. Règle absolue : aucun nom hors de cette liste.
//
// Un événement est émis par une app et écouté par d'autres. Dans ecoutePar :
//   - une clé d'app (ex. "budget") ;
//   - "core" : le socle et l'enveloppe du QG ;
//   - "*" : toutes les apps sauf l'émetteur.
//
// Motifs génériques, valides pour toute app du catalogue (cf. estNomValide) :
//   <app>.action_requise et <app>.action_levee → écoutés par le socle.
// core.action_decidee : émis par le socle, livré à l'app d'origine de l'action
// (destinataire dynamique, porté par les données de l'action).

import type { AppCle } from "../catalogue"

export type Destinataire = AppCle | "core" | "*"

export interface Evenement {
  nom: string
  emisPar: AppCle | "core"
  // Liste vide pour core.action_decidee : le destinataire est dynamique.
  ecoutePar: readonly Destinataire[]
}

export const EVENEMENTS: readonly Evenement[] = [
  // saison
  { nom: "saison.saison_creee", emisPar: "saison", ecoutePar: ["dashboard"] },
  { nom: "saison.saison_cloturee", emisPar: "saison", ecoutePar: ["dashboard"] },
  { nom: "saison.prochaine_epreuve_modifiee", emisPar: "saison", ecoutePar: ["core"] },
  { nom: "saison.engagement_cree", emisPar: "saison", ecoutePar: ["equipe", "checklist", "garage"] },
  { nom: "saison.engagement_paye", emisPar: "saison", ecoutePar: ["budget"] },
  { nom: "saison.programme_publie", emisPar: "saison", ecoutePar: ["equipe", "checklist"] },
  { nom: "saison.epreuve_terminee", emisPar: "saison", ecoutePar: ["voiture", "partenaires", "medias", "checklist"] },
  { nom: "saison.abandon_declare", emisPar: "saison", ecoutePar: ["garage", "checklist"] },
  { nom: "saison.resultat_valide", emisPar: "saison", ecoutePar: ["garage", "equipe", "dashboard", "partenaires", "medias"] },
  { nom: "saison.resultat_annule", emisPar: "saison", ecoutePar: ["dashboard", "equipe", "partenaires", "medias"] },
  { nom: "saison.debrief_saisi", emisPar: "saison", ecoutePar: ["equipe"] },

  // budget
  { nom: "budget.depense_creee", emisPar: "budget", ecoutePar: ["saison"] },
  { nom: "budget.depense_confirmee", emisPar: "budget", ecoutePar: ["dashboard"] },
  { nom: "budget.recette_encaissee", emisPar: "budget", ecoutePar: ["partenaires"] },
  { nom: "budget.solde_modifie", emisPar: "budget", ecoutePar: ["core"] },
  { nom: "budget.remboursement_effectue", emisPar: "budget", ecoutePar: ["core"] },
  { nom: "budget.depassement_previsionnel", emisPar: "budget", ecoutePar: ["core"] },

  // partenaires
  { nom: "partenaires.convention_signee", emisPar: "partenaires", ecoutePar: ["budget", "voiture", "medias", "documents", "dashboard"] },
  { nom: "partenaires.convention_terminee", emisPar: "partenaires", ecoutePar: ["voiture"] },
  { nom: "partenaires.contrepartie_tenue", emisPar: "partenaires", ecoutePar: ["dashboard"] },
  { nom: "partenaires.contrepartie_en_retard", emisPar: "partenaires", ecoutePar: ["checklist", "core"] },
  { nom: "partenaires.relance_due", emisPar: "partenaires", ecoutePar: ["core"] },

  // voiture
  { nom: "voiture.fiche_modifiee", emisPar: "voiture", ecoutePar: ["saison"] },
  { nom: "voiture.emplacement_modifie", emisPar: "voiture", ecoutePar: ["partenaires", "dashboard"] },
  { nom: "voiture.logo_pose", emisPar: "voiture", ecoutePar: ["partenaires", "medias", "checklist"] },
  { nom: "voiture.papier_expire_bientot", emisPar: "voiture", ecoutePar: ["saison", "checklist", "documents", "core"] },

  // garage
  { nom: "garage.piece_achetee", emisPar: "garage", ecoutePar: ["budget"] },
  { nom: "garage.intervention_facturee", emisPar: "garage", ecoutePar: ["budget"] },
  { nom: "garage.piece_zone_rouge", emisPar: "garage", ecoutePar: ["saison", "checklist", "core"] },
  { nom: "garage.fiabilite_changee", emisPar: "garage", ecoutePar: ["saison"] },
  { nom: "garage.travail_termine", emisPar: "garage", ecoutePar: ["checklist", "core"] },

  // equipe
  { nom: "equipe.disponibilite_changee", emisPar: "equipe", ecoutePar: ["saison"] },
  { nom: "equipe.licence_payee", emisPar: "equipe", ecoutePar: ["budget"] },
  { nom: "equipe.licence_expire_bientot", emisPar: "equipe", ecoutePar: ["saison", "checklist", "documents", "core"] },
  { nom: "equipe.homologation_expire_bientot", emisPar: "equipe", ecoutePar: ["saison", "checklist", "documents", "core"] },
  { nom: "equipe.palier_atteint", emisPar: "equipe", ecoutePar: ["dashboard"] },

  // checklist
  { nom: "checklist.avancement_change", emisPar: "checklist", ecoutePar: ["saison"] },
  { nom: "checklist.liste_terminee", emisPar: "checklist", ecoutePar: ["core"] },
  { nom: "checklist.point_critique_ouvert", emisPar: "checklist", ecoutePar: ["saison"] },
  { nom: "checklist.probleme_signale", emisPar: "checklist", ecoutePar: ["garage", "core"] },

  // documents
  { nom: "documents.document_ajoute", emisPar: "documents", ecoutePar: ["core"] },
  { nom: "documents.document_expire_bientot", emisPar: "documents", ecoutePar: ["checklist", "core"] },
  { nom: "documents.document_expire", emisPar: "documents", ecoutePar: ["core"] },
  { nom: "documents.reglement_publie", emisPar: "documents", ecoutePar: ["checklist", "core"] },
  { nom: "documents.lien_partage_cree", emisPar: "documents", ecoutePar: ["core"] },
  { nom: "documents.lien_partage_revoque", emisPar: "documents", ecoutePar: ["core"] },

  // medias
  { nom: "medias.photo_identifiee", emisPar: "medias", ecoutePar: ["partenaires"] },
  { nom: "medias.publication_faite", emisPar: "medias", ecoutePar: ["partenaires"] },
  { nom: "medias.album_cree", emisPar: "medias", ecoutePar: ["core"] },
  { nom: "medias.dossier_genere", emisPar: "medias", ecoutePar: ["documents", "partenaires"] },

  // dashboard
  { nom: "dashboard.objectifs_proposes", emisPar: "dashboard", ecoutePar: ["core"] },
  { nom: "dashboard.objectifs_valides", emisPar: "dashboard", ecoutePar: ["core"] },
  { nom: "dashboard.objectif_atteint", emisPar: "dashboard", ecoutePar: ["core"] },
  { nom: "dashboard.palier_team_atteint", emisPar: "dashboard", ecoutePar: ["core"] },
  { nom: "dashboard.trophee_debloque", emisPar: "dashboard", ecoutePar: ["core"] },
  { nom: "dashboard.retrospective_prete", emisPar: "dashboard", ecoutePar: ["core"] },

  // settings
  { nom: "settings.identite_modifiee", emisPar: "settings", ecoutePar: ["core", "medias", "partenaires"] },
  { nom: "settings.membre_invite", emisPar: "settings", ecoutePar: ["equipe"] },
  { nom: "settings.membre_rejoint", emisPar: "settings", ecoutePar: ["equipe", "checklist"] },
  { nom: "settings.membre_retire", emisPar: "settings", ecoutePar: ["equipe", "checklist", "core"] },
  { nom: "settings.droits_modifies", emisPar: "settings", ecoutePar: ["core"] },
  { nom: "settings.app_activee", emisPar: "settings", ecoutePar: ["core"] },
  { nom: "settings.app_desactivee", emisPar: "settings", ecoutePar: ["core"] },
  { nom: "settings.ordre_apps_modifie", emisPar: "settings", ecoutePar: ["core"] },
  { nom: "settings.ludique_modifie", emisPar: "settings", ecoutePar: ["dashboard", "equipe", "saison"] },
  { nom: "settings.appareil_revoque", emisPar: "settings", ecoutePar: ["core"] },
  { nom: "settings.export_demande", emisPar: "settings", ecoutePar: ["*"] },
  { nom: "settings.export_pret", emisPar: "settings", ecoutePar: ["*"] },
  { nom: "settings.suppression_demandee", emisPar: "settings", ecoutePar: ["*"] },
  { nom: "settings.suppression_annulee", emisPar: "settings", ecoutePar: ["*"] },
  { nom: "settings.suppression_executee", emisPar: "settings", ecoutePar: ["*"] },

  // socle : action décidée, livrée à l'app d'origine (destinataire dynamique)
  { nom: "core.action_decidee", emisPar: "core", ecoutePar: [] },
]
