// « Tous les fichiers » (tâche 5.4, brief §1). Liste en lecture seule : chaque fichier renvoie vers sa fiche d'origine,
// et la lecture du fichier passe par la route de fichiers, qui garde ses propres contrôles. Les filtres sont dans l'URL
// (formulaire GET, sans script) ; la pagination garde les filtres.

import Link from "next/link"

import { BOUTON_SECONDAIRE, CHAMP, LIEN } from "@/lib/classes-formulaire"

import { LIBELLE_ROLE_FICHIER, type FichiersDonnees, type FiltresFichiers, type LigneFichier } from "../lectures-fichiers"

const dateLisible = (date: Date) =>
  date.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Paris" })

const ADRESSE = "/apps/documents/fichiers"

// Adresse d'une page, avec les filtres conservés. La page 1 n'a pas de paramètre.
function adresse(filtres: FiltresFichiers, page: number): string {
  const parametres = new URLSearchParams()
  if (filtres.app) parametres.set("app", filtres.app)
  if (filtres.role) parametres.set("role", filtres.role)
  if (filtres.par) parametres.set("par", filtres.par)
  if (page > 1) parametres.set("page", String(page))
  const texte = parametres.toString()
  return texte ? `${ADRESSE}?${texte}` : ADRESSE
}

export function FichiersEcran({ donnees, filtres }: { donnees: FichiersDonnees; filtres: FiltresFichiers }) {
  return (
    <section className="flex w-full max-w-5xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="titre-rallye text-3xl">Tous les fichiers</h1>
        <p className="text-texte-discret">
          Les fichiers rattachés aux fiches de la team, du plus récent au plus ancien. Un fichier s&apos;ouvre dans son app d&apos;origine.
        </p>
      </header>

      <form method="get" action={ADRESSE} className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-40 flex-col gap-1 text-sm">
          <span className="font-medium">Application</span>
          <select name="app" defaultValue={filtres.app ?? ""} className={CHAMP}>
            <option value="">Toutes</option>
            {donnees.applications.map((app) => (
              <option key={app.cle} value={app.cle}>
                {app.libelle}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-40 flex-col gap-1 text-sm">
          <span className="font-medium">Rôle</span>
          <select name="role" defaultValue={filtres.role ?? ""} className={CHAMP}>
            <option value="">Tous</option>
            {Object.entries(LIBELLE_ROLE_FICHIER).map(([cle, libelle]) => (
              <option key={cle} value={cle}>
                {libelle}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-40 flex-col gap-1 text-sm">
          <span className="font-medium">Ajouté par</span>
          <select name="par" defaultValue={filtres.par ?? ""} className={CHAMP}>
            <option value="">Tous</option>
            {donnees.auteurs.map((auteur) => (
              <option key={auteur.id} value={auteur.id}>
                {auteur.libelle}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className={BOUTON_SECONDAIRE}>
          Filtrer
        </button>
      </form>

      {donnees.lignes.length === 0 ? (
        <p className="text-texte-discret">Aucun fichier ne correspond à ces filtres.</p>
      ) : (
        <ul className="flex flex-col gap-3" aria-label="Fichiers">
          {donnees.lignes.map((ligne) => (
            <LigneFichierEcran key={ligne.id} ligne={ligne} />
          ))}
        </ul>
      )}

      <nav className="flex items-center justify-between gap-3 text-sm" aria-label="Pages">
        {donnees.pagePrecedente ? (
          <Link href={adresse(filtres, donnees.page - 1)} className={LIEN}>
            Page précédente
          </Link>
        ) : (
          <span />
        )}
        <span className="text-texte-discret">Page {donnees.page}</span>
        {donnees.pageSuivante ? (
          <Link href={adresse(filtres, donnees.page + 1)} className={LIEN}>
            Page suivante
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </section>
  )
}

function LigneFichierEcran({ ligne }: { ligne: LigneFichier }) {
  return (
    <li className="flex flex-col gap-2 rounded-lg border border-bordure bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <a href={`/api/fichiers/${ligne.fichierId}`} target="_blank" rel="noopener noreferrer" className={`${LIEN} break-all font-semibold`}>
          {ligne.nom}
        </a>
        <span className="rounded-full border border-bordure px-2 py-0.5 text-xs">{ligne.badge}</span>
        <span className="text-sm text-texte-discret">{LIBELLE_ROLE_FICHIER[ligne.role]}</span>
      </div>
      <p className="text-sm">
        Fiche :{" "}
        <Link href={ligne.origine.chemin} className={LIEN}>
          {ligne.origine.libelle}
        </Link>
      </p>
      <p className="text-sm text-texte-discret">
        Ajouté par {ligne.ajoutePar} le {dateLisible(ligne.ajouteLe)}
      </p>
    </li>
  )
}
