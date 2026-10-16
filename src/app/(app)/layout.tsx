import type { ReactNode } from "react"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { ErreurAcces } from "@/core/droits/erreurs"
import { contexteQg, donneesQg } from "@/core/qg/donnees"
import { COOKIE_BANDEAU_TERRAIN } from "@/core/qg/cookies"
import { modeTerrainDuMembre, terrainProposeJourEpreuve } from "@/apps/settings/preferences-serveur"
import { libelleCompteARebours } from "@/core/actions/prochaine-etape"
import { BarreHaute } from "@/components/qg/barre-haute"
import { BandeauTerrain } from "@/components/qg/bandeau-terrain"
import { BoiteActions } from "@/components/qg/boite-actions"
import { BoutonProchaineEtape } from "@/components/qg/bouton-prochaine-etape"
import { ConteneurBoite } from "@/components/qg/conteneur-boite"
import { Navigation } from "@/components/qg/navigation"
import { entreesDuMenuPlus } from "@/components/qg/entrees-plus"
import { RaccourciRecherche } from "@/components/qg/raccourci-recherche"
import { Inbox } from "@/components/qg/icones"

// Espace connecté : QG, apps, recherche. Charge une fois les données de la requête.
export default async function LayoutApp({ children }: { children: ReactNode }) {
  try {
    await contexteQg()
  } catch (erreur) {
    if (erreur instanceof ErreurAcces && erreur.raison === "non_connecte") redirect("/connexion")
    redirect("/equipes")
  }
  const { contexte } = await contexteQg()

  const magasin = await cookies()
  const terrain = await modeTerrainDuMembre(contexte)
  const proposeBandeau = await terrainProposeJourEpreuve(contexte)
  const donnees = await donneesQg(terrain)
  const maintenant = new Date()
  const aujourdhui = maintenant.toISOString().slice(0, 10)

  const nombre = donnees.actions.length
  const declencheur = (
    <button
      type="button"
      aria-label={nombre > 0 ? `Boîte d'actions, ${nombre} en attente` : "Boîte d'actions"}
      className="cible-tactile relative flex items-center justify-center rounded-md px-2 text-texte hover:bg-surface-2"
    >
      <Inbox className="h-5 w-5" aria-hidden />
      {nombre > 0 && (
        <span className="chiffre absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-marque px-1 text-xs font-semibold text-white">
          {nombre}
        </span>
      )}
    </button>
  )
  const boite = (
    <ConteneurBoite declencheur={declencheur}>
      <BoiteActions groupes={donnees.groupes} />
    </ConteneurBoite>
  )

  const entreesPlus = entreesDuMenuPlus(donnees.role, terrain)
  const apps = donnees.apps.map(({ manifeste }) => ({ cle: manifeste.cle, nom: manifeste.nom, icone: manifeste.icone }))

  // Bandeau « jour d'épreuve » : épreuve en cours aujourd'hui, pas en mode terrain, pas refusé aujourd'hui.
  const epreuve = donnees.prochaineEpreuve
  const jour = new Date(`${aujourdhui}T00:00:00Z`)
  const enCours = epreuve !== null && epreuve.dateDebut <= jour && epreuve.dateFin >= jour
  const bandeauRefuse = magasin.get(COOKIE_BANDEAU_TERRAIN)?.value === aujourdhui
  const afficherBandeau = enCours && proposeBandeau && !terrain && !bandeauRefuse

  return (
    <div className="min-h-dvh overflow-x-hidden bg-fond text-texte">
      <BarreHaute
        donnees={{
          nomTeam: donnees.team.nom,
          saison: donnees.saisonEnCours?.nom ?? null,
          prochaine: epreuve
            ? { nom: epreuve.nom, compteARebours: libelleCompteARebours(epreuve, maintenant) }
            : null,
          nombreActions: nombre,
          modeTerrain: terrain,
        }}
        boite={boite}
      />

      <div className="mx-auto flex max-w-6xl">
        <Navigation apps={apps} entreesPlus={entreesPlus} boiteMobile={boite} />
        <main className="min-w-0 flex-1 px-4 pb-32 pt-6 md:px-8 md:pb-16">{children}</main>
      </div>

      <BoutonProchaineEtape etape={donnees.prochaineEtape} maintenant={maintenant} />
      {afficherBandeau && epreuve && <BandeauTerrain epreuve={epreuve.nom} />}
      <RaccourciRecherche />
    </div>
  )
}
