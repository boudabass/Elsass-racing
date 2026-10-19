// Onglets de la fiche partenaire (brief 3.6, §4) : Fiche, Échanges, Conventions, Page partenaire, Messages.
// Rendu serveur ; seuls les formulaires sont des îlots clients. Les écritures passent par actions.ts.

import Link from "next/link"

import { CHAMP, BOUTON_DANGER, BOUTON_SECONDAIRE, LIEN } from "@/lib/classes-formulaire"
import { formaterMontant } from "../regles"
import {
  dateFrancaise,
  instantFrancais,
  LIBELLES_APPORT_RECU,
  LIBELLES_SOURCE,
  LIBELLES_STATUT_CONVENTION,
  LIBELLES_TYPE_INTERACTION,
} from "../affichage"
import {
  ajouterInteractionAction,
  marquerLuAction,
  marquerTraiteAction,
  modifierCoordonneesAction,
  modifierInteractionAction,
  modifierInterlocuteurAction,
  modifierPartenaireAction,
  reporterRelanceAction,
  supprimerInteractionAction,
  supprimerPartenaireAction,
} from "../actions"
import { SECTIONS_PAGE } from "../services-serveur"
import type { lirePartenaire } from "../lectures-serveur"

import { TiroirAction } from "@/components/formulaire/tiroir"

import { BoutonEnvoi, Champ, FormulaireAction } from "./formulaire"
import { TiroirLogo } from "./formulaire-logo"
import { LienPartenaire } from "./lien-partenaire"

export type PartenaireFiche = NonNullable<Awaited<ReturnType<typeof lirePartenaire>>>
export type PersonnePourChoix = { id: string; prenom: string; nom: string }

const TYPES_INTERACTION = Object.keys(LIBELLES_TYPE_INTERACTION)
const SOURCES = Object.keys(LIBELLES_SOURCE)

const LIBELLES_SECTIONS: Record<string, string> = {
  conventions: "Conventions",
  contreparties: "Contreparties",
  preuves: "Preuves",
  calendrier: "Calendrier",
  resultats: "Résultats",
  bilans: "Bilans",
}

// Une valeur de fiche en lecture (brief 3.13, règle 7) : le libellé, puis la valeur, ou un tiret.
function Lecture({ libelle, valeur, className = "" }: { libelle: string; valeur: string | null | undefined; className?: string }) {
  return (
    <div className={`flex flex-col gap-0.5 ${className}`}>
      <dt className="text-texte-discret">{libelle}</dt>
      <dd className="whitespace-pre-line break-words">{valeur || "—"}</dd>
    </div>
  )
}

