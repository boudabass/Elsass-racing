// Lectures des widgets de Check-lists et de la prochaine étape (tâche 5.6, §3). Elles prennent le contexte de l'appelant :
// pas de garde d'écran ici, le QG est déjà gardé. Chaque lecture ne compte que les listes que le rôle voit (listeVisiblePour),
// et ne lit aucun modèle.
import { niveauDe } from "@/core/actions/actions-serveur"
import type { ContexteTeam } from "@/core/contexte"
import { aAuMoins } from "@/core/droits/niveaux"
import { prismaPourTeam } from "@/lib/prisma"
import { prochaineEpreuveDeLEquipe } from "@/apps/saison/widgets-serveur"

import { phaseSuivante, prochaineEtape, comparerEcheance, type CandidatEtape } from "./prochaine-etape"
import { avancementPourcent, listeVisiblePour, phaseEnCours, pointEnAttente, pointsCritiquesOuverts, zoneDeListe, type PhaseEpreuve } from "./regles"
import { libelleAvancementEpreuve, libelleCritiquesOuverts, libelleMesPoints, libelleProposition } from "./widgets"

// Nombre de points critiques détaillés dans le widget (le total reste exact).
const CRITIQUES_AFFICHES = 5

// Date de calendrier (@db.Date) au format AAAA-MM-JJ, ou null.
const dateIso = (date: Date | null) => date?.toISOString().slice(0, 10) ?? null

// Listes de la team que ce rôle voit, avec leurs points. Une seule lecture pour un widget.
async function listesVisibles(ctx: ContexteTeam, epreuveId?: string) {
  const listes = await prismaPourTeam(ctx.teamId, ctx.userId).checklistList.findMany({
    where: { teamId: ctx.teamId, deletedAt: null, ...(epreuveId ? { epreuveId } : {}) },
    include: {
      sections: {
        where: { deletedAt: null },
        include: { items: { where: { deletedAt: null }, select: { id: true, libelle: true, statut: true, critique: true, personneId: true } } },
      },
    },
  })
  return listes
    .filter((liste) => listeVisiblePour(ctx.membership.role, liste))
    .map((liste) => ({
      id: liste.id,
      titre: liste.titre,
      phase: liste.phase as PhaseEpreuve,
      echeance: dateIso(liste.echeance),
      ouverteAssistance: liste.ouverteAssistance,
      points: liste.sections.flatMap((section) => section.items),
    }))
}

// Personne liée au membre courant. Null si le membre n'est pas encore lié à une personne.
async function personneCourante(ctx: ContexteTeam): Promise<string | null> {
  const membre = await prismaPourTeam(ctx.teamId, ctx.userId).coreMembership.findFirst({
    where: { id: ctx.membership.id, teamId: ctx.teamId, deletedAt: null },
    select: { personId: true },
  })
  return membre?.personId ?? null
}

// Avancement des listes de la prochaine épreuve de la team, liste par liste.
export async function widgetAvancementProchaineEpreuve(ctx: ContexteTeam, maintenant: Date) {
  const epreuve = await prochaineEpreuveDeLEquipe(ctx, maintenant)
  if (!epreuve) return null
  const listes = await listesVisibles(ctx, epreuve.id)
  const avancement = avancementPourcent(listes.flatMap((liste) => liste.points))
  return {
    epreuveNom: epreuve.nom,
    avancement,
    listes: listes.map((liste) => ({
      id: liste.id,
      titre: liste.titre,
      avancement: avancementPourcent(liste.points),
      zone: zoneDeListe(liste.points),
      critiquesOuverts: pointsCritiquesOuverts(liste.points).length,
    })),
    libelle: libelleAvancementEpreuve(listes.length, avancement),
  }
}

// Points critiques ouverts de la team, les plus proches de leur échéance d'abord. Le total est exact, le détail est court.
export async function widgetPointsCritiques(ctx: ContexteTeam) {
  const listes = await listesVisibles(ctx)
  const ouverts = listes
    .flatMap((liste) =>
      liste.points
        .filter((point) => point.critique && pointEnAttente(point.statut))
        .map((point) => ({ pointId: point.id, libelle: point.libelle, listeId: liste.id, listeTitre: liste.titre, echeance: liste.echeance })),
    )
    .sort((a, b) => comparerEcheance(a.echeance, b.echeance))
  return {
    nombre: ouverts.length,
    premiers: ouverts.slice(0, CRITIQUES_AFFICHES),
    libelle: libelleCritiquesOuverts(ouverts.length),
  }
}

// Points à faire pour la personne courante, sur les listes qu'elle voit.
export async function widgetMesPoints(ctx: ContexteTeam) {
  const personne = await personneCourante(ctx)
  const listes = await listesVisibles(ctx)
  const nombre = personne ? listes.flatMap((liste) => liste.points).filter((point) => point.personneId === personne && pointEnAttente(point.statut)).length : 0
  return { nombre, libelle: libelleMesPoints(nombre) }
}

// Propositions de la 5.5a en attente : réservées à la gestion. Null pour les autres, qui ne les voient pas.
export async function widgetPropositionsEnAttente(ctx: ContexteTeam) {
  const niveau = await niveauDe(ctx, "checklist")
  if (!aAuMoins(niveau, "gestion")) return null
  const nombre = await prismaPourTeam(ctx.teamId, ctx.userId).checklistProposal.count({
    where: { teamId: ctx.teamId, statut: "proposee", deletedAt: null },
  })
  return { nombre, libelle: libelleProposition(nombre) }
}

// Prochaine étape d'une épreuve : les candidats des trois raisons, puis la règle pure (prochaine-etape.ts).
// Null s'il n'y a plus rien à faire sur cette épreuve.
export async function prochaineEtapeEpreuve(ctx: ContexteTeam, epreuveId: string): Promise<CandidatEtape | null> {
  const listes = await listesVisibles(ctx, epreuveId)
  const personne = await personneCourante(ctx)
  const candidats: CandidatEtape[] = []

  for (const liste of listes) {
    for (const point of liste.points) {
      if (!pointEnAttente(point.statut)) continue
      const base = { listeId: liste.id, listeTitre: liste.titre, pointId: point.id, libelle: point.libelle, echeance: liste.echeance }
      if (point.critique) candidats.push({ ...base, raison: "critique" })
      if (personne && point.personneId === personne) candidats.push({ ...base, raison: "pour_moi" })
    }
  }

  // Phase suivante : les listes de la phase après la phase en cours qui ont encore un point ouvert.
  const suivante = phaseSuivante(phaseEnCours(listes.map((liste) => ({ id: liste.id, phase: liste.phase, points: liste.points }))))
  if (suivante) {
    for (const liste of listes) {
      if (liste.phase === suivante && liste.points.some((point) => pointEnAttente(point.statut))) {
        candidats.push({ raison: "phase_suivante", listeId: liste.id, listeTitre: liste.titre, pointId: null, libelle: null, echeance: liste.echeance })
      }
    }
  }

  return prochaineEtape(candidats)
}
