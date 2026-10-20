// Bilan de saison de Budget (brief 3.1b, section 4.1). Fonction pure : elle reçoit les données déjà lues et
// renvoie les chiffres du bilan. Aucun accès base ici. Les règles sont celles des écrans : le coût par
// épreuve vient de lireCoutsParEpreuve (même calcul que Par épreuve), l'écart vient de ecartPrevisionnel.
import { ecartPrevisionnel } from "./regles"

export interface MouvementBilan {
  type: "depense" | "recette"
  montant: number // centimes
  categorieId: string
  categorieNom: string
  // Dépense : confirmée (elle compte dans les totaux). Recette : encaissée. Le reste est « à venir » ou « à confirmer ».
  valide: boolean
}

export interface EntreesBilan {
  mouvements: MouvementBilan[]
  // Prévisionnel de la saison (hors épreuves), par catégorie de dépense.
  previsions: Array<{ categorieId: string; montant: number }>
  // Coûts par épreuve, tels que lireCoutsParEpreuve les renvoie.
  epreuves: Array<{ id: string; nom: string; date: string; total: number }>
  // Membres tels que lireMembres les renvoie (mêmes règles que l'écran Par membre).
  membres: Array<{ nom: string; avance: number; rembourse: number; du: number; trop: number }>
}

export interface BilanSaison {
  chiffres: {
    depensesConfirmees: number
    recettesEncaissees: number
    solde: number // recettes encaissées moins dépenses confirmées
    previsionDepenses: number | null // null s'il n'y a pas de prévisionnel
  }
  depensesParCategorie: Array<{ categorieId: string; nom: string; montant: number; part: number; prevu: number | null; ecart: number | null }>
  coutsParEpreuve: Array<{ id: string; nom: string; date: string; total: number }>
  recettes: {
    parCategorie: Array<{ categorieId: string; nom: string; montant: number }>
    aVenir: number // recettes prévues, non encaissées : une ligne à part
  }
  avancesMembres: Array<{ nom: string; avance: number; rembourse: number; resteDu: number; trop: number }>
  // Dépenses proposées par une autre app, pas encore confirmées : elles ne comptent dans aucun total.
  propositions: { nombre: number; montant: number }
  aucunMouvement: boolean
}

function somme(montants: readonly number[]): number {
  return montants.reduce((total, montant) => total + montant, 0)
}

export function bilanSaison(entrees: EntreesBilan): BilanSaison {
  const depenses = entrees.mouvements.filter((mouvement) => mouvement.type === "depense")
  const recettes = entrees.mouvements.filter((mouvement) => mouvement.type === "recette")
  const depensesConfirmees = depenses.filter((depense) => depense.valide)
  const recettesEncaissees = recettes.filter((recette) => recette.valide)
  const totalDepenses = somme(depensesConfirmees.map((depense) => depense.montant))
  const totalRecettes = somme(recettesEncaissees.map((recette) => recette.montant))

  // Dépenses par catégorie : seulement celles qui ont un montant, les plus fortes d'abord.
  const categoriesDepense = new Map<string, { nom: string; montant: number }>()
  for (const depense of depensesConfirmees) {
    const existante = categoriesDepense.get(depense.categorieId) ?? { nom: depense.categorieNom, montant: 0 }
    existante.montant += depense.montant
    categoriesDepense.set(depense.categorieId, existante)
  }
  const depensesParCategorie = Array.from(categoriesDepense.entries())
    .filter(([, categorie]) => categorie.montant > 0)
    .map(([categorieId, categorie]) => {
      const prevision = entrees.previsions.find((ligne) => ligne.categorieId === categorieId)
      return {
        categorieId,
        nom: categorie.nom,
        montant: categorie.montant,
        part: totalDepenses > 0 ? (categorie.montant / totalDepenses) * 100 : 0,
        prevu: prevision?.montant ?? null,
        ecart: prevision ? ecartPrevisionnel(prevision.montant, categorie.montant).ecart : null,
      }
    })
    .sort((a, b) => b.montant - a.montant)

  // Recettes encaissées par catégorie ; les recettes prévues non encaissées forment une ligne à part.
  const categoriesRecette = new Map<string, { nom: string; montant: number }>()
  for (const recette of recettesEncaissees) {
    const existante = categoriesRecette.get(recette.categorieId) ?? { nom: recette.categorieNom, montant: 0 }
    existante.montant += recette.montant
    categoriesRecette.set(recette.categorieId, existante)
  }
  const recettesParCategorie = Array.from(categoriesRecette.entries())
    .filter(([, categorie]) => categorie.montant > 0)
    .map(([categorieId, categorie]) => ({ categorieId, nom: categorie.nom, montant: categorie.montant }))
    .sort((a, b) => b.montant - a.montant)

  const propositionsEnAttente = depenses.filter((depense) => !depense.valide)

  return {
    chiffres: {
      depensesConfirmees: totalDepenses,
      recettesEncaissees: totalRecettes,
      solde: totalRecettes - totalDepenses,
      previsionDepenses: entrees.previsions.length > 0 ? somme(entrees.previsions.map((ligne) => ligne.montant)) : null,
    },
    depensesParCategorie,
    coutsParEpreuve: [...entrees.epreuves].sort((a, b) => a.date.localeCompare(b.date)).map((epreuve) => ({ id: epreuve.id, nom: epreuve.nom, date: epreuve.date, total: epreuve.total })),
    recettes: {
      parCategorie: recettesParCategorie,
      aVenir: somme(recettes.filter((recette) => !recette.valide).map((recette) => recette.montant)),
    },
    avancesMembres: entrees.membres.map((membre) => ({ nom: membre.nom, avance: membre.avance, rembourse: membre.rembourse, resteDu: membre.du, trop: membre.trop })),
    propositions: { nombre: propositionsEnAttente.length, montant: somme(propositionsEnAttente.map((depense) => depense.montant)) },
    aucunMouvement: entrees.mouvements.length === 0,
  }
}
