// Page partenaire (brief 3.7, §3) : rendue côté serveur, lisible sans JavaScript. Chaque section n'apparaît que si
// elle est cochée dans le lien. Les fichiers passent par /p/<jeton>/fichiers/<id>, qui revalide le jeton à chaque
// requête. Les liens externes (preuves) ne sont affichés qu'en https, avec noopener et noreferrer.
import type { CSSProperties } from "react"

import { variablesDeTeam } from "@/core/theme/variables"
import { LIEN } from "@/lib/classes-formulaire"

import type { PagePartenaire } from "../page-publique-serveur"

import { FormulaireMessagePartenaire } from "./formulaire-message-partenaire"

const CLASSE_SECTION = "flex flex-col gap-4 rounded-md border border-bordure bg-surface p-4"
const CLASSE_LISTE = "flex flex-col gap-3"
const VIDE = "text-texte-discret"

export function PagePartenaireVue({ jeton, page, sections }: { jeton: string; page: PagePartenaire; sections: string[] }) {
  const fichier = (id: string) => `/p/${jeton}/fichiers/${id}`
  const couleurs = variablesDeTeam({ couleurPrincipale: page.team.couleurPrincipale, couleurSecondaire: page.team.couleurSecondaire }) as CSSProperties
  const affichee = (section: string) => sections.includes(section)

  return (
    <main style={couleurs} className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-6 sm:py-10">
      <header className="flex items-center gap-4 border-b-2 border-marque pb-4">
        {page.team.logoFileId && (
          // eslint-disable-next-line @next/next/no-img-element -- fichier de la team servi par la page partenaire ; taille fixe
          <img src={fichier(page.team.logoFileId)} alt="" width={56} height={56} className="h-14 w-14 object-contain" />
        )}
        <div className="flex min-w-0 flex-col">
          <h1 className="font-titre text-xl uppercase">{page.team.nom}</h1>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-2 text-texte-discret">
            <span>Espace partenaire de {page.partenaire.entreprise}</span>
            {page.partenaire.logoFileId && (
              // eslint-disable-next-line @next/next/no-img-element -- logo du partenaire servi par la page partenaire ; hauteur fixe, largeur selon le fichier
              <img src={fichier(page.partenaire.logoFileId)} alt={`Logo de ${page.partenaire.entreprise}`} height={40} className="h-10 w-auto object-contain" />
            )}
          </p>
        </div>
      </header>

      {affichee("conventions") && (
        <section aria-labelledby="conventions" className={CLASSE_SECTION}>
          <h2 id="conventions" className="text-lg font-medium">
            Conventions
          </h2>
          {page.conventions.length === 0 ? (
            <p className={VIDE}>Aucune convention signée pour l&apos;instant.</p>
          ) : (
            <ul className={CLASSE_LISTE}>
              {page.conventions.map((convention) => (
                <li key={convention.id} className="flex flex-col gap-1 text-sm">
                  <p className="font-medium">
                    {convention.saison ?? "Sans saison"} · {convention.statut}
                  </p>
                  <p>
                    Du {convention.dateDebut} au {convention.dateFin}
                  </p>
                  <p>Apport : {convention.apport}</p>
                  {convention.apportNature && <p>Apport en nature : {convention.apportNature}</p>}
                  {convention.documentSigneFileId && (
                    <a href={fichier(convention.documentSigneFileId)} download className={`${LIEN} w-fit`}>
                      Télécharger la convention signée
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {affichee("contreparties") && (
        <section aria-labelledby="contreparties" className={CLASSE_SECTION}>
          <h2 id="contreparties" className="text-lg font-medium">
            Contreparties
          </h2>
          {page.contreparties.length === 0 ? (
            <p className={VIDE}>Aucune contrepartie pour l&apos;instant.</p>
          ) : (
            <ul className={CLASSE_LISTE}>
              {page.contreparties.map((contrepartie) => (
                <li key={contrepartie.id} className="flex flex-col gap-1 text-sm">
                  <p className="font-medium break-words">{contrepartie.libelle}</p>
                  <p>
                    {contrepartie.quantiteTenue} sur {contrepartie.quantitePromise} · {contrepartie.statut}
                    {contrepartie.echeance ? ` · échéance ${contrepartie.echeance}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {affichee("preuves") && (
        <section aria-labelledby="preuves" className={CLASSE_SECTION}>
          <h2 id="preuves" className="text-lg font-medium">
            Preuves
          </h2>
          {page.preuves.length === 0 ? (
            <p className={VIDE}>Aucune preuve pour l&apos;instant.</p>
          ) : (
            <ul className={CLASSE_LISTE}>
              {page.preuves.map((preuve) => (
                <li key={preuve.id} className="flex flex-wrap items-start gap-3 text-sm">
                  {preuve.fileId && preuve.estImage && (
                    <a href={fichier(preuve.fileId)} target="_blank" rel="noopener noreferrer" className="shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element -- vignette d'un fichier de la team ; taille fixe et chargement paresseux */}
                      <img src={fichier(preuve.fileId)} alt="Photo de la preuve" width={96} height={96} loading="lazy" className="h-24 w-24 rounded-md object-cover" />
                    </a>
                  )}
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <p className="font-medium">
                      {preuve.date} · {preuve.type}
                      {preuve.epreuve ? ` · ${preuve.epreuve}` : ""}
                    </p>
                    {preuve.commentaire && <p className="whitespace-pre-line break-words">{preuve.commentaire}</p>}
                    {preuve.fileId && !preuve.estImage && (
                      <a href={fichier(preuve.fileId)} download className={`${LIEN} w-fit`}>
                        Télécharger le fichier
                      </a>
                    )}
                    {preuve.lien?.startsWith("https://") && (
                      <a href={preuve.lien} target="_blank" rel="noopener noreferrer" className={`${LIEN} break-all`}>
                        Voir la publication
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {affichee("calendrier") && (
        <section aria-labelledby="calendrier" className={CLASSE_SECTION}>
          <h2 id="calendrier" className="text-lg font-medium">
            Calendrier
          </h2>
          {page.calendrier.length === 0 ? (
            <p className={VIDE}>Aucune épreuve au calendrier pour l&apos;instant.</p>
          ) : (
            <ul className={CLASSE_LISTE}>
              {page.calendrier.map((epreuve) => (
                <li key={`${epreuve.nom}-${epreuve.dateDebut}`} className="flex flex-col gap-1 text-sm">
                  <p className="font-medium break-words">{epreuve.nom}</p>
                  <p>
                    Du {epreuve.dateDebut} au {epreuve.dateFin}
                    {epreuve.lieu ? ` · ${epreuve.lieu}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {affichee("resultats") && (
        <section aria-labelledby="resultats" className={CLASSE_SECTION}>
          <h2 id="resultats" className="text-lg font-medium">
            Résultats
          </h2>
          {page.resultats.length === 0 ? (
            <p className={VIDE}>Aucun résultat publié pour l&apos;instant.</p>
          ) : (
            <ul className={CLASSE_LISTE}>
              {page.resultats.map((resultat) => (
                <li key={`${resultat.epreuve}-${resultat.date}`} className="flex flex-col gap-1 text-sm">
                  <p className="font-medium break-words">
                    {resultat.epreuve} · {resultat.date}
                  </p>
                  <p>Statut : {resultat.statut}</p>
                  {resultat.classementGeneral !== null && (
                    <p>
                      Au général : {resultat.classementGeneral}
                      {resultat.nbClasses ? ` sur ${resultat.nbClasses}` : ""}
                    </p>
                  )}
                  {resultat.classementClasse !== null && (
                    <p>
                      En classe : {resultat.classementClasse}
                      {resultat.nbPartantsClasse ? ` sur ${resultat.nbPartantsClasse}` : ""}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {affichee("bilans") && (
        <section aria-labelledby="bilans" className={CLASSE_SECTION}>
          <h2 id="bilans" className="text-lg font-medium">
            Bilans
          </h2>
          {page.bilans.length === 0 ? (
            <p className={VIDE}>Aucun bilan pour l&apos;instant.</p>
          ) : (
            <ul className={CLASSE_LISTE}>
              {page.bilans.map((bilan) => (
                <li key={bilan.id} className="flex flex-col gap-1 text-sm">
                  <p className="font-medium">
                    Du {bilan.periodeDebut} au {bilan.periodeFin}
                  </p>
                  <p className={VIDE}>Généré le {bilan.genereLe}</p>
                  {bilan.fileId && (
                    <a href={fichier(bilan.fileId)} download className={`${LIEN} w-fit`}>
                      Télécharger le bilan
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section aria-labelledby="message" className={CLASSE_SECTION}>
        <h2 id="message" className="text-lg font-medium">
          Laisser un message
        </h2>
        <p className={VIDE}>Une question, une remarque ? Votre message arrive directement à la team.</p>
        <FormulaireMessagePartenaire jeton={jeton} />
      </section>
    </main>
  )
}