// Contenu de l'onglet Fiche : coordonnées, interlocuteur et suivi se lisent, « Modifier » ouvre un tiroir ; puis le logo,
// et la suppression (sans convention signée). Il n'y a plus de formulaire ouvert dans la fiche.
export function OngletFiche({ partenaire, personnes }: { partenaire: PartenaireFiche; personnes: PersonnePourChoix[] }) {
  const conventionSignee = partenaire.conventions.some((c) => c.statut === "signee" || c.statut === "en_cours" || c.statut === "terminee")
  const c = partenaire.coordonnees
  const suiviPar = personnes.find((personne) => personne.id === partenaire.suiviParPersonId)
  return (
    <div className="flex flex-col gap-10">
      <section aria-labelledby="coordonnees" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="coordonnees" className="text-lg font-medium">
            Coordonnées de l&apos;entreprise
          </h2>
          <TiroirAction libelle="Modifier" titre="Modifier les coordonnées" action={modifierCoordonneesAction} libelleBouton="Enregistrer les coordonnées">
            <input type="hidden" name="partnerId" value={partenaire.id} />
            <div className="flex flex-col gap-1">
              <Champ id="adresse" libelle="Adresse">
                <input id="adresse" name="adresse" defaultValue={c.adresse} maxLength={300} className={CHAMP} />
              </Champ>
            </div>
            <Champ id="telephone" libelle="Téléphone">
              <input id="telephone" name="telephone" type="tel" defaultValue={c.telephone} maxLength={30} className={CHAMP} />
            </Champ>
            <Champ id="email" libelle="Mail">
              <input id="email" name="email" type="email" defaultValue={c.email} maxLength={200} className={CHAMP} />
            </Champ>
            <Champ id="site" libelle="Site">
              <input id="site" name="site" defaultValue={c.site} maxLength={200} className={CHAMP} />
            </Champ>
            <Champ id="siret" libelle="SIRET" aide="14 chiffres, sans espaces.">
              <input id="siret" name="siret" inputMode="numeric" defaultValue={c.siret} maxLength={17} className={CHAMP} aria-describedby="siret-aide" />
            </Champ>
          </TiroirAction>
        </div>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <Lecture libelle="Adresse" valeur={c.adresse} className="sm:col-span-2" />
          <Lecture libelle="Téléphone" valeur={c.telephone} />
          <Lecture libelle="Mail" valeur={c.email} />
          <Lecture libelle="Site" valeur={c.site} />
          <Lecture libelle="SIRET" valeur={c.siret} />
        </dl>
      </section>

      <section id="interlocuteur" aria-labelledby="interlocuteur-titre" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="interlocuteur-titre" className="text-lg font-medium">
            Interlocuteur
          </h2>
          <TiroirAction libelle="Modifier" titre="Modifier l'interlocuteur" action={modifierInterlocuteurAction} libelleBouton="Enregistrer l'interlocuteur">
            <input type="hidden" name="partnerId" value={partenaire.id} />
            <Champ id="interlocuteur-prenom" libelle="Prénom" aide="Prénom et nom ensemble. Laissés tous les deux vides, l'interlocuteur est retiré.">
              <input id="interlocuteur-prenom" name="prenom" defaultValue={partenaire.interlocuteurPrenom ?? ""} maxLength={60} className={CHAMP} />
            </Champ>
            <Champ id="interlocuteur-nom" libelle="Nom">
              <input id="interlocuteur-nom" name="nom" defaultValue={partenaire.interlocuteurNom ?? ""} maxLength={60} className={CHAMP} />
            </Champ>
            <Champ id="interlocuteur-qualite" libelle="Fonction" aide="Par exemple Gérant. Elle apparaît dans la convention, après son nom.">
              <input id="interlocuteur-qualite" name="qualite" defaultValue={partenaire.interlocuteurQualite ?? ""} maxLength={80} className={CHAMP} />
            </Champ>
          </TiroirAction>
        </div>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <Lecture libelle="Nom" valeur={partenaire.interlocuteur} />
          <Lecture libelle="Fonction" valeur={partenaire.interlocuteurQualite} />
        </dl>
      </section>

      <section aria-labelledby="suivi" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="suivi" className="text-lg font-medium">
            Suivi
          </h2>
          <TiroirAction libelle="Modifier" titre="Modifier le suivi" action={modifierPartenaireAction} libelleBouton="Enregistrer le suivi">
            <input type="hidden" name="partnerId" value={partenaire.id} />
            <Champ id="source" libelle="Source">
              <select id="source" name="source" key={`source-${partenaire.source ?? ""}`} defaultValue={partenaire.source ?? ""} className={CHAMP}>
                <option value="">Non renseignée</option>
                {SOURCES.map((source) => (
                  <option key={source} value={source}>
                    {LIBELLES_SOURCE[source]}
                  </option>
                ))}
              </select>
            </Champ>
            <Champ id="suivi-par" libelle="Suivi par">
              <select id="suivi-par" name="suiviParPersonId" key={`suivi-${partenaire.suiviParPersonId ?? ""}`} defaultValue={partenaire.suiviParPersonId ?? ""} className={CHAMP}>
                <option value="">Personne</option>
                {personnes.map((personne) => (
                  <option key={personne.id} value={personne.id}>
                    {personne.prenom} {personne.nom}
                  </option>
                ))}
              </select>
            </Champ>
            <Champ id="secteur" libelle="Secteur">
              <input id="secteur" name="secteur" defaultValue={partenaire.secteur ?? ""} maxLength={80} className={CHAMP} />
            </Champ>
            <Champ id="notes" libelle="Notes">
              <textarea id="notes" name="notes" rows={4} defaultValue={partenaire.notes ?? ""} maxLength={4000} className={CHAMP} />
            </Champ>
          </TiroirAction>
        </div>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <Lecture libelle="Source" valeur={partenaire.source ? LIBELLES_SOURCE[partenaire.source] : null} />
          <Lecture libelle="Suivi par" valeur={suiviPar ? `${suiviPar.prenom} ${suiviPar.nom}` : null} />
          <Lecture libelle="Secteur" valeur={partenaire.secteur} className="sm:col-span-2" />
          <Lecture libelle="Notes" valeur={partenaire.notes} className="sm:col-span-2" />
        </dl>
      </section>

      <section aria-labelledby="logo" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="logo" className="text-lg font-medium">
            Logo
          </h2>
          <TiroirLogo partnerId={partenaire.id} logoFileId={partenaire.logoFileId} />
        </div>
        <p className="text-sm text-texte-discret">{partenaire.logoFileId ? "Un logo est posé." : "Aucun logo pour l'instant."}</p>
      </section>

      {!conventionSignee && (
        <section aria-labelledby="supprimer" className="flex flex-col gap-3">
          <h2 id="supprimer" className="text-lg font-medium">
            Supprimer ce partenaire
          </h2>
          <div>
            <TiroirAction
              libelle="Supprimer ce partenaire…"
              titre="Supprimer ce partenaire"
              action={supprimerPartenaireAction}
              libelleBouton="Supprimer définitivement"
              libelleEnCours="Suppression…"
              danger
              question="Le partenaire et ses échanges disparaissent de Partenaires. Cette action ne se défait pas depuis l'application."
            >
              <input type="hidden" name="partnerId" value={partenaire.id} />
            </TiroirAction>
          </div>
        </section>
      )}
    </div>
  )
}

