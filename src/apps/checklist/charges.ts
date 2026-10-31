// Charges des événements de Check-lists (tâche 5.5a, brief §5). Chaque événement émis est validé ici avant emettre().
// Les charges reçues sont lues avec safeParse : une charge inattendue est ignorée, jamais une erreur.
import { z } from "zod"

const identifiant = z.string().uuid()

// ─── Émis ────────────────────────────────────────────────────────────────────

export const chargeAvancementChange = z
  .object({
    listeId: identifiant,
    epreuveId: identifiant,
    avancement: z.number().int().min(0).max(100),
    zone: z.enum(["vert", "orange"]),
    statut: z.enum(["a_faire", "en_cours", "terminee"]),
  })
  .strict()

export const chargeListeTerminee = z.object({ listeId: identifiant, epreuveId: identifiant }).strict()

export const chargePointCritiqueOuvert = z
  .object({ listeId: identifiant, epreuveId: identifiant, pointId: identifiant })
  .strict()

export const chargeProblemeSignale = z
  .object({ listeId: identifiant, epreuveId: identifiant, pointId: identifiant })
  .strict()

// Propositions : le socle reçoit <app>.action_requise (forme de docs/evenements.md).
export const chargeActionRequise = z
  .object({
    type: z.enum(["creer_listes", "reassigner_points"]),
    cleUnicite: z.string().min(1),
    titre: z.string().min(1),
    contexte: z.string().optional(),
    ficheType: z.string().optional(),
    ficheId: identifiant.optional(),
    eventId: identifiant.optional(),
    destinataires: z.object({ roles: z.array(z.enum(["responsable"])).min(1) }).strict(),
    boutons: z.array(z.object({ cle: z.string().min(1), libelle: z.string().min(1) }).strict()).min(1).max(4),
    priorite: z.number().int().min(1).max(9),
    niveauRequis: z.enum(["lecture", "contribution", "ecriture", "gestion"]),
    cleRegroupement: z.string().optional(),
  })
  .strict()

// ─── Reçus ───────────────────────────────────────────────────────────────────

// saison.engagement_cree : l'engagement, son épreuve et son véhicule.
export const chargeEngagementCree = z
  .object({ entryId: identifiant, eventId: identifiant, vehicleId: identifiant })
  .passthrough()

// settings.membre_retire : seul le membre compte (la personne se lit sur l'adhésion).
export const chargeMembreRetire = z.object({ membershipId: identifiant }).passthrough()

// core.action_decidee : livrée à l'app d'origine (src/core/actions/actions-serveur.ts).
export const chargeDecisionAction = z
  .object({
    actionId: identifiant,
    appOrigine: z.literal("checklist"),
    type: z.string().min(1),
    decision: z.string().min(1),
    ficheId: identifiant.optional(),
    eventId: identifiant.optional(),
  })
  .passthrough()
