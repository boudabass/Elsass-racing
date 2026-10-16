import { CoreAuthTokenType } from "@/generated/prisma/client"
import { envoyerMail } from "@/lib/mail-serveur"
import { prisma } from "@/lib/prisma"
import { LimiteTentatives } from "@/lib/limite-tentatives-serveur"
import { newId } from "@/core/ids"

import {
  calculerExpiration,
  DUREE_CODE_MINUTES,
  DUREE_LIEN_MINUTES,
  estFormatCode,
  genererCode,
  genererSecretLien,
  hacherCode,
  hacherSecret,
  schemaEmail,
} from "./jetons"

// Demandes de lien : 5 par 15 minutes, par couple IP + adresse.
const limiteDemandes = new LimiteTentatives(5, 15 * 60_000)
// Codes faux : 5 par 10 minutes, par adresse. Au-delà, refus pendant la fenêtre.
const limiteCodes = new LimiteTentatives(5, 10 * 60_000)

export type ResultatDemande =
  | { ok: true }
  | { ok: false; raison: "email" | "trop_de_demandes" }

export type ResultatConsommation =
  | { ok: true; userId: string }
  | { ok: false; raison: "invalide" | "bloque" }

function urlApp(): string {
  return process.env.APP_URL ?? "http://localhost:3000"
}

// Crée un jeton dont le hachage est unique. Pour un code à 6 chiffres, une collision
// avec un jeton encore en base est rare mais possible : on retire le code et on recommence.
async function creerJetonCode(userId: string, email: string, expireAt: Date): Promise<string> {
  for (let essai = 0; essai < 5; essai++) {
    const code = genererCode()
    try {
      await prisma.coreAuthToken.create({
        data: {
          id: newId(),
          userId,
          type: CoreAuthTokenType.code,
          hash: hacherCode(email, code),
          expireAt,
        },
      })
      return code
    } catch (erreur) {
      if (!estViolationUnicite(erreur)) throw erreur
    }
  }
  throw new Error("Impossible de générer un code unique.")
}

function estViolationUnicite(erreur: unknown): boolean {
  return typeof erreur === "object" && erreur !== null && (erreur as { code?: string }).code === "P2002"
}

export async function demanderConnexion(emailBrut: string, cleClient: string): Promise<ResultatDemande> {
  const analyse = schemaEmail.safeParse(emailBrut)
  if (!analyse.success) return { ok: false, raison: "email" }
  const email = analyse.data

  if (!limiteDemandes.tenter(`${cleClient}|${email}`)) {
    return { ok: false, raison: "trop_de_demandes" }
  }

  const maintenant = new Date()
  const utilisateur = await prisma.coreUser.upsert({
    where: { email },
    update: {},
    create: { id: newId(), email },
  })

  // Un nouveau jeton remplace les précédents encore ouverts : un seul lien ou code valide à la fois.
  await prisma.coreAuthToken.updateMany({
    where: { userId: utilisateur.id, utiliseAt: null },
    data: { utiliseAt: maintenant },
  })

  const secretLien = genererSecretLien()
  await prisma.coreAuthToken.create({
    data: {
      id: newId(),
      userId: utilisateur.id,
      type: CoreAuthTokenType.lien,
      hash: hacherSecret(secretLien),
      expireAt: calculerExpiration(maintenant, DUREE_LIEN_MINUTES),
    },
  })
  const code = await creerJetonCode(
    utilisateur.id,
    email,
    calculerExpiration(maintenant, DUREE_CODE_MINUTES),
  )

  const lien = `${urlApp()}/connexion/lien?t=${secretLien}`
  await envoyerMail({
    a: email,
    sujet: "Ta connexion à Elsass Racing",
    texte:
      `Bonjour,\n\n` +
      `Pour te connecter, clique sur ce lien (valable ${DUREE_LIEN_MINUTES} minutes) :\n${lien}\n\n` +
      `Ou saisis ce code (valable ${DUREE_CODE_MINUTES} minutes) :\n${code}\n\n` +
      `Si tu n'es pas à l'origine de cette demande, ignore ce message.`,
  })

  return { ok: true }
}

export async function consommerLien(secret: string): Promise<ResultatConsommation> {
  if (!secret) return { ok: false, raison: "invalide" }
  const maintenant = new Date()
  const jeton = await prisma.coreAuthToken.findUnique({ where: { hash: hacherSecret(secret) } })
  if (!jeton || jeton.type !== CoreAuthTokenType.lien) return { ok: false, raison: "invalide" }
  if (jeton.utiliseAt !== null || jeton.expireAt <= maintenant) return { ok: false, raison: "invalide" }

  // La condition sur utiliseAt rend la consommation atomique : deux clics simultanés
  // sur le même lien ne réussissent pas tous les deux.
  const marque = await prisma.coreAuthToken.updateMany({
    where: { id: jeton.id, utiliseAt: null },
    data: { utiliseAt: maintenant },
  })
  if (marque.count !== 1) return { ok: false, raison: "invalide" }

  return { ok: true, userId: jeton.userId }
}

export async function consommerCode(emailBrut: string, codeBrut: string): Promise<ResultatConsommation> {
  const analyse = schemaEmail.safeParse(emailBrut)
  if (!analyse.success) return { ok: false, raison: "invalide" }
  const email = analyse.data
  const code = codeBrut.trim()

  if (limiteCodes.estBloquee(email)) return { ok: false, raison: "bloque" }

  const maintenant = new Date()
  const jeton = estFormatCode(code)
    ? await prisma.coreAuthToken.findUnique({ where: { hash: hacherCode(email, code) } })
    : null

  const valide =
    jeton !== null &&
    jeton.type === CoreAuthTokenType.code &&
    jeton.utiliseAt === null &&
    jeton.expireAt > maintenant

  if (!valide || !jeton) {
    limiteCodes.echec(email)
    return { ok: false, raison: "invalide" }
  }

  const marque = await prisma.coreAuthToken.updateMany({
    where: { id: jeton.id, utiliseAt: null },
    data: { utiliseAt: maintenant },
  })
  if (marque.count !== 1) {
    limiteCodes.echec(email)
    return { ok: false, raison: "invalide" }
  }

  limiteCodes.reinitialiser(email)
  return { ok: true, userId: jeton.userId }
}
