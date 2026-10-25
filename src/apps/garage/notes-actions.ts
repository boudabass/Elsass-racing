"use server"

// Server Actions des notes et photos d'un ordre de travail (brief 5.0, §4). Chacune contrôle la session (exigerContexte)
// et les droits de l'ordre (controleOrdre) dans le service du socle. Les notes s'écrivent aussi hors ligne, par la synchro ;
// ces actions servent au réseau : photos, retrait par la gestion, et les écritures qui ne passent pas par la file.

import { exigerContexte } from "@/core/droits/garde-serveur"
import { ajouterNote, ajouterPhoto, modifierNote, retirerNote, retirerPhoto } from "@/core/notes/notes-serveur"
import { executer, texte, type Resultat } from "@/core/sdk/actions-serveur"

import { refus } from "./erreurs"
import { controleOrdre } from "./notes-serveur"

const CHEMIN = "/apps/garage"

export async function ajouterNoteOrdreAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executer(CHEMIN, async () => {
    const { contexte } = await exigerContexte()
    return ajouterNote(contexte, controleOrdre(texte(donnees, "ordreId")), texte(donnees, "texte"))
  })
}

export async function modifierNoteOrdreAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executer(CHEMIN, async () => {
    const { contexte } = await exigerContexte()
    await modifierNote(contexte, controleOrdre(texte(donnees, "ordreId")), texte(donnees, "noteId"), texte(donnees, "texte"))
  })
}

export async function retirerNoteOrdreAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executer(CHEMIN, async () => {
    const { contexte } = await exigerContexte()
    await retirerNote(contexte, controleOrdre(texte(donnees, "ordreId")), texte(donnees, "noteId"))
  })
}

// La photo part par le réseau (le bouton est inactif hors ligne). Le fichier est contrôlé par le service commun.
export async function ajouterPhotoOrdreAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executer(CHEMIN, async () => {
    const { contexte } = await exigerContexte()
    const fichier = donnees.get("fichier")
    if (!(fichier instanceof File) || fichier.size === 0) refus("Aucune photo reçue.")
    const octets = new Uint8Array(await fichier.arrayBuffer())
    return ajouterPhoto(contexte, controleOrdre(texte(donnees, "ordreId")), { octets, nomOrigine: fichier.name })
  })
}

export async function retirerPhotoOrdreAction(_etat: Resultat | null, donnees: FormData): Promise<Resultat> {
  return executer(CHEMIN, async () => {
    const { contexte } = await exigerContexte()
    await retirerPhoto(contexte, controleOrdre(texte(donnees, "ordreId")), texte(donnees, "photoId"))
  })
}
