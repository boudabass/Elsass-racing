"use server"

// Server Actions de Budget. N'exportent que des enveloppes des fonctions gardées de services-serveur.ts,
// jamais une fonction …Dans(ctx, …). Chacune renvoie { ok: true } ou { ok: false, message } en français.

import { executer, texte, texteOuNull, type Resultat } from "@/core/sdk/actions-serveur"

import { montantSaisi } from "./saisie"
import {
  ErreurBudget,
  confirmerSuggestion,
  creerDepense,
  creerRecette,
  definirPrevisionnel,
  encaisserRecette,
  ignorerSuggestion,
  modifierDepense,
  modifierRecette,
  rembourser,
  supprimerDepense,
  supprimerRecette,
} from "./services-serveur"

export type { Resultat }

const executerBudget = (action: () => Promise<string | void>) => executer("/apps/budget", action)

function montantOuErreur(donnees: FormData, cle: string): number {
  const centimes = montantSaisi(texte(donnees, cle))
  if (centimes === null) throw new ErreurBudget("Montant attendu, par exemple 45,50.")
  return centimes
}

export async function creerDepenseAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executerBudget(() => {
    const date = texteOuNull(donnees, "date")
    return creerDepense({
      montant: montantOuErreur(donnees, "montant"),
      categoryId: texte(donnees, "categoryId"),
      payerId: texteOuNull(donnees, "payerId") ?? undefined,
      libelle: texteOuNull(donnees, "libelle") ?? undefined,
      date: date ?? undefined,
      eventId: texteOuNull(donnees, "eventId"),
    })
  })
}

export async function creerRecetteAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executerBudget(async () => {
    const enNature = donnees.get("enNature") === "on"
    const encaissee = donnees.get("statut") === "encaissee"
    const recetteId = await creerRecette({
      montant: enNature ? 0 : montantOuErreur(donnees, "montant"),
      categoryId: texte(donnees, "categoryId"),
      libelle: texte(donnees, "libelle"),
      date: texteOuNull(donnees, "date") ?? undefined,
      eventId: texteOuNull(donnees, "eventId"),
      provenancePersonId: texteOuNull(donnees, "provenancePersonId"),
      enNature,
      descriptionNature: enNature ? texteOuNull(donnees, "descriptionNature") : null,
      valeurEstimee: enNature ? montantOuErreur(donnees, "valeurEstimee") : null,
    })
    if (encaissee) await encaisserRecette({ recetteId, payerId: texte(donnees, "payerId") })
    return recetteId
  })
}

// Sans date, le service prend aujourd'hui (brief 3.9, §3).
export async function encaisserRecetteAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executerBudget(() =>
    encaisserRecette({ recetteId: texte(donnees, "recetteId"), payerId: texte(donnees, "payerId"), date: texteOuNull(donnees, "date") ?? undefined }),
  )
}

// Remboursement : le montant total est celui de l'écran ; chaque dépense cochée porte son montant
// (champ « montant-<id> »). Le service vérifie que le total des lignes égale le montant.
export async function rembourserAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executerBudget(() => {
    const lignes = Array.from(donnees.getAll("depense")).map((depenseId) => ({
      expenseId: String(depenseId),
      montant: montantOuErreur(donnees, `montant-${String(depenseId)}`),
    }))
    return rembourser({
      personId: texte(donnees, "personId"),
      montant: montantOuErreur(donnees, "montant"),
      date: texteOuNull(donnees, "date") ?? undefined,
      moyen: texte(donnees, "moyen") as "carte" | "especes" | "cheque" | "virement",
      payerId: texte(donnees, "payerId"),
      commentaire: texteOuNull(donnees, "commentaire"),
      lignes,
    })
  })
}

// Prévisionnel en un seul envoi : un champ « prevu-<catégorie> » par ligne. Un champ vide n'est pas enregistré.
export async function enregistrerPrevisionnelAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executerBudget(async () => {
    const seasonId = texte(donnees, "seasonId")
    const eventId = texteOuNull(donnees, "eventId")
    for (const cle of Array.from(donnees.keys())) {
      if (!cle.startsWith("prevu-") || texte(donnees, cle) === "") continue
      await definirPrevisionnel({
        seasonId,
        categoryId: cle.slice("prevu-".length),
        eventId,
        montant: montantOuErreur(donnees, cle),
        commentaire: null,
      })
    }
  })
}

export async function confirmerSuggestionAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executerBudget(() =>
    confirmerSuggestion(texte(donnees, "id"), {
      payerId: texteOuNull(donnees, "payerId") ?? undefined,
      categoryId: texteOuNull(donnees, "categoryId") ?? undefined,
    }),
  )
}

export async function ignorerSuggestionAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executerBudget(async () => {
    await ignorerSuggestion(texte(donnees, "id"))
  })
}

// Modification d'un mouvement (dépense ou recette selon le champ « type »).
export async function modifierMouvementAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executerBudget(async () => {
    const eventId = texteOuNull(donnees, "eventId")
    const date = texteOuNull(donnees, "date") ?? undefined
    if (texte(donnees, "type") === "recette") {
      await modifierRecette(texte(donnees, "id"), {
        montant: montantOuErreur(donnees, "montant"),
        categoryId: texte(donnees, "categoryId"),
        libelle: texte(donnees, "libelle"),
        date,
        eventId,
      })
      return
    }
    await modifierDepense(texte(donnees, "id"), {
      montant: montantOuErreur(donnees, "montant"),
      categoryId: texte(donnees, "categoryId"),
      libelle: texteOuNull(donnees, "libelle") ?? undefined,
      payerId: texte(donnees, "payerId"),
      date,
      eventId,
      moyen: (texteOuNull(donnees, "moyen") as "carte" | "especes" | "cheque" | "virement" | null) ?? null,
      // Champ présent dans le formulaire de dépense : vide = photo retirée.
      justificatifFileId: donnees.has("justificatifFileId") ? texteOuNull(donnees, "justificatifFileId") : undefined,
    })
  })
}

// Suppression après confirmation explicite (case cochée).
export async function supprimerMouvementAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executerBudget(async () => {
    if (donnees.get("confirme") !== "on") throw new ErreurBudget("Coche la case pour confirmer la suppression.")
    if (texte(donnees, "type") === "recette") await supprimerRecette(texte(donnees, "id"))
    else await supprimerDepense(texte(donnees, "id"))
  })
}
