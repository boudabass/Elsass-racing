// Vérifie les rangs de la boîte d'actions contre la base réelle (tâche 5.8, §3.4).
// Usage : pnpm db:verifier-priorites
//
// Une team de test et des actions au format ancien sont créées dans une transaction, la migration
// 20261105100000_action_priorites est jouée telle quelle, deux fois, puis la transaction est annulée : rien ne reste en base,
// même sur une base partagée. Une ligne par contrôle ; exit 1 au premier écart.
//
// Contrôles : chaque type à rang fixe prend le rang de la table (src/core/actions/priorites.ts) ; une échéance du jour ou
// passée donne 2, une échéance à venir ou sans date donne 9 ; une action décidée et un type inconnu ne bougent pas ;
// rejouer la migration ne change rien.

import { randomUUID } from "node:crypto"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import { config as chargerEnv } from "dotenv"
import { PrismaPg } from "@prisma/adapter-pg"

import { PRIORITE, prioriteEcheance, RANG_PAR_TYPE, TYPES_A_ECHEANCE, TYPES_OBLIGATION } from "../src/core/actions/priorites"
import { Prisma, PrismaClient } from "../src/generated/prisma/client"

chargerEnv({ path: ".env.local" })
chargerEnv()

const urlProprietaire = process.env.DATABASE_URL_MIGRATION
if (!urlProprietaire) {
  console.error("DATABASE_URL_MIGRATION absente : impossible de préparer les données de test.")
  process.exit(1)
}

const proprietaire = new PrismaClient({ adapter: new PrismaPg({ connectionString: urlProprietaire }) })
const MIGRATION = "20261105100000_action_priorites"

class EcartPriorites extends Error {}

// Fin volontaire de la transaction de contrôle : tout ce qu'elle a écrit est annulé.
class AnnulationVerification extends Error {}

// Instructions SQL de la migration, dans l'ordre : sans commentaires, coupées au point-virgule. Le fichier est joué tel quel.
function instructionsMigration(nom: string): string[] {
  const texte = readFileSync(resolve("prisma/migrations", nom, "migration.sql"), "utf8")
  return texte
    .split("\n")
    .filter((ligne) => !ligne.trim().startsWith("--"))
    .join("\n")
    .split(";")
    .map((instruction) => instruction.trim())
    .filter((instruction) => instruction.length > 0)
}

function controle(libelle: string, condition: boolean, detail = "") {
  if (!condition) throw new EcartPriorites(`${libelle}${detail ? ` (${detail})` : ""}`)
  console.log(`OK     ${libelle}`)
}

// Jour civil de Paris, puis minuit UTC de ce jour : la forme d'une échéance stockée (un jour, pas une heure).
function jourParisDecale(joursDecalage: number, maintenant: Date): Date {
  const jour = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(maintenant)
  return new Date(Date.parse(`${jour}T00:00:00Z`) + joursDecalage * 86_400_000)
}

