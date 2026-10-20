// Cible du middleware pour un lien non valide : la réécriture garde l'adresse du lien, et notFound() donne le 404.
import { notFound } from "next/navigation"

export const dynamic = "force-dynamic"

export default function PageIntrouvable() {
  notFound()
}
