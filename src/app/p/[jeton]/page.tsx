// Page partenaire (brief 3.7, §1 et §3) : hors session. Un lien qui ne vaut plus renvoie le même 404 (voir
// app/p/not-found.tsx) ; le middleware a déjà vérifié le jeton, la page le revérifie pour lire les données.
import { notFound } from "next/navigation"

import { trouverLienPublic } from "@/apps/partenaires/lien-public"
import { PagePartenaireVue } from "@/apps/partenaires/composants/page-partenaire"
import { enregistrerConsultation, lirePagePartenaire } from "@/apps/partenaires/page-publique-serveur"

// Jamais de cache : la page dépend du lien (révocation, expiration) et compte les consultations.
export const dynamic = "force-dynamic"

export default async function PagePartenairePublique({ params }: { params: Promise<{ jeton: string }> }) {
  const { jeton } = await params
  const lien = await trouverLienPublic(jeton)
  if (!lien) notFound()

  const page = await lirePagePartenaire(lien)
  if (!page) notFound()

  await enregistrerConsultation(lien)
  return <PagePartenaireVue jeton={jeton} page={page} sections={lien.sections} />
}
