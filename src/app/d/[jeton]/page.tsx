// Page publique d'un document partagé (tâche 5.4, brief §1). Hors session. Un lien qui ne vaut plus renvoie le même 404
// (voir app/d/not-found.tsx). Chaque ouverture est journalisée : une ligne et open_count, dans une seule transaction.
import { headers } from "next/headers"
import { notFound } from "next/navigation"

import { enregistrerOuverture, lirePageDocument } from "@/apps/documents/page-publique-serveur"
import { trouverLienDocument } from "@/apps/documents/lien-public"
import { ipClient } from "@/lib/ip-client"

// Jamais de cache : la page dépend du lien (révocation, expiration) et compte les ouvertures.
export const dynamic = "force-dynamic"

const dateLongue = (date: Date, fuseau: string) => date.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: fuseau })

export default async function PageDocumentPartagee({ params }: { params: Promise<{ jeton: string }> }) {
  const { jeton } = await params
  const lien = await trouverLienDocument(jeton)
  if (!lien) notFound()

  const page = await lirePageDocument(lien)
  if (!page) notFound()

  const entetes = await headers()
  const ouvert = await enregistrerOuverture(lien, ipClient(entetes), entetes.get("user-agent"))
  if (!ouvert) notFound()

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 px-4 py-10">
      <p className="text-sm text-texte-discret">{page.equipe}</p>
      <h1 className="font-titre text-2xl uppercase">{page.titre}</h1>
      <p>{page.typeLibelle}</p>
      {page.valableJusquAu ? <p>Valable jusqu&apos;au {dateLongue(page.valableJusquAu, "UTC")}</p> : null}
      {page.fichier ? (
        <a className="inline-flex min-h-11 items-center justify-center rounded-md bg-marque px-4 text-marque-texte" href={`/d/${jeton}/fichier`}>
          Ouvrir le fichier
        </a>
      ) : (
        <p className="text-texte-discret">Aucun fichier n&apos;est joint à ce document.</p>
      )}
      <p className="text-sm text-texte-discret">Lien valable jusqu&apos;au {dateLongue(page.lienValableJusquAu, "Europe/Paris")}.</p>
    </main>
  )
}
