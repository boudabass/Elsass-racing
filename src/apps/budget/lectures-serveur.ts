// Lectures serveur de Budget (brief 2.6). Le filtrage de contribution se fait ici, côté serveur : un
// composant ne reçoit jamais un chiffre qui ne lui revient pas. Sans écriture, on ne voit que ses propres
// dépenses et son solde ; la lecture voit tout.

import { jourDeParis } from "@/core/dates"
import { prismaPourTeam } from "@/lib/prisma"

import { accesBudget, personneDuMembreDans } from "./services-serveur"
import { coutMoyen, coutParEpreuve, ecartPrevisionnel, resteDu, soldeMembre, voitTout, type Couleur } from "./regles"

export interface MouvementLu {
  id: string
  type: "depense" | "recette"
  date: string // AAAA-MM-JJ
  montantCentimes: number
  libelle: string
  categorieId: string
  categorieNom: string
  payeurId: string | null
  payeurNom: string | null
  personneId: string | null
  eventId: string | null
  eventNom: string | null
  seasonId: string | null
  // Dépense : confirmée ou non. Recette : statut « prevue » ou « encaissee ».
  statut: string
  moyen: string | null
  remboursement: string | null
  origine: string
  // Dépense : photo du ticket, si elle existe (brief 3.2). Recette : toujours null.
  justificatif: { id: string; nom: string; mimeType: string } | null
}

export interface FiltresMouvements {
  saisonId?: string | null
  eventId?: string | null
  categorieId?: string | null
  personneId?: string | null
}

function jour(date: Date): string {
  return date.toISOString().slice(0, 10)
}

// Mouvements lisibles par l'appelant. La contribution ne voit que ses dépenses (pas les recettes de la team).
export async function listerMouvements(filtres: FiltresMouvements = {}): Promise<{ mouvements: MouvementLu[]; toutVisible: boolean }> {
  const { ctx, niveau } = await accesBudget("contribution")
  const toutVisible = voitTout(niveau)
  const moi = await personneDuMembreDans(ctx)
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  // Un membre filtré : la contribution reste bornée à sa propre personne, quel que soit le filtre.
  const personneFiltre = toutVisible ? (filtres.personneId ?? null) : moi
  if (!toutVisible && personneFiltre === null) return { mouvements: [], toutVisible }

  const depensesBrutes = await client.budgetExpense.findMany({
    where: {
      teamId: ctx.teamId,
      deletedAt: null,
      ...(filtres.saisonId ? { seasonId: filtres.saisonId } : {}),
      ...(filtres.eventId ? { eventId: filtres.eventId } : {}),
      ...(filtres.categorieId ? { categoryId: filtres.categorieId } : {}),
      ...(personneFiltre ? { payer: { personId: personneFiltre } } : {}),
    },
    include: {
      category: { select: { nom: true } },
      payer: { select: { nom: true, personId: true } },
      event: { select: { nom: true } },
      justificatif: { select: { id: true, nom: true, mimeType: true } },
    },
    orderBy: [{ date: "desc" }, { id: "asc" }],
  })

  const depenses: MouvementLu[] = depensesBrutes.map((ligne) => ({
    id: ligne.id,
    type: "depense",
    date: jour(ligne.date),
    montantCentimes: ligne.montant,
    libelle: ligne.libelle,
    categorieId: ligne.categoryId,
    categorieNom: ligne.category.nom,
    payeurId: ligne.payerId,
    payeurNom: ligne.payer.nom,
    personneId: ligne.payer.personId,
    eventId: ligne.eventId,
    eventNom: ligne.event?.nom ?? null,
    seasonId: ligne.seasonId,
    statut: ligne.confirmee ? "confirmee" : "a_confirmer",
    moyen: ligne.moyen,
    remboursement: ligne.remboursement,
    origine: ligne.origine,
    justificatif: ligne.justificatif,
  }))

  let recettes: MouvementLu[] = []
  if (toutVisible && !filtres.personneId) {
    const recettesBrutes = await client.budgetIncome.findMany({
      where: {
        teamId: ctx.teamId,
        deletedAt: null,
        ...(filtres.saisonId ? { seasonId: filtres.saisonId } : {}),
        ...(filtres.eventId ? { eventId: filtres.eventId } : {}),
        ...(filtres.categorieId ? { categoryId: filtres.categorieId } : {}),
      },
      include: { category: { select: { nom: true } }, encaisseeSur: { select: { id: true, nom: true } }, event: { select: { nom: true } } },
      orderBy: [{ date: "desc" }, { id: "asc" }],
    })
    recettes = recettesBrutes.map((ligne) => ({
      id: ligne.id,
      type: "recette",
      date: jour(ligne.date),
      montantCentimes: ligne.montant,
      libelle: ligne.libelle,
      categorieId: ligne.categoryId,
      categorieNom: ligne.category.nom,
      payeurId: ligne.encaisseeSur?.id ?? null,
      payeurNom: ligne.encaisseeSur?.nom ?? null,
      personneId: null,
      eventId: ligne.eventId,
      eventNom: ligne.event?.nom ?? null,
      seasonId: ligne.seasonId,
      statut: ligne.statut,
      moyen: null,
      remboursement: null,
      origine: ligne.origine,
      justificatif: null,
    }))
  }

  const mouvements = [...depenses, ...recettes].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  return { mouvements, toutVisible }
}

