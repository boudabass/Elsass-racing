// Contacts du socle (core_contact), créés depuis le champ qui les demande (brief 5.8b). Aucun écran de gestion : une ASA
// naît dans la licence, un fournisseur dans la pièce ou la commande, un prestataire dans l'intervention, comme Partenaires
// crée l'entreprise d'un prospect. Une app appelle ce service avec la transaction de sa propre écriture.
// Un contact de même nom (sans casse ni espaces de bord) est réutilisé ; la catégorie demandée s'y ajoute si elle manque.
// Pas de modification, de renommage ni de suppression ici (reporté).

import { z } from "zod"

import type { ContexteTeam } from "@/core/contexte"
import { newId } from "@/core/ids"
import { ErreurMetier } from "@/core/sdk/actions-serveur"
import type { Tx } from "@/core/synchro/registre"
import { executerPourTeam } from "@/lib/prisma"

export const CATEGORIES_CONTACT = ["partenaire", "fournisseur", "asa", "photographe", "prestataire"] as const
export type CategorieContact = (typeof CATEGORIES_CONTACT)[number]

// Même limite que le nom d'entreprise de Partenaires.
export const NOM_CONTACT_MAX = 120

// Le client d'une transaction (ou la forme qu'il expose ici) : seul core_contact est lu et écrit.
export type ClientContact = Pick<Tx, "coreContact">

export interface EntreeContact {
  nom: string
  categorie: CategorieContact
}

const schemaContact = z.object({
  nom: z
    .string()
    .trim()
    .min(1, "Donne un nom.")
    .max(NOM_CONTACT_MAX, `Le nom ne doit pas dépasser ${NOM_CONTACT_MAX} caractères.`),
  categorie: z.enum(CATEGORIES_CONTACT),
})

// Nom comparé sans casse ni espaces superflus : « Garage  Muller » = « garage muller ».
export function normaliserNom(nom: string): string {
  return nom.trim().replace(/\s+/g, " ").toLowerCase()
}

type Contact = { id: string; categories: CategorieContact[] }

// Un contact de la team qui porte ce nom, hors supprimés, lu avec le client donné.
async function chercherDans(client: ClientContact, ctx: ContexteTeam, nom: string): Promise<Contact | null> {
  const cle = normaliserNom(nom)
  const contacts = await client.coreContact.findMany({
    where: { teamId: ctx.teamId, deletedAt: null },
    select: { id: true, nom: true, categories: true },
  })
  const trouve = contacts.find((contact) => normaliserNom(contact.nom) === cle)
  return trouve ? { id: trouve.id, categories: trouve.categories } : null
}

// Lecture seule, pour une vérification avant écriture : une transaction de lecture, comme les autres écritures du socle.
export async function chercherContact(ctx: ContexteTeam, nom: string): Promise<Contact | null> {
  return executerPourTeam(ctx.teamId, ctx.userId, (tx) => chercherDans(tx, ctx, nom))
}

// Le contact d'un écran (5.8b) : un contact existant (contactId), ou un nom saisi sur place (nouveauNom), créé ou réutilisé
// avant l'écriture de l'app. Jamais les deux. Un nom vide compte comme absent. Renvoie l'id, ou null si l'écran n'en donne aucun.
export async function contactDuChoix(
  ctx: ContexteTeam,
  choix: { contactId?: string | null; nouveauNom?: string | null },
  categorie: CategorieContact,
): Promise<string | null> {
  const nouveauNom = choix.nouveauNom?.trim() ? choix.nouveauNom : null
  if (choix.contactId && nouveauNom) throw new ErreurMetier("Choisis un contact existant ou donne son nouveau nom, pas les deux.")
  if (!nouveauNom) return choix.contactId || null
  return executerPourTeam(ctx.teamId, ctx.userId, (tx) => trouverOuCreerContact(tx, ctx, { nom: nouveauNom, categorie }))
}

// Renvoie l'id du contact : celui de même nom, enrichi de la catégorie s'il ne l'avait pas, ou un nouveau contact.
export async function trouverOuCreerContact(client: ClientContact, ctx: ContexteTeam, entree: EntreeContact): Promise<string> {
  const donnees = schemaContact.safeParse(entree)
  if (!donnees.success) throw new ErreurMetier(donnees.error.issues[0]?.message ?? "Nom de contact invalide.")
  const { categorie } = donnees.data
  const nom = donnees.data.nom.replace(/\s+/g, " ")

  const existant = await chercherDans(client, ctx, nom)
  if (existant) {
    if (!existant.categories.includes(categorie)) {
      await client.coreContact.update({
        where: { id: existant.id },
        data: { categories: [...existant.categories, categorie], rev: { increment: 1 }, updatedBy: ctx.userId },
      })
    }
    return existant.id
  }

  const id = newId()
  await client.coreContact.create({
    data: {
      id,
      teamId: ctx.teamId,
      nom,
      categories: [categorie],
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    },
  })
  return id
}
