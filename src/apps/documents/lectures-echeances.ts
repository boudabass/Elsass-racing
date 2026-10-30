// Lectures de l'écran Échéances (tâche 5.4, brief §1). Trois sources, une seule règle de zone (regles.ts) :
// - les documents propres visibles (peutVoirDocument), lus ici ;
// - les papiers de Voiture, par la lecture partagée de Voiture, au niveau lecture sur Voiture ;
// - les licences et homologations d'Équipe, par la lecture partagée d'Équipe ; l'assistance ne voit que les siennes.
// Rien n'est copié : chaque ligne renvoie vers sa fiche d'origine.
import { niveauDe } from "@/core/actions/actions-serveur"
import { aAuMoins } from "@/core/droits/niveaux"
import { prismaPourTeam } from "@/lib/prisma"
import { lireEcheancesEquipe } from "@/apps/equipe/lectures-echeances-partagees"
import { lireNomsCourtsVehicules, lirePapiersVehicules, voitureActivee } from "@/apps/voiture/lectures-partagees"
import { libelleDuPapier } from "@/apps/voiture/libelles"

import { accesDocuments, personneDuMembre } from "./services-serveur"
import {
  compteARebours,
  groupeEcheance,
  peutVoirDocument,
  trierEcheances,
  zoneDocument,
  type GroupeEcheance,
  type Zone,
} from "./regles"

export interface LigneEcheance {
  cle: string
  // Libellé de la fiche : « Saxo : carte grise », « Licence de Luc », « Assurance de l'association ».
  titre: string
  // Badge de l'app d'origine.
  badge: "Documents" | "Voiture" | "Équipe"
  echeance: Date
  zone: Zone
  compteARebours: string
  // Action principale : « Renouveler » (fiche du document), ou « Ouvrir dans … » (fiche de l'app d'origine).
  action: { libelle: string; href: string }
  groupe: GroupeEcheance
}

export interface EcheancesDonnees {
  groupes: Record<GroupeEcheance, LigneEcheance[]>
  // Sources absentes de la team ou non lisibles pour la personne : un message, pas une erreur.
  sourcesMasquees: string[]
}

const VIDE: Record<GroupeEcheance, LigneEcheance[]> = { a_traiter: [], bientot: [], a_jour: [] }

export async function lireEcheances(): Promise<EcheancesDonnees> {
  const { ctx, niveau } = await accesDocuments("lecture")
  const maintenant = new Date()
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const personneId = await personneDuMembre(ctx)
  const lignes: LigneEcheance[] = []
  const sourcesMasquees: string[] = []

  // 1. Documents propres visibles.
  const documents = await client.documentsDoc.findMany({
    where: { teamId: ctx.teamId, deletedAt: null, status: "actif", validUntil: { not: null } },
    select: {
      id: true,
      title: true,
      validUntil: true,
      ownerPersonId: true,
      visibility: true,
      folder: { select: { ownerPersonId: true, visibility: true } },
    },
  })
  const acces = personneId
    ? await client.documentsAccess.findMany({
        where: { teamId: ctx.teamId, personId: personneId, deletedAt: null },
        select: { docId: true, level: true },
      })
    : []
  for (const document of documents) {
    if (!document.validUntil) continue
    const accesPersonne = acces.find((a) => a.docId === document.id)?.level ?? null
    const visible = peutVoirDocument(
      { ownerPersonId: document.ownerPersonId, visibility: document.visibility, accesPersonne },
      document.folder,
      { personId: personneId, niveau },
    )
    if (!visible) continue
    lignes.push(
      ligne({
        cle: `documents:${document.id}`,
        titre: document.title,
        badge: "Documents",
        echeance: document.validUntil,
        maintenant,
        action: { libelle: "Renouveler", href: `/apps/documents/document/${document.id}?renouveler=1` },
      }),
    )
  }

  // 2. Papiers des véhicules (Voiture).
  if ((await voitureActivee(ctx)) && aAuMoins(await niveauDe(ctx, "voiture"), "lecture")) {
    const vehicules = await client.coreVehicle.findMany({ where: { teamId: ctx.teamId, deletedAt: null, actif: true }, select: { id: true } })
    const ids = vehicules.map((v) => v.id)
    const papiers = await lirePapiersVehicules(ctx, ids)
    const noms = await lireNomsCourtsVehicules(ctx, ids)
    for (const [vehicleId, liste] of Array.from(papiers)) {
      for (const papier of liste) {
        if (!papier.valableJusquAu) continue
        lignes.push(
          ligne({
            cle: `voiture:${vehicleId}:${papier.type}:${papier.valableJusquAu.toISOString()}`,
            titre: `${libelleDuPapier(papier.type, papier.libelle)} : ${noms.get(vehicleId) ?? "véhicule"}`,
            badge: "Voiture",
            echeance: papier.valableJusquAu,
            maintenant,
            action: { libelle: "Ouvrir dans Voiture", href: `/apps/voiture/vehicules/${vehicleId}` },
          }),
        )
      }
    }
  } else {
    sourcesMasquees.push("Voiture : papiers non lisibles pour toi")
  }

  // 3. Licences et homologations (Équipe). L'assistance ne voit que les siennes.
  if (aAuMoins(await niveauDe(ctx, "equipe"), "lecture")) {
    const restreint = ctx.membership.role === "assistance" ? (personneId ? [personneId] : []) : null
    for (const echeance of await lireEcheancesEquipe(ctx, restreint)) {
      lignes.push(
        ligne({
          cle: `equipe:${echeance.kind}:${echeance.ficheId}`,
          titre: echeance.libelle,
          badge: "Équipe",
          echeance: echeance.echeance,
          maintenant,
          action: { libelle: "Ouvrir dans Équipe", href: `/apps/equipe/personnes/${echeance.personId}` },
        }),
      )
    }
  } else {
    sourcesMasquees.push("Équipe : licences et homologations non lisibles pour toi")
  }

  const groupes: Record<GroupeEcheance, LigneEcheance[]> = { a_traiter: [...VIDE.a_traiter], bientot: [...VIDE.bientot], a_jour: [...VIDE.a_jour] }
  for (const item of trierEcheances(lignes.map((l) => ({ ...l, due: l.echeance })))) {
    groupes[item.groupe].push(item)
  }
  return { groupes, sourcesMasquees }
}

// Une ligne, avec sa zone, son groupe et son compte à rebours (une seule règle pour toutes les sources).
function ligne(entree: {
  cle: string
  titre: string
  badge: LigneEcheance["badge"]
  echeance: Date
  maintenant: Date
  action: LigneEcheance["action"]
}): LigneEcheance {
  const zone = zoneDocument(entree.echeance, entree.maintenant) ?? "vert"
  return {
    cle: entree.cle,
    titre: entree.titre,
    badge: entree.badge,
    echeance: entree.echeance,
    zone,
    compteARebours: compteARebours(entree.echeance, entree.maintenant),
    action: entree.action,
    groupe: groupeEcheance(zone) ?? "a_jour",
  }
}