// Une fiche : la contribution n'ouvre que ses propres dépenses.
export async function lireMouvement(id: string): Promise<MouvementLu | null> {
  const { mouvements } = await listerMouvements({})
  return mouvements.find((mouvement) => mouvement.id === id) ?? null
}

// Choix des formulaires : catégories, payeurs actifs, « moi », épreuves (et la première en cours).
export async function lireChoix(): Promise<{
  // Catégorie « Engagement » : elle préremplit l'engagement concerné d'une dépense.
  categorieEngagementId: string | null
  categoriesDepense: Array<{ id: string; nom: string }>
  categoriesRecette: Array<{ id: string; nom: string }>
  payeurs: Array<{ id: string; nom: string; type: string }>
  moiId: string | null
  epreuves: Array<{ id: string; nom: string; seasonId: string; dateDebut: string; dateFin: string }>
  epreuveEnCoursId: string | null
  saisons: Array<{ id: string; annee: number }>
  engagements: Array<{ id: string; eventId: string; libelle: string }>
}> {
  const { ctx } = await accesBudget("contribution")
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const [categories, payeurs, epreuves, saisons, moi, engagements] = await Promise.all([
    client.budgetCategory.findMany({ where: { teamId: ctx.teamId, active: true, deletedAt: null }, orderBy: [{ ordre: "asc" }, { nom: "asc" }], select: { id: true, nom: true, sens: true, cle: true } }),
    client.budgetPayer.findMany({ where: { teamId: ctx.teamId, actif: true, deletedAt: null }, orderBy: [{ type: "asc" }, { nom: "asc" }], select: { id: true, nom: true, type: true, personId: true } }),
    client.coreEvent.findMany({ where: { teamId: ctx.teamId, deletedAt: null }, orderBy: [{ dateDebut: "desc" }], select: { id: true, nom: true, seasonId: true, dateDebut: true, dateFin: true } }),
    client.coreSeason.findMany({ where: { teamId: ctx.teamId, deletedAt: null }, orderBy: [{ annee: "desc" }], select: { id: true, annee: true } }),
    personneDuMembreDans(ctx),
    client.coreEventEntry.findMany({ where: { teamId: ctx.teamId, deletedAt: null }, select: { id: true, eventId: true, vehicle: { select: { nomCourt: true } }, event: { select: { nom: true } } } }),
  ])
  const aujourdhui = new Date(`${jourDeParis(new Date())}T00:00:00Z`)
  const enCours = epreuves.find((epreuve) => epreuve.dateDebut <= aujourdhui && epreuve.dateFin >= aujourdhui)
  return {
    categorieEngagementId: categories.find((categorie) => categorie.cle === "engagement")?.id ?? null,
    categoriesDepense: categories.filter((categorie) => categorie.sens === "depense").map(({ id, nom }) => ({ id, nom })),
    categoriesRecette: categories.filter((categorie) => categorie.sens === "recette").map(({ id, nom }) => ({ id, nom })),
    payeurs: payeurs.map(({ id, nom, type }) => ({ id, nom, type })),
    moiId: payeurs.find((payeur) => payeur.personId !== null && payeur.personId === moi)?.id ?? null,
    epreuves: epreuves.map((epreuve) => ({
      id: epreuve.id,
      nom: epreuve.nom,
      seasonId: epreuve.seasonId,
      dateDebut: jour(epreuve.dateDebut),
      dateFin: jour(epreuve.dateFin),
    })),
    epreuveEnCoursId: enCours?.id ?? null,
    saisons: saisons.map(({ id, annee }) => ({ id, annee })),
    engagements: engagements.map((entree) => ({ id: entree.id, eventId: entree.eventId, libelle: `${entree.vehicle.nomCourt} · ${entree.event.nom}` })),
  }
}

