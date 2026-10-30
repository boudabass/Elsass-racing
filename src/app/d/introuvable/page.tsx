// Réécriture du middleware pour un lien qui ne vaut plus : la même réponse 404 que pour les liens absents.
import { notFound } from "next/navigation"

export default function DocumentIntrouvable() {
  notFound()
}
