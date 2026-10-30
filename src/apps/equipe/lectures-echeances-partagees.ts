// Échéances d'Équipe lues par Documents (tâche 5.4, brief §1 « Échéances reçues »). Lecture seule, sans copie : la licence
// (valableAu) et l'homologation d'équipement (finHomologation) gardent leur fiche dans Équipe. L'appelant contrôle le niveau
// sur Équipe ; cette lecture applique seulement la restriction de l'assistance (sa licence et ses équipements).
import type { ContexteTeam } from "@/core/contexte"
import { prismaPourTeam } from "@/lib/prisma"

import { equipeActivee } from "./lectures-partagees"

export interface EcheanceEquipe {
  kind: "licence" | "homologation"
  // Identifiant de la licence ou de l'équipement, pour le lien vers la fiche personne.
  ficheId: string
  personId: string
  personneNom: string
  libelle: string
  echeance: Date
}

// Licences et homologations d'équipement avec une date de fin. Restreintes aux personnes données (l'assistance : la sienne).
export async function lireEcheancesEquipe(ctx: ContexteTeam, personIds: string[] | null): Promise<EcheanceEquipe[]> {
  if (!(await equipeActivee(ctx))) return []
  const client = prismaPourTeam(ctx.teamId, ctx.userId)
  const filtre = personIds === null ? {} : { personId: { in: personIds } }

  const licences = await client.equipeLicence.findMany({
    where: { teamId: ctx.teamId, deletedAt: null, valableAu: { not: null }, ...filtre, person: { deletedAt: null } },
    select: { id: true, personId: true, type: true, valableAu: true, person: { select: { prenom: true, nom: true } } },
  })
  const equipements = await client.equipeGear.findMany({
    where: { teamId: ctx.teamId, deletedAt: null, finHomologation: { not: null }, ...filtre, person: { deletedAt: null } },
    select: { id: true, personId: true, type: true, marque: true, modele: true, finHomologation: true, person: { select: { prenom: true, nom: true } } },
  })

  const resultat: EcheanceEquipe[] = []
  for (const licence of licences) {
    if (!licence.valableAu) continue
    resultat.push({
      kind: "licence",
      ficheId: licence.id,
      personId: licence.personId,
      personneNom: `${licence.person.prenom} ${licence.person.nom}`,
      libelle: `Licence de ${licence.person.prenom}`,
      echeance: licence.valableAu,
    })
  }
  for (const equipement of equipements) {
    if (!equipement.finHomologation) continue
    resultat.push({
      kind: "homologation",
      ficheId: equipement.id,
      personId: equipement.personId,
      personneNom: `${equipement.person.prenom} ${equipement.person.nom}`,
      libelle: `${[equipement.marque, equipement.modele].filter(Boolean).join(" ") || "Équipement"} de ${equipement.person.prenom} : homologation`,
      echeance: equipement.finHomologation,
    })
  }
  return resultat
}
