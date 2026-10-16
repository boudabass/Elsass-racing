import Link from "next/link"
import { Lock } from "lucide-react"

import { accesEcran } from "@/apps/saison/ecran"
import { listerResultatsAValider } from "@/apps/saison/lectures-serveur"
import { BoutonValider } from "@/apps/saison/composants/resultats"
import { COULEUR_VALIDATION } from "@/apps/saison/regles-resultats"
import { LIBELLE_VALIDATION_RESULTAT } from "@/apps/saison/libelles"
import { EcranVide } from "@/components/qg/ecran-vide"

// Résultats à valider, toutes épreuves confondues, du plus ancien au plus récent. Valider en un geste
// quand le membre peut le faire ; sinon, la ligne ouvre la fiche de l'épreuve.
export default async function PageAValider() {
  const acces = await accesEcran("lecture")
  if (!acces.ok) {
    return <EcranVide icone={Lock} titre={acces.titre} lignes={acces.lignes} action={{ libelle: "Retour au calendrier", href: "/apps/saison" }} />
  }
  const { resultats } = await listerResultatsAValider()

  return (
    <section className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-6">
      <Link href="/apps/saison" className="text-sm text-texte-discret">
        ← Calendrier
      </Link>
      <h1 className="font-titre text-2xl uppercase">Résultats à valider</h1>

      {resultats.length === 0 && <p className="text-texte-discret">Rien à valider pour l'instant.</p>}

      <ul className="flex flex-col divide-y divide-bordure rounded-lg border border-bordure bg-surface">
        {resultats.map((resultat) => (
          <li key={resultat.entryId} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <Link href={`/apps/saison/epreuves/${resultat.epreuveId}?onglet=resultats`} className="flex flex-col">
              <span className="font-medium">{resultat.epreuve}</span>
              <span className="text-sm text-texte-discret">{resultat.voiture}</span>
              <span className={`text-sm font-medium ${COULEUR_VALIDATION[resultat.validation] ?? ""}`}>
                {LIBELLE_VALIDATION_RESULTAT[resultat.validation as keyof typeof LIBELLE_VALIDATION_RESULTAT] ?? resultat.validation}
                {resultat.sansPreuve ? " · sans preuve" : ""}
              </span>
            </Link>
            {resultat.droits.peutValider ? (
              <BoutonValider entryId={resultat.entryId} />
            ) : resultat.droits.messageValidation ? (
              <p className="text-sm text-texte-discret">{resultat.droits.messageValidation}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  )
}
