"use server"

// Message laissé par le partenaire depuis sa page (brief 3.7, §6). Pas de compte : le jeton est revalidé à chaque
// envoi, et le texte est enregistré tel quel. La team le lit dans l'onglet Messages de la fiche, affiché comme du
// texte (jamais en HTML, jamais de lien cliquable).

import { newId } from "@/core/ids"
import { contexteSysteme } from "@/core/contexte-systeme-serveur"
import { emettre } from "@/core/evenements/bus-serveur"
import { avecContextePublic } from "@/lib/prisma"
import { LimiteTentatives } from "@/lib/limite-tentatives-serveur"

import { MESSAGE_LIEN_INVALIDE, trouverLienPublic } from "./lien-public"

export type ResultatMessagePartenaire = { ok: true } | { ok: false; message: string }

// Au plus 5 messages par lien et par heure. En mémoire, par instance : même réserve que les autres limites.
const LIMITE_MESSAGES = new LimiteTentatives(5, 60 * 60_000)

const MAX_NOM = 100
const MAX_MESSAGE = 2000

export async function envoyerMessagePartenaireAction(
  _etat: ResultatMessagePartenaire | null,
  donnees: FormData,
): Promise<ResultatMessagePartenaire> {
  const lien = await trouverLienPublic(String(donnees.get("jeton") ?? ""))
  if (!lien) return { ok: false, message: MESSAGE_LIEN_INVALIDE }

  // Champ piège : rempli, le formulaire a été rempli par un programme. Succès apparent, rien n'est enregistré.
  if (String(donnees.get("site") ?? "") !== "") return { ok: true }

  const nom = String(donnees.get("nom") ?? "").trim()
  const texte = String(donnees.get("message") ?? "").trim()
  if (nom === "" || nom.length > MAX_NOM) return { ok: false, message: `Indiquez votre nom (${MAX_NOM} caractères au plus).` }
  if (texte === "" || texte.length > MAX_MESSAGE) return { ok: false, message: `Écrivez votre message (${MAX_MESSAGE} caractères au plus).` }

  if (!LIMITE_MESSAGES.tenter(lien.lienId)) {
    return { ok: false, message: "Trop de messages pour l'instant. Réessayez dans quelques minutes." }
  }

  const messageId = newId()
  const suivi = await avecContextePublic(lien.teamId, async (tx) => {
    const partenaire = await tx.partenairesPartner.findFirst({
      where: { id: lien.partnerId, teamId: lien.teamId, deletedAt: null },
      select: { suiviParPersonId: true, contact: { select: { nom: true } } },
    })
    if (!partenaire) return null
    await tx.partenairesPortalMessage.create({
      data: {
        id: messageId,
        teamId: lien.teamId,
        partnerId: lien.partnerId,
        date: new Date(),
        auteurNom: nom,
        texte,
      },
    })
    // Le suivi du partenaire, s'il a un compte actif dans la team. Sinon, l'alerte va aux responsables.
    const membre = partenaire.suiviParPersonId
      ? await tx.coreMembership.findFirst({
          where: { teamId: lien.teamId, personId: partenaire.suiviParPersonId, statut: "actif", deletedAt: null },
          select: { id: true },
        })
      : null
    return { entreprise: partenaire.contact.nom, membershipId: membre?.id ?? null }
  })
  if (!suivi) return { ok: false, message: MESSAGE_LIEN_INVALIDE }

  // Alerte de la boîte d'actions (brief 3.8, point 0.3). Émise sans utilisateur, par le contexte système de la team.
  await emettre(contexteSysteme(lien.teamId, "page_partenaire"), "partenaires.action_requise", {
    type: "message_partenaire",
    cleUnicite: `message:${messageId}`,
    titre: `Nouveau message de ${suivi.entreprise}`,
    contexte: "Message laissé depuis la page partenaire.",
    ficheType: "partner",
    ficheId: lien.partnerId,
    destinataires: suivi.membershipId ? { memberships: [suivi.membershipId] } : { roles: ["responsable"] },
    boutons: [{ cle: "vu", libelle: "Vu" }],
    priorite: 3,
  })
  return { ok: true }
}