// Coût réel de chaque épreuve de la saison, détail par catégorie, et moyenne des rallyes.
export async function lireCoutsParEpreuve(saisonId: string): Promise<{
  epreuves: Array<{
    id: string
    nom: string
    type: string
    total: number
    prevuCentimes: number | null
    parCategorie: Array<{ categorieId: string; nom: string; montant: number }>
  }>
  moyenneRallye: number | null
  totalSaisonCentimes: number
}> {
  const { ctx } = await accesBudget("lecture")
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const epreuves = await client.coreEvent.findMany({ where: { teamId: ctx.teamId, seasonId: saisonId, deletedAt: null }, select: { id: true, nom: true, type: true }, orderBy: [{ dateDebut: "asc" }] })
  const depenses = await client.budgetExpense.findMany({
    where: { teamId: ctx.teamId, seasonId: saisonId, deletedAt: null, confirmee: true },
    select: { montant: true, confirmee: true, eventId: true, categoryId: true, category: { select: { nom: true } } },
  })
  const lignes = depenses.map((depense) => ({ montant: depense.montant, confirmee: depense.confirmee, eventId: depense.eventId }))
  // Prévu par épreuve : la somme des prévisionnels de l'épreuve, quand il en existe.
  const previsions = await client.budgetForecast.groupBy({
    by: ["eventId"],
    where: { teamId: ctx.teamId, seasonId: saisonId, eventId: { not: null }, deletedAt: null },
    _sum: { montant: true },
  })
  const prevuParEpreuve = new Map(previsions.map((ligne) => [ligne.eventId, ligne._sum.montant ?? 0]))
  const resultats = epreuves.map((epreuve) => {
    const parCategorieMap = new Map<string, { categorieId: string; nom: string; montant: number }>()
    for (const depense of depenses.filter((d) => d.eventId === epreuve.id)) {
      const existante = parCategorieMap.get(depense.categoryId) ?? { categorieId: depense.categoryId, nom: depense.category.nom, montant: 0 }
      existante.montant += depense.montant
      parCategorieMap.set(depense.categoryId, existante)
    }
    return {
      id: epreuve.id,
      nom: epreuve.nom,
      type: epreuve.type,
      total: coutParEpreuve(lignes, epreuve.id),
      prevuCentimes: prevuParEpreuve.get(epreuve.id) ?? null,
      parCategorie: Array.from(parCategorieMap.values()).sort((a, b) => b.montant - a.montant),
    }
  })
  const rallyes = resultats.filter((epreuve) => epreuve.type === "rallye").map((epreuve) => epreuve.total)
  return { epreuves: resultats, moyenneRallye: coutMoyen(rallyes), totalSaisonCentimes: lignes.reduce((total, ligne) => total + ligne.montant, 0) }
}

