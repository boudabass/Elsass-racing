// Rendu d'un document PDF côté serveur, et réponse HTTP qui le télécharge (brief 3.1b, section 3).
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer"
import type { ReactElement } from "react"

// Un élément dont le composant racine renvoie un <Document> : son type exact n'est pas exprimable en TS.
export async function rendrePdf(element: ReactElement): Promise<Buffer> {
  return renderToBuffer(element as ReactElement<DocumentProps>)
}

// RFC 5987 : encodeURIComponent laisse passer ' ( ) * ; on les encode aussi.
function encoderNom(nom: string): string {
  return encodeURIComponent(nom).replace(/['()*]/g, (caractere) => `%${caractere.charCodeAt(0).toString(16).toUpperCase()}`)
}

export function reponsePdf(octets: Buffer, nomFichier: string): Response {
  return new Response(new Uint8Array(octets), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename*=UTF-8''${encoderNom(nomFichier)}`,
      "Content-Length": String(octets.length),
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  })
}
