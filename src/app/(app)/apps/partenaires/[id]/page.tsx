import { notFound } from "next/navigation"
import { Lock } from "lucide-react"

import { accesEcran } from "@/apps/partenaires/ecran"
import { ChangerStatut, PastilleStatut } from "@/apps/partenaires/composants/statut"
import {
  OngletConventions,
  OngletEchanges,
  OngletFiche,
  OngletMessages,
  OngletPagePartenaire,
  ReporterRelance,
} from "@/apps/partenaires/composants/fiche-partenaire"
import { CLASSE_TON_RELANCE, ecartRelance } from "@/apps/partenaires/affichage"
import { listerPersonnes, lirePartenaire } from "@/apps/partenaires/lectures-serveur"
import { jourParis } from "@/apps/partenaires/regles"
import { EcranVide } from "@/components/qg/ecran-vide"
import { Onglets } from "@/components/qg/onglets-fiche"
import { aAuMoins } from "@/core/droits/niveaux"

// Fiche d'un partenaire : en-tête (statut, relance) et cinq onglets. La page partenaire est réservée à la gestion.
export default async function PageFichePartenaire({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ onglet?: string }>
}) {
  const { id } = await params
  const { onglet } = await searchParams
  const acces = await accesEcran("ecriture")
  if (!acces.ok) {
    return <EcranVide icone={Lock} titre={acces.titre} lignes={acces.lignes} action={{ libelle: "Retour au QG", href: "/qg" }} />
  }
  const partenaire = await lirePartenaire(id)
  if (!partenaire) notFound()

  const gestion = aAuMoins(acces.niveau, "gestion")
  const onglets = [
    { cle: "fiche", libelle: "Fiche" },
    { cle: "echanges", libelle: "Échanges" },
    { cle: "conventions", libelle: "Conventions" },
    ...(gestion ? [{ cle: "page", libelle: "Page partenaire" }] : []),
    { cle: "messages", libelle: "Messages" },
  ]
  const actif = onglets.find((choix) => choix.cle === onglet)?.cle ?? "fiche"
  const personnes = await listerPersonnes()
  const aujourdhui = jourParis(new Date())
  const relance = ecartRelance(partenaire.prochaineRelance, aujourdhui)
  const initiales = partenaire.entreprise
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((mot) => mot[0])
    .join("")
    .toUpperCase()

  return (
    <section className="flex w-full max-w-4xl flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start">
        {partenaire.logoFileId ? (
          // eslint-disable-next-line @next/next/no-img-element -- fichier de la team servi par /api/fichiers ; taille fixe, pas de lazy (visible tout de suite)
          <img src={`/api/fichiers/${partenaire.logoFileId}`} width={64} height={64} alt="" decoding="async" className="h-16 w-16 shrink-0 rounded-md object-contain" />
        ) : (
          <span aria-hidden className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md bg-surface-2 text-xl font-medium">
            {initiales}
          </span>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <h1 className="titre-rallye break-words text-3xl">{partenaire.entreprise}</h1>
          <div className="flex flex-wrap items-center gap-3">
            <PastilleStatut statut={partenaire.statut} />
            <ChangerStatut partnerId={partenaire.id} statut={partenaire.statut} />
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            {relance ? (
              <span className={CLASSE_TON_RELANCE[relance.ton]}>Prochaine relance : {relance.libelle}</span>
            ) : (
              <span className="text-texte-discret">Pas de relance prévue</span>
            )}
            <ReporterRelance partnerId={partenaire.id} />
          </div>
        </div>
      </header>

      <Onglets base={`/apps/partenaires/${id}`} onglets={onglets} actif={actif} nom="Onglets de la fiche partenaire" />

      <div>
        {actif === "fiche" && <OngletFiche partenaire={partenaire} personnes={personnes} />}
        {actif === "echanges" && <OngletEchanges partenaire={partenaire} personnes={personnes} aujourdhui={aujourdhui} />}
        {actif === "conventions" && <OngletConventions partenaire={partenaire} />}
        {actif === "page" && <OngletPagePartenaire partenaire={partenaire} />}
        {actif === "messages" && <OngletMessages partenaire={partenaire} />}
      </div>
    </section>
  )
}