// Solde par membre : avancé (dépenses confirmées à rembourser qu'il a payées), remboursé, solde.
// La contribution ne voit que sa propre ligne.
export async function lireMembres(): Promise<
  Array<{ personneId: string; nom: string; avance: number; rembourse: number; du: number; trop: number }>
> {
  const { ctx, niveau } = await accesBudget("lecture")
  const moi = await personneDuMembreDans(ctx)
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const payeurs = await client.budgetPayer.findMany({
    where: { teamId: ctx.teamId, type: "membre", deletedAt: null, personId: { not: null } },
    select: { personId: true, nom: true },
  })
  const depenses = await client.budgetExpense.findMany({
    where: { teamId: ctx.teamId, deletedAt: null },
    select: { montant: true, confirmee: true, aRembourser: true, payer: { select: { personId: true } } },
  })
  const remboursements = await client.budgetReimbursement.findMany({
    where: { teamId: ctx.teamId, deletedAt: null },
    select: { personId: true, montant: true },
  })
  const lignes = payeurs
    .filter((payeur): payeur is { personId: string; nom: string } => payeur.personId !== null)
    .filter((payeur) => voitTout(niveau) || payeur.personId === moi)
    .map((payeur) => {
      const avance = depenses
        .filter((depense) => depense.confirmee && depense.aRembourser && depense.payer.personId === payeur.personId)
        .reduce((total, depense) => total + depense.montant, 0)
      const rembourse = remboursements.filter((r) => r.personId === payeur.personId).reduce((total, r) => total + r.montant, 0)
      const solde = soldeMembre(
        payeur.personId,
        depenses.map((depense) => ({ montant: depense.montant, confirmee: depense.confirmee, aRembourser: depense.aRembourser, personneId: depense.payer.personId })),
        remboursements.map((r) => ({ personneId: r.personId, montant: r.montant })),
      )
      return { personneId: payeur.personId, nom: payeur.nom, avance, rembourse, du: solde.du, trop: solde.trop }
    })
  return lignes.sort((a, b) => a.nom.localeCompare(b.nom, "fr"))
}

// Prévisionnel de la saison, par catégorie de dépense : prévu, réel confirmé, écart et couleur.
// Prévu et réel par catégorie : de la saison entière, ou d'une épreuve (prévu et dépenses confirmées de cette épreuve).
export async function lirePrevisionnel(saisonId: string, epreuveId: string | null = null): Promise<
  Array<{ categorieId: string; nom: string; prevu: number | null; reel: number; ecart: number; pourcent: number | null; couleur: Couleur | null }>
> {
  const { ctx } = await accesBudget("lecture")
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const [categories, previsions, depenses] = await Promise.all([
    client.budgetCategory.findMany({ where: { teamId: ctx.teamId, sens: "depense", active: true, deletedAt: null }, orderBy: [{ ordre: "asc" }], select: { id: true, nom: true } }),
    client.budgetForecast.findMany({ where: { teamId: ctx.teamId, seasonId: saisonId, eventId: epreuveId, deletedAt: null }, select: { categoryId: true, montant: true } }),
    client.budgetExpense.findMany({ where: { teamId: ctx.teamId, seasonId: saisonId, ...(epreuveId ? { eventId: epreuveId } : {}), confirmee: true, deletedAt: null }, select: { categoryId: true, montant: true } }),
  ])
  return categories.map((categorie) => {
    const prevu = previsions.find((prevision) => prevision.categoryId === categorie.id)?.montant ?? null
    const reel = depenses.filter((depense) => depense.categoryId === categorie.id).reduce((total, depense) => total + depense.montant, 0)
    if (prevu === null) return { categorieId: categorie.id, nom: categorie.nom, prevu: null, reel, ecart: reel, pourcent: null, couleur: reel > 0 ? "rouge" : null }
    const ecart = ecartPrevisionnel(prevu, reel)
    return { categorieId: categorie.id, nom: categorie.nom, prevu, reel, ecart: ecart.ecart, pourcent: ecart.pourcent, couleur: ecart.couleur }
  })
}

