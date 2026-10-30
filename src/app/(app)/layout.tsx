import type { ReactNode } from "react"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { contexteQg, donneesQg, redirigerSiSansContexte } from "@/core/qg/donnees"
import { COOKIE_BANDEAU_TERRAIN } from "@/core/qg/cookies"
import { modeTerrainDuMembre, terrainProposeJourEpreuve } from "@/apps/settings/preferences-serveur"
import { libelleCompteARebours } from "@/core/actions/prochaine-etape"
import { BarreHaute } from "@/components/qg/barre-haute"
import { lireSoldeBarreHaute } from "@/apps/budget/liaisons-serveur"
import { listerTeamsDe } from "@/core/auth/team-serveur"
import { lireIdsEpreuvesPasseesSaisonEnCours } from "@/apps/saison/lectures-serveur"
import { BandeauTerrain } from "@/components/qg/bandeau-terrain"
import { BoiteActions } from "@/components/qg/boite-actions"
import { ConteneurBoite } from "@/components/qg/conteneur-boite"
import { Navigation } from "@/components/qg/navigation"
import { entreesDuMenuPlus } from "@/components/qg/entrees-plus"
import { RaccourciRecherche } from "@/components/qg/raccourci-recherche"
import { SynchroProvider } from "@/core/synchro/client/react"
import { EnregistrementSW } from "@/components/enregistrement-sw"
import { NavigationHorsLigne } from "@/components/navigation-hors-ligne"
import { Inbox } from "@/components/qg/icones"
import { MenuApp, type MenuDeApp } from "@/components/qg/menu-app"
import { entreeVisible } from "@/core/sdk/manifeste"

// Espace connecté : QG, apps, recherche. Charge une fois les données de la requête.
export default async function LayoutApp({ children }: { children: ReactNode }) {
  try {
    await contexteQg()
  } catch (erreur) {
    redirigerSiSansContexte(erreur)
    redirect("/equipes")
  }
  const { contexte } = await contexteQg()

  const magasin = await cookies()
  const terrain = await modeTerrainDuMembre(contexte)
  const proposeBandeau = await terrainProposeJourEpreuve(contexte)
  const donnees = await donneesQg(terrain)
  const solde = await lireSoldeBarreHaute()
  // Entrée « Changer de team » du menu : seulement si le compte appartient à plusieurs teams.
  const plusieursTeams = (await listerTeamsDe(contexte.userId)).length > 1
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
        <span className="chiffre absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-marque px-1 text-xs font-semibold text-marque-texte">
          {nombre}
        </span>
      )}
    </button>
  )
  // Une seule boîte, dans la barre haute (sur tous les écrans) : elle écoute le paramètre « boite »
  // (lien direct vers une action).
  const boite = (
    <ConteneurBoite declencheur={declencheur} ecouteUrl>
      <BoiteActions groupes={donnees.groupes} />
    </ConteneurBoite>
  )

  const entreesPlus = entreesDuMenuPlus(donnees.role, terrain)
  const apps = donnees.apps.map(({ manifeste }) => ({ cle: manifeste.cle, nom: manifeste.nom, icone: manifeste.icone }))
  // Menus des apps, filtrés par les droits du membre : le socle rend celui de l'app courante.
  const menus: MenuDeApp[] = donnees.apps.map(({ manifeste, niveau }) => ({
    cle: manifeste.cle,
    nom: manifeste.nom,
    entrees: manifeste.menu.filter((entree) => entreeVisible(entree, niveau, donnees.role)).map(({ libelle, chemin }) => ({ libelle, chemin })),
  }))

  // Bandeau « jour d'épreuve » : épreuve en cours aujourd'hui, pas en mode terrain, pas refusé aujourd'hui.
  const epreuve = donnees.prochaineEpreuve
  // Pages de la prochaine épreuve, préchargées pour la spéciale (programme et reconnaissances).
  const pagesProchaine = epreuve ? [`/apps/saison/epreuves/${epreuve.id}?onglet=programme`, `/apps/saison/epreuves/${epreuve.id}?onglet=reconnaissances`] : []
  // Épreuves passées de la saison en cours (fiche et résultats) : consultables hors ligne (brief 2.9, point 8).
  const pagesPassees = (await lireIdsEpreuvesPasseesSaisonEnCours()).flatMap((id) => [`/apps/saison/epreuves/${id}`, `/apps/saison/epreuves/${id}?onglet=resultats`])
  const pagesHorsLigne = [...pagesProchaine, ...pagesPassees]
  const jour = new Date(`${aujourdhui}T00:00:00Z`)
  const enCours = epreuve !== null && epreuve.dateDebut <= jour && epreuve.dateFin >= jour
  const bandeauRefuse = magasin.get(COOKIE_BANDEAU_TERRAIN)?.value === aujourdhui
  const afficherBandeau = enCours && proposeBandeau && !terrain && !bandeauRefuse

  return (
    <SynchroProvider userId={contexte.userId} teamId={contexte.teamId}>
    <EnregistrementSW pages={pagesHorsLigne} />
    <NavigationHorsLigne />
    <div className="min-h-dvh overflow-x-hidden bg-fond text-texte">
      <BarreHaute
        donnees={{
          nomTeam: donnees.team.nom,
          logoFileId: donnees.team.logoFileId,
          saison: donnees.saisonEnCours?.nom ?? null,
          prochaine: epreuve
            ? { nom: epreuve.nom, compteARebours: libelleCompteARebours(epreuve, maintenant) }
            : null,
          nombreActions: nombre,
          modeTerrain: terrain,
          solde,
          plusieursTeams,
        }}
        boite={boite}
      />

      <div className="mx-auto flex max-w-6xl">
        <Navigation apps={apps} entreesPlus={entreesPlus} />
        {/* Marge basse : la hauteur de la barre basse sur téléphone, pour que la dernière ligne reste cliquable. */}
        <main className="min-w-0 flex-1 px-4 pb-32 pt-6 md:px-8 md:pb-24">
          <MenuApp menus={menus} />
          {children}
        </main>
      </div>

      {afficherBandeau && epreuve && <BandeauTerrain epreuve={epreuve.nom} />}
      <RaccourciRecherche />
    </div>
    </SynchroProvider>
  )
}