// Onglet Échanges : « Ajouter un échange » ouvre un tiroir ; chaque échange se lit, puis « Modifier » ou « Supprimer »
// ouvrent leur tiroir.
export function OngletEchanges({ partenaire, personnes, aujourdhui }: { partenaire: PartenaireFiche; personnes: PersonnePourChoix[]; aujourdhui: string }) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <TiroirAction libelle="Ajouter un échange" titre="Ajouter un échange" action={ajouterInteractionAction} libelleBouton="Ajouter l'échange" libelleEnCours="Ajout…">
          <input type="hidden" name="partnerId" value={partenaire.id} />
          <p className="text-sm text-texte-discret">La date de la prochaine action devient la prochaine relance de ce partenaire.</p>
          <Champ id="echange-date" libelle="Date">
            <input id="echange-date" name="date" type="date" required defaultValue={aujourdhui} className={CHAMP} />
          </Champ>
          <Champ id="echange-type" libelle="Type">
            <select id="echange-type" name="type" required defaultValue="appel" className={CHAMP}>
              {TYPES_INTERACTION.map((type) => (
                <option key={type} value={type}>
                  {LIBELLES_TYPE_INTERACTION[type]}
                </option>
              ))}
            </select>
          </Champ>
          <Champ id="echange-resume" libelle="Résumé">
            <textarea id="echange-resume" name="resume" required rows={3} maxLength={2000} className={CHAMP} />
          </Champ>
          <Champ id="echange-auteur" libelle="Auteur">
            <select id="echange-auteur" name="auteurPersonId" defaultValue="" className={CHAMP}>
              <option value="">Personne</option>
              {personnes.map((personne) => (
                <option key={personne.id} value={personne.id}>
                  {personne.prenom} {personne.nom}
                </option>
              ))}
            </select>
          </Champ>
          <Champ id="echange-prochaine" libelle="Prochaine action">
            <input id="echange-prochaine" name="prochaineAction" maxLength={300} className={CHAMP} />
          </Champ>
          <Champ id="echange-prochaine-le" libelle="Date de la prochaine action">
            <input id="echange-prochaine-le" name="prochaineActionLe" type="date" className={CHAMP} />
          </Champ>
        </TiroirAction>
      </div>

      {partenaire.interactions.length === 0 ? (
        <p className="text-texte-discret">Aucun échange pour l&apos;instant.</p>
      ) : (
        <ol className="flex flex-col gap-3">
          {partenaire.interactions.map((echange) => {
            const jour = echange.date.toISOString().slice(0, 10)
            return (
              <li key={echange.id} className="flex flex-col gap-2 rounded-md border border-bordure bg-surface p-4">
                <p className="text-sm text-texte-discret">
                  {dateFrancaise(jour)} · {LIBELLES_TYPE_INTERACTION[echange.type]}
                  {echange.auteur ? ` · ${echange.auteur.prenom} ${echange.auteur.nom}` : ""}
                </p>
                <p className="whitespace-pre-line">{echange.resume}</p>
                {echange.prochaineAction && (
                  <p className="text-sm">
                    Prochaine action : {echange.prochaineAction}
                    {echange.prochaineActionLe ? ` (le ${dateFrancaise(echange.prochaineActionLe.toISOString().slice(0, 10))})` : ""}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <TiroirAction libelle="Modifier" titre="Modifier l'échange" action={modifierInteractionAction} libelleBouton="Enregistrer l'échange" libelleEnCours="Enregistrement…">
                    <input type="hidden" name="interactionId" value={echange.id} />
                    <input type="hidden" name="partnerId" value={partenaire.id} />
                    <Champ id={`date-${echange.id}`} libelle="Date">
                      <input id={`date-${echange.id}`} name="date" type="date" required defaultValue={jour} className={CHAMP} />
                    </Champ>
                    <Champ id={`type-${echange.id}`} libelle="Type">
                      <select id={`type-${echange.id}`} name="type" required defaultValue={echange.type} className={CHAMP}>
                        {TYPES_INTERACTION.map((type) => (
                          <option key={type} value={type}>
                            {LIBELLES_TYPE_INTERACTION[type]}
                          </option>
                        ))}
                      </select>
                    </Champ>
                    <Champ id={`resume-${echange.id}`} libelle="Résumé">
                      <textarea id={`resume-${echange.id}`} name="resume" required rows={3} defaultValue={echange.resume} maxLength={2000} className={CHAMP} />
                    </Champ>
                    <Champ id={`auteur-${echange.id}`} libelle="Auteur">
                      <select id={`auteur-${echange.id}`} name="auteurPersonId" defaultValue={echange.auteurPersonId ?? ""} className={CHAMP}>
                        <option value="">Personne</option>
                        {personnes.map((personne) => (
                          <option key={personne.id} value={personne.id}>
                            {personne.prenom} {personne.nom}
                          </option>
                        ))}
                      </select>
                    </Champ>
                    <Champ id={`prochaine-${echange.id}`} libelle="Prochaine action">
                      <input id={`prochaine-${echange.id}`} name="prochaineAction" defaultValue={echange.prochaineAction ?? ""} maxLength={300} className={CHAMP} />
                    </Champ>
                    <Champ id={`prochaine-le-${echange.id}`} libelle="Date de la prochaine action">
                      <input
                        id={`prochaine-le-${echange.id}`}
                        name="prochaineActionLe"
                        type="date"
                        defaultValue={echange.prochaineActionLe ? echange.prochaineActionLe.toISOString().slice(0, 10) : ""}
                        className={CHAMP}
                      />
                    </Champ>
                  </TiroirAction>
                  <TiroirAction
                    libelle="Supprimer l'échange"
                    titre="Supprimer cet échange"
                    action={supprimerInteractionAction}
                    libelleBouton="Supprimer l'échange"
                    libelleEnCours="Suppression…"
                    danger
                    question="L'échange disparaît de la fiche. Cette action ne se défait pas."
                  >
                    <input type="hidden" name="interactionId" value={echange.id} />
                  </TiroirAction>
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}

// Onglet Conventions : une carte par convention, et « Nouvelle convention ».
export function OngletConventions({ partenaire }: { partenaire: PartenaireFiche }) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href={`/apps/partenaires/${partenaire.id}/conventions/nouvelle`} className={LIEN}>
          Nouvelle convention
        </Link>
      </div>
      {partenaire.conventions.length === 0 ? (
        <p className="text-texte-discret">Aucune convention pour l&apos;instant.</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {partenaire.conventions.map((convention) => {
            const tenues = convention.benefits.filter((b) => b.statut === "tenue").length
            return (
              <li key={convention.id}>
                <Link href={`/apps/partenaires/conventions/${convention.id}`} className="flex flex-col gap-2 rounded-md border border-bordure bg-surface p-4 hover:bg-surface-2">
                  <span className="font-medium">{convention.season?.nom ?? "Sans saison"}</span>
                  <span className="text-sm text-texte-discret">
                    Du {dateFrancaise(convention.dateDebut.toISOString().slice(0, 10))} au {dateFrancaise(convention.dateFin.toISOString().slice(0, 10))}
                  </span>
                  <span className="text-sm">
                    {LIBELLES_STATUT_CONVENTION[convention.statut]} · Apport {formaterMontant(convention.apportFinancierCentimes)} · {LIBELLES_APPORT_RECU[convention.apportRecu]}
                  </span>
                  <span className="text-sm text-texte-discret">
                    Contreparties tenues : {tenues} sur {convention.benefits.length}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

// Onglet Page partenaire (gestion seulement). Le lien ne montre son jeton qu'une fois, à la création.
export function OngletPagePartenaire({ partenaire }: { partenaire: PartenaireFiche }) {
  const lien = partenaire.lienPage
  return (
    <LienPartenaire
      partnerId={partenaire.id}
      lien={
        lien
          ? {
              id: lien.id,
              nbConsultations: lien.nbConsultations,
              derniereConsultation: instantFrancais(lien.derniereConsultation),
              sections: lien.sections,
            }
          : null
      }
      sectionsDisponibles={SECTIONS_PAGE}
      libellesSections={LIBELLES_SECTIONS}
    />
  )
}

// Onglet Messages : les messages laissés depuis la page partenaire.
export function OngletMessages({ partenaire }: { partenaire: PartenaireFiche }) {
  if (partenaire.messages.length === 0) {
    return <p className="text-texte-discret">Les messages laissés par le partenaire depuis sa page arriveront ici.</p>
  }
  return (
    <ol className="flex flex-col gap-3">
      {partenaire.messages.map((message) => (
        <li key={message.id} className="flex flex-col gap-2 rounded-md border border-bordure bg-surface p-4">
          <p className="text-sm text-texte-discret">
            {message.auteurNom} · {instantFrancais(message.date)}
            {message.lueLe ? "" : " · Non lu"}
            {message.traiteParPersonId ? " · Traité" : ""}
          </p>
          <p className="whitespace-pre-line">{message.texte}</p>
          <div className="flex flex-wrap gap-2">
            {!message.lueLe && (
              <FormulaireAction action={marquerLuAction} nom="Marquer comme lu" className="flex">
                <input type="hidden" name="messageId" value={message.id} />
                <BoutonEnvoi libelle="Marquer comme lu" secondaire />
              </FormulaireAction>
            )}
            {!message.traiteParPersonId && (
              <FormulaireAction action={marquerTraiteAction} nom="Marquer comme traité" className="flex">
                <input type="hidden" name="messageId" value={message.id} />
                <BoutonEnvoi libelle="Marquer comme traité" secondaire />
              </FormulaireAction>
            )}
          </div>
        </li>
      ))}
    </ol>
  )
}

// La relance est reportée d'une semaine depuis l'en-tête de la fiche.
export function ReporterRelance({ partnerId }: { partnerId: string }) {
  return (
    <FormulaireAction action={reporterRelanceAction} nom="Reporter la relance" className="flex">
      <input type="hidden" name="partnerId" value={partnerId} />
      <BoutonEnvoi libelle="Reporter d'une semaine" secondaire />
    </FormulaireAction>
  )
}
