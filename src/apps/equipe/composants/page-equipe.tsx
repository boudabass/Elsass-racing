import Link from "next/link"

import { COULEUR_ECHEANCE, LIBELLE_PALIER, LIBELLE_REPONSE, LIBELLE_ROLE_HABITUEL, libelleEcheanceCarte } from "../libelles"
import type { PageEquipe } from "../lectures-ecran"
import type { CarteMembre, MembrePersonne } from "../lectures-serveur"
import { ROLES_HABITUELS, type RoleHabituel } from "../regles"

import { AnciensMembres } from "./anciens-membres"
import { NouvellePersonne } from "./formulaires-equipe"

// L'équipe (accueil de l'app) : une carte par personne, façon jeu. Initiales (pas de photo pour l'instant), rôle
// habituel, palier si affiché, pastilles licence et équipement (mot et couleur), réponse pour la prochaine épreuve.
// Filtre par rôle dans l'URL. Les anciens membres sont repliés en bas : jamais effacés.

const FILTRES: Array<{ cle: "tous" | RoleHabituel; libelle: string }> = [
  { cle: "tous", libelle: "Tous" },
  ...ROLES_HABITUELS.map((role) => ({ cle: role, libelle: LIBELLE_ROLE_HABITUEL[role] })),
]

const CLASSE_FILTRE = (actif: boolean) =>
  `cible-tactile inline-flex items-center rounded-full border px-4 text-sm ${actif ? "border-marque bg-surface-2 font-medium" : "border-bordure text-texte-discret"}`

export function filtrerCartes(cartes: CarteMembre[], role: string | null): CarteMembre[] {
  if (!role || role === "tous") return cartes
  return cartes.filter((carte) => carte.roles.includes(role as RoleHabituel))
}

function initiales(personne: Pick<MembrePersonne, "prenom" | "nom">): string {
  return `${personne.prenom.charAt(0)}${personne.nom.charAt(0)}`.toUpperCase()
}

function CarteEquipier({ carte, aEpreuve }: { carte: CarteMembre; aEpreuve: boolean }) {
  const licence = libelleEcheanceCarte("Licence", carte.licence)
  const equipement = libelleEcheanceCarte("Équipement", carte.equipement)
  return (
    <li>
      <Link
        href={`/apps/equipe/personnes/${carte.personId}`}
        className="flex min-h-11 flex-col gap-3 rounded-lg border border-bordure bg-surface p-4 hover:bg-surface-2"
      >
        <span className="flex items-center gap-3">
          <span aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-full bg-surface-2 font-semibold">
            {initiales(carte)}
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-semibold">
              {carte.prenom} {carte.nom}
            </span>
            <span className="text-sm text-texte-discret">
              {carte.roles.length > 0 ? carte.roles.map((role) => LIBELLE_ROLE_HABITUEL[role]).join(" · ") : "Rôle à préciser"}
            </span>
          </span>
        </span>
        {carte.palier && (
          <span className="flex flex-col gap-1 text-sm">
            <span>Palier : {LIBELLE_PALIER[carte.palier]}</span>
            {carte.progression && (
              <span
                role="progressbar"
                aria-label={`Vers ${LIBELLE_PALIER[carte.progression.suivant]} : encore ${carte.progression.restant} épreuve${carte.progression.restant > 1 ? "s" : ""}`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={carte.progression.pourcentage}
                className="block h-2 w-full overflow-hidden rounded-full bg-surface-2"
              >
                <span className="block h-full bg-marque" style={{ width: `${carte.progression.pourcentage}%` }} />
              </span>
            )}
          </span>
        )}
        {(carte.statsEquipage || carte.epreuvesAssistance !== null) && (
          <span className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {carte.statsEquipage && (
              <>
                <span>
                  Épreuves <span className="chiffre font-semibold">{carte.statsEquipage.epreuves}</span>
                </span>
                <span>
                  Arrivées <span className="chiffre font-semibold">{carte.statsEquipage.arrivees}</span>
                </span>
              </>
            )}
            {carte.epreuvesAssistance !== null && (
              <span>
                Épreuves en assistance <span className="chiffre font-semibold">{carte.epreuvesAssistance}</span>
              </span>
            )}
          </span>
        )}
        <span className="flex flex-wrap gap-2 text-sm">
          <span className={`rounded-full border border-bordure px-3 py-1 ${carte.licence ? COULEUR_ECHEANCE[carte.licence] : "text-texte-discret"}`}>
            {licence}
          </span>
          <span className={`rounded-full border border-bordure px-3 py-1 ${carte.equipement ? COULEUR_ECHEANCE[carte.equipement] : "text-texte-discret"}`}>
            {equipement}
          </span>
        </span>
        {aEpreuve && (
          <span className="text-sm text-texte-discret">
            {carte.disponibilite ? `Prochaine épreuve : ${LIBELLE_REPONSE[carte.disponibilite].toLowerCase()}` : "Prochaine épreuve : pas encore répondu"}
          </span>
        )}
      </Link>
    </li>
  )
}

export function PageEquipeEcran({ donnees, role, nouvelle = false }: { donnees: PageEquipe; role: string | null; nouvelle?: boolean }) {
  const cartes = filtrerCartes(donnees.cartes, role)
  const filtreActif = role && role !== "tous" ? role : "tous"

  return (
    <section className="flex w-full max-w-6xl flex-col gap-6">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="titre-rallye text-3xl">L&apos;équipe</h1>
            <p className="text-texte-discret">
              {donnees.cartes.length} personne{donnees.cartes.length > 1 ? "s" : ""} dans l&apos;équipe
              {donnees.epreuve ? `, prochaine épreuve : ${donnees.epreuve.nom}` : ""}.
            </p>
          </div>
          {donnees.peutEcrire && <NouvellePersonne ouvertDepart={nouvelle} />}
        </div>

        <nav aria-label="Filtrer par rôle" className="flex flex-wrap gap-2">
          {FILTRES.map((filtre) => (
            <Link
              key={filtre.cle}
              href={filtre.cle === "tous" ? "/apps/equipe" : `/apps/equipe?role=${filtre.cle}`}
              aria-current={filtreActif === filtre.cle ? "page" : undefined}
              className={CLASSE_FILTRE(filtreActif === filtre.cle)}
            >
              {filtre.libelle}
            </Link>
          ))}
        </nav>
      </header>

      {donnees.cartes.length === 0 ? (
        <p className="text-texte-discret">
          Aucune personne pour l&apos;instant.
          {donnees.peutEcrire ? " Ajoute la première : il suffit du prénom, du nom et du rôle." : ""}
        </p>
      ) : cartes.length === 0 ? (
        <p className="text-texte-discret">Personne avec ce rôle pour l&apos;instant.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {cartes.map((carte) => (
            <CarteEquipier key={carte.personId} carte={carte} aEpreuve={donnees.epreuve !== null} />
          ))}
        </ul>
      )}

      {donnees.anciens.length > 0 && <AnciensMembres anciens={donnees.anciens} />}
    </section>
  )
}