// Mouvements proposés en attente de confirmation (boîte « À confirmer »).
export async function listerSuggestions(): Promise<
  Array<{
    id: string
    sens: string
    montantCentimes: number
    libelle: string
    categorieId: string
    categorieNom: string
    payeurId: string | null
    payeurNom: string | null
    eventNom: string | null
    appOrigine: string
    evenementOrigine: string
  }>
> {
  const { ctx } = await accesBudget("ecriture")
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const suggestions = await client.budgetSuggestion.findMany({
    where: { teamId: ctx.teamId, statut: "en_attente", deletedAt: null },
    include: { category: { select: { nom: true } }, payer: { select: { id: true, nom: true } }, event: { select: { nom: true } } },
    orderBy: [{ createdAt: "asc" }],
  })
  return suggestions.map((suggestion) => ({
    id: suggestion.id,
    sens: suggestion.sens,
    montantCentimes: suggestion.montant,
    libelle: suggestion.libelle,
    categorieId: suggestion.categoryId,
    categorieNom: suggestion.category.nom,
    payeurId: suggestion.payer?.id ?? null,
    payeurNom: suggestion.payer?.nom ?? null,
    eventNom: suggestion.event?.nom ?? null,
    appOrigine: suggestion.appOrigine,
    evenementOrigine: suggestion.evenementOrigine,
  }))
}

export async function compterSuggestions(): Promise<number> {
  const { ctx } = await accesBudget("ecriture")
  return prismaPourTeam(ctx.teamId, ctx.userId).budgetSuggestion.count({ where: { teamId: ctx.teamId, statut: "en_attente", deletedAt: null } })
}

// Solde de l'appelant : ce que la team lui doit, et un éventuel trop-perçu à signaler.
export async function lireSoldeMoi(): Promise<{ du: number; trop: number } | null> {
  const { ctx } = await accesBudget("contribution")
  const moi = await personneDuMembreDans(ctx)
  if (moi === null) return null
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const depenses = await client.budgetExpense.findMany({
    where: { teamId: ctx.teamId, deletedAt: null },
    select: { montant: true, confirmee: true, aRembourser: true, payer: { select: { personId: true } } },
  })
  const remboursements = await client.budgetReimbursement.findMany({
    where: { teamId: ctx.teamId, personId: moi, deletedAt: null },
    select: { montant: true },
  })
  return soldeMembre(
    moi,
    depenses.map((depense) => ({ montant: depense.montant, confirmee: depense.confirmee, aRembourser: depense.aRembourser, personneId: depense.payer.personId })),
    remboursements.map((remboursement) => ({ personneId: moi, montant: remboursement.montant })),
  )
}

// Dépenses confirmées à rembourser à une personne, avec leur reste dû (les plus anciennes d'abord).
export async function lireARembourser(personneId: string): Promise<Array<{ id: string; libelle: string; date: string; resteCentimes: number }>> {
  const { ctx } = await accesBudget("gestion")
  const lignes = await prismaPourTeam(ctx.teamId, ctx.userId).budgetExpense.findMany({
    where: { teamId: ctx.teamId, deletedAt: null, confirmee: true, aRembourser: true, payer: { personId: personneId } },
    include: { lignes: { where: { deletedAt: null }, select: { montant: true } } },
    orderBy: [{ date: "asc" }, { id: "asc" }],
  })
  return lignes
    .map((ligne) => ({
      id: ligne.id,
      libelle: ligne.libelle,
      date: jour(ligne.date),
      resteCentimes: resteDu(ligne.montant, ligne.lignes.map((existante) => existante.montant)),
    }))
    .filter((depense) => depense.resteCentimes > 0)
}
