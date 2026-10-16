import { Lock } from "lucide-react"

import { niveauDe } from "@/core/actions/actions-serveur"
import { aAuMoins } from "@/core/droits/niveaux"
import { contexteQg } from "@/core/qg/donnees"
import { EcranVide } from "@/components/qg/ecran-vide"
import { NotesEcran } from "@/components/qg/notes-ecran"

// Notes de la team. Les notes sont lues et écrites sur la base locale (synchro). Le niveau sur
// l'app « equipe » décide : lecture pour voir, contribution pour écrire.
export default async function PageNotes() {
  const { contexte } = await contexteQg()
  const niveau = await niveauDe(contexte, "equipe")

  if (!aAuMoins(niveau, "lecture")) {
    return (
      <EcranVide
        icone={Lock}
        titre="Les notes ne sont pas ouvertes"
        lignes={["Tu n'as pas accès aux notes de la team."]}
        action={{ libelle: "Retour au QG", href: "/qg" }}
      />
    )
  }

  return <NotesEcran userId={contexte.userId} peutEcrire={aAuMoins(niveau, "contribution")} />
}
