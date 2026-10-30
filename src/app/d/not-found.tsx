// La même page pour tous les liens qui ne valent plus : jeton inventé, révoqué, expiré, document archivé ou supprimé.
import { MESSAGE_LIEN_DOCUMENT_INVALIDE } from "@/apps/documents/lien-public"

export default function LienDocumentIntrouvable() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-4 px-4 py-10">
      <h1 className="font-titre text-2xl uppercase">Lien non valide</h1>
      <p className="text-texte-discret">{MESSAGE_LIEN_DOCUMENT_INVALIDE}</p>
    </main>
  )
}
