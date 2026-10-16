import { notFound } from "next/navigation"
import { Lock, Clock } from "lucide-react"

import { APPS } from "@/core/catalogue"
import { contexteQg } from "@/core/qg/donnees"
import { niveauDe } from "@/core/actions/actions-serveur"
import { aAuMoins } from "@/core/droits/niveaux"
import { ErreurAcces, libelleErreurAcces } from "@/core/droits/erreurs"
import { prismaPourTeam } from "@/lib/prisma"
import { EcranVide } from "@/components/qg/ecran-vide"
import { EcranDecouverte } from "@/components/qg/ecran-decouverte"
import { ECRANS_DECOUVERTE } from "@/core/sdk/decouverte"
import { appDecouverte } from "@/apps/settings/regles-personnelles"
import { prefsMembre } from "@/apps/settings/preferences-serveur"

// Page d'une app. Aucun écran d'app n'existe encore : on affiche l'écran générique,
// ou le refus d'accès, selon l'activation et le niveau du membre.
export default async function PageApp({ params }: { params: Promise<{ cle: string }> }) {
  const { cle } = await params
  const app = APPS.find((a) => a.cle === cle)
  if (!app) notFound()

  const { contexte } = await contexteQg()

  const activation = await prismaPourTeam(contexte.teamId, contexte.userId).coreTeamApp.findFirst({
    where: { teamId: contexte.teamId, appCle: app.cle, activee: true, deletedAt: null },
    select: { id: true },
  })

  if (!activation) {
    return (
      <EcranVide
        icone={Lock}
        titre={app.nom}
        lignes={["Cette app n'est pas activée pour ta team.", "Le responsable peut l'activer depuis les réglages."]}
        action={{ libelle: "Retour au QG", href: "/qg" }}
      />
    )
  }

  const niveau = await niveauDe(contexte, app.cle)
  if (!aAuMoins(niveau, "lecture")) {
    const erreur = new ErreurAcces("niveau_insuffisant", niveau, "lecture", app.cle)
    return (
      <EcranVide
        icone={Lock}
        titre="Tu n'as pas accès à cette app"
        lignes={[libelleErreurAcces(erreur)]}
        action={{ libelle: "Retour au QG", href: "/qg" }}
      />
    )
  }

  // Première ouverture par ce membre : l'écran explicatif, jusqu'au bouton « Commencer ».
  const ecran = ECRANS_DECOUVERTE[app.cle]
  const prefs = await prefsMembre(contexte)
  if (ecran && !appDecouverte(app.cle, prefs.appsDecouvertes)) {
    return <EcranDecouverte appCle={app.cle} nom={app.nom} lignes={ecran.lignes} />
  }

  return (
    <EcranVide
      icone={Clock}
      titre={app.nom}
      lignes={["Cette app arrive bientôt.", "Elle est activée pour ta team : ses écrans viendront dans les prochaines versions."]}
      action={{ libelle: "Retour au QG", href: "/qg" }}
    />
  )
}