async function main() {
  const suffixe = randomUUID().slice(0, 8)
  const team = { id: randomUUID(), nom: `Verif priorités ${suffixe}`, slug: `verif-priorites-${suffixe}` }
  const maintenant = new Date()
  const cle = (type: string, variante: string) => `prio-${suffixe}-${type}-${variante}`
  const base = { teamId: team.id, titre: "Verif priorités", destinataires: { roles: ["responsable"] }, boutons: [{ cle: "ok", libelle: "OK" }] }

  await proprietaire
    .$transaction(
      async (tx) => {
        await tx.coreTeam.create({ data: { id: team.id, nom: team.nom, slug: team.slug } })

        // Des rangs faux au départ : 9 partout (aucun type à rang fixe n'a 9 dans la table).
        const lignes: Prisma.CoreActionCreateManyInput[] = [
          ...Object.keys(RANG_PAR_TYPE).map((type) => ({
            ...base,
            id: randomUUID(),
            appOrigine: "checklist",
            type,
            cleUnicite: cle(type, "fixe"),
            priorite: PRIORITE.echeance_proche,
            statut: "en_attente" as const,
          })),
          // Obligations sans échéance d'action : la migration ne les touche pas (leur rang vient de leur fiche).
          ...TYPES_OBLIGATION.map((type) => ({ ...base, id: randomUUID(), appOrigine: "checklist", type, cleUnicite: cle(type, "obligation"), priorite: PRIORITE.echeance_proche, statut: "en_attente" as const, echeance: null })),
          ...TYPES_A_ECHEANCE.flatMap((type) => [
            { ...base, id: randomUUID(), appOrigine: "saison", type, cleUnicite: cle(type, "jour"), priorite: PRIORITE.echeance_proche, statut: "en_attente" as const, echeance: jourParisDecale(0, maintenant) },
            { ...base, id: randomUUID(), appOrigine: "saison", type, cleUnicite: cle(type, "avenir"), priorite: PRIORITE.echeance_proche, statut: "en_attente" as const, echeance: jourParisDecale(3, maintenant) },
            { ...base, id: randomUUID(), appOrigine: "saison", type, cleUnicite: cle(type, "sansdate"), priorite: PRIORITE.echeance_proche, statut: "en_attente" as const, echeance: null },
          ]),
          { ...base, id: randomUUID(), appOrigine: "saison", type: "resultat_a_saisir", cleUnicite: cle("resultat_a_saisir", "decidee"), priorite: PRIORITE.echeance_proche, statut: "decidee" as const },
          { ...base, id: randomUUID(), appOrigine: "saison", type: "type_inconnu", cleUnicite: cle("type_inconnu", "fixe"), priorite: PRIORITE.contrepartie, statut: "en_attente" as const },
        ]
        await tx.coreAction.createMany({ data: lignes })

        const lire = async () =>
          Object.fromEntries(
            (await tx.coreAction.findMany({ where: { teamId: team.id }, select: { cleUnicite: true, priorite: true } })).map((ligne) => [
              ligne.cleUnicite,
              ligne.priorite,
            ]),
          )

        for (const instruction of instructionsMigration(MIGRATION)) await tx.$executeRawUnsafe(instruction)
        const apres = await lire()

        for (const [type, rang] of Object.entries(RANG_PAR_TYPE)) {
          controle(`${type} prend le rang ${rang} de la table`, apres[cle(type, "fixe")] === rang, String(apres[cle(type, "fixe")]))
        }
        for (const type of TYPES_A_ECHEANCE) {
          controle(`${type} : échéance du jour, rang 2`, apres[cle(type, "jour")] === PRIORITE.echeance_depassee, String(apres[cle(type, "jour")]))
          controle(`${type} : échéance à venir, rang 9`, apres[cle(type, "avenir")] === PRIORITE.echeance_proche, String(apres[cle(type, "avenir")]))
          controle(`${type} : sans date, rang 9`, apres[cle(type, "sansdate")] === PRIORITE.echeance_proche, String(apres[cle(type, "sansdate")]))
        }
        for (const type of TYPES_OBLIGATION) {
          controle(`${type} sans échéance : la migration ne touche pas son rang`, apres[cle(type, "obligation")] === PRIORITE.echeance_proche, String(apres[cle(type, "obligation")]))
        }
        controle(
          "le rang à échéance de la base suit prioriteEcheance (2 le jour J)",
          apres[cle("cloture_engagements", "jour")] === prioriteEcheance(jourParisDecale(0, maintenant), maintenant),
        )
        controle("une action décidée ne change pas", apres[cle("resultat_a_saisir", "decidee")] === PRIORITE.echeance_proche)
        controle("un type sans rang dans la table ne change pas", apres[cle("type_inconnu", "fixe")] === PRIORITE.contrepartie)

        for (const instruction of instructionsMigration(MIGRATION)) await tx.$executeRawUnsafe(instruction)
        const rejoue = await lire()
        controle("rejouer la migration ne change rien", JSON.stringify(rejoue) === JSON.stringify(apres))

        throw new AnnulationVerification()
      },
      { timeout: 60_000 },
    )
    .catch((erreur) => {
      if (!(erreur instanceof AnnulationVerification)) throw erreur
    })

  await proprietaire.$disconnect()
}

main()
  .then(() => {
    console.log("\nPriorités vérifiées : tous les contrôles passent.")
    process.exit(0)
  })
  .catch((erreur) => {
    console.error(`\n${erreur instanceof Error ? erreur.message : erreur}`)
    process.exit(1)
  })
