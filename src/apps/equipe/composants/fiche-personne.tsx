import Link from "next/link"

import { Onglets } from "@/components/qg/onglets-fiche"
import { jourEnFrancais } from "@/core/dates"
import { LIEN } from "@/lib/classes-formulaire"

import {
  AjouterEquipement,
  AjouterLicence,
  ModifierEquipement,
  ModifierLicence,
  ModifierProfil,
  RepondreDisponibilite,
} from "./formulaires-equipe"
import { COULEUR_ECHEANCE, LIBELLE_ECHEANCE, LIBELLE_PALIER, LIBELLE_REPONSE, LIBELLE_ROLE_HABITUEL } from "../libelles"
import type { PagePersonne } from "../lectures-ecran"
import { estEquipage, LIBELLES_TYPE_EQUIPEMENT, LIBELLES_TYPE_LICENCE, progressionPalier, type RoleHabituel } from "../regles"

// Fiche d'une personne (tâche 5.2, brief §1) : six onglets. Le ressenti n'existe que pour l'équipage et le responsable.
// Les boutons qu'on ne peut pas utiliser restent visibles, désactivés, avec la raison écrite au-dessus de la saisie.

export type OngletPersonne = "profil" | "statistiques" | "licences" | "equipement" | "disponibilites" | "binomes" | "ressenti"

const RAISON_DOSSIER = "Tu ne peux gérer que ton propre dossier."

const NOMBRE = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 })
const EUROS = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" })

// Ordre du 955 §2 : Binômes seulement pour un pilote ou un copilote, Ressenti seulement à l'écriture ou plus.
export function ongletsPersonne(peutVoirRessenti: boolean, roles: RoleHabituel[]): OngletPersonne[] {
  const base: OngletPersonne[] = ["profil", "statistiques", "licences", "equipement", "disponibilites"]
  if (estEquipage(roles)) base.push("binomes")
  if (peutVoirRessenti) base.push("ressenti")
  return base
}

const LIBELLE_ONGLET: Record<OngletPersonne, string> = {
  profil: "Profil",
  statistiques: "Statistiques",
  licences: "Licences",
  equipement: "Équipement",
  disponibilites: "Disponibilités",
  binomes: "Binômes",
  ressenti: "Ressenti",
}

export function FichePersonneEcran({ donnees, onglet }: { donnees: PagePersonne; onglet: OngletPersonne }) {
  const { fiche } = donnees
  const onglets = ongletsPersonne(donnees.peutVoirRessenti, fiche.roles)
  // Gérer le dossier : le niveau écriture, ou son propre dossier (l'assistance). Sinon, la raison est dite.
  const gere = donnees.peutEcrire || fiche.estSoi
  const raison = gere ? null : RAISON_DOSSIER
  const base = `/apps/equipe/personnes/${fiche.personId}`

  return (
    <section className="flex w-full max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <Link href="/apps/equipe" className={`${LIEN} w-fit text-sm`}>
          Retour à l&apos;équipe
        </Link>
        <h1 className="titre-rallye text-3xl">
          {fiche.prenom} {fiche.nom}
        </h1>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-texte-discret">
          {donnees.statutDansEquipe === "ancien" && <span className="font-medium text-texte">Ancien membre</span>}
          {fiche.roles.length > 0 ? <span>{fiche.roles.map((role) => LIBELLE_ROLE_HABITUEL[role]).join(" · ")}</span> : <span>Rôle à préciser</span>}
          {fiche.palier && <span>Palier : {LIBELLE_PALIER[fiche.palier]}</span>}
        </p>
      </header>

      <Onglets base={base} onglets={onglets.map((cle) => ({ cle, libelle: LIBELLE_ONGLET[cle] }))} actif={onglet} nom="Onglets de la fiche" />

      {onglet === "profil" && <ProfilFiche donnees={donnees} gere={gere} raison={raison} />}
      {onglet === "statistiques" && <StatistiquesFiche donnees={donnees} />}
      {onglet === "licences" && <LicencesFiche donnees={donnees} gere={gere} raison={raison} />}
      {onglet === "equipement" && <EquipementFiche donnees={donnees} gere={gere} raison={raison} />}
      {onglet === "disponibilites" && <DisponibilitesFiche donnees={donnees} gere={gere} raison={raison} />}
      {onglet === "binomes" && estEquipage(fiche.roles) && <BinomesFiche donnees={donnees} />}
      {onglet === "ressenti" && donnees.peutVoirRessenti && <RessentiFiche donnees={donnees} />}
    </section>
  )
}

// --- Profil -----------------------------------------------------------------------------------------------

function ProfilFiche({ donnees, gere, raison }: { donnees: PagePersonne; gere: boolean; raison: string | null }) {
  const { fiche } = donnees
  return (
    <section aria-labelledby="profil-titre" className="flex flex-col gap-4">
      <h2 id="profil-titre" className="text-lg font-semibold">
        Profil
      </h2>
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-texte-discret">Rôles habituels</dt>
          <dd>{fiche.roles.length > 0 ? fiche.roles.map((role) => LIBELLE_ROLE_HABITUEL[role]).join(", ") : "À préciser"}</dd>
        </div>
        <div>
          <dt className="text-texte-discret">Début dans le sport auto</dt>
          <dd>{fiche.debutSportAuto ? jourEnFrancais(fiche.debutSportAuto) : "Non renseigné"}</dd>
        </div>
        {fiche.voitContact && (
          <>
            <div>
              <dt className="text-texte-discret">Taille de vêtements</dt>
              <dd>{fiche.tailleVetements ?? "Non renseignée"}</dd>
            </div>
            <div>
              <dt className="text-texte-discret">Contact d&apos;urgence</dt>
              <dd>{fiche.contactUrgence ?? "Non renseigné"}</dd>
            </div>
          </>
        )}
        <div>
          <dt className="text-texte-discret">Paliers et trophées</dt>
          <dd>{fiche.palier ? `Palier : ${LIBELLE_PALIER[fiche.palier]}` : "Pas affichés dans l'équipe"}</dd>
        </div>
      </dl>
      <div>
        <ModifierProfil
          valeurs={{
            personId: fiche.personId,
            roles: fiche.roles,
            debutSportAuto: fiche.debutSportAuto,
            afficherTrophees: fiche.afficherTrophees,
            voitContact: fiche.voitContact,
            tailleVetements: fiche.tailleVetements,
            contactUrgence: fiche.contactUrgence,
          }}
          desactive={!gere}
          raison={raison}
        />
      </div>
    </section>
  )
}

// --- Statistiques -----------------------------------------------------------------------------------------

function StatistiquesFiche({ donnees }: { donnees: PagePersonne }) {
  const { fiche } = donnees
  const stats = fiche.statistiques
  const progression = fiche.palier ? progressionPalier(fiche.nombreEpreuvesPalier, fiche.palier) : null
  return (
    <section aria-labelledby="stats-titre" className="flex flex-col gap-5">
      <h2 id="stats-titre" className="text-lg font-semibold">
        Statistiques
      </h2>
      <p className="text-sm text-texte-discret">Seulement les résultats validés dans Saison.</p>
      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div className="rounded-lg border border-bordure p-3">
          <dt className="text-texte-discret">Épreuves</dt>
          <dd className="chiffre text-2xl font-semibold">{stats.epreuves}</dd>
        </div>
        <div className="rounded-lg border border-bordure p-3">
          <dt className="text-texte-discret">Arrivées</dt>
          <dd className="chiffre text-2xl font-semibold">{stats.arrivees}</dd>
        </div>
        <div className="rounded-lg border border-bordure p-3">
          <dt className="text-texte-discret">Taux d&apos;arrivée</dt>
          <dd className="chiffre text-2xl font-semibold">
            {stats.tauxArrivee === null ? (
              <>
                <span aria-hidden="true">—</span>
                <span className="sr-only">pas encore d&apos;épreuve</span>
              </>
            ) : (
              `${Math.round(stats.tauxArrivee * 100)} %`
            )}
          </dd>
        </div>
        <div className="rounded-lg border border-bordure p-3">
          <dt className="text-texte-discret">Kilomètres chronométrés</dt>
          <dd className="chiffre text-2xl font-semibold">{NOMBRE.format(stats.kmChronometres)} km</dd>
        </div>
      </dl>
      <p className="text-sm">
        Meilleur classement de classe :{" "}
        {stats.meilleurClassement === null ? (
          <>
            <span aria-hidden="true">—</span>
            <span className="sr-only">pas encore de classement</span>
          </>
        ) : (
          <span className="chiffre font-semibold">{stats.meilleurClassement}</span>
        )}
      </p>

      {fiche.palier && (
        <div className="flex flex-col gap-2">
          {progression ? (
            <>
              <p className="text-sm">
                <span className="chiffre font-semibold">{progression.restant}</span> épreuve{progression.restant > 1 ? "s" : ""} avant{" "}
                {LIBELLE_PALIER[progression.suivant]}
              </p>
              <div
                role="progressbar"
                aria-label={`Vers le palier ${LIBELLE_PALIER[progression.suivant]}`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progression.pourcentage}
                className="h-3 w-full overflow-hidden rounded-full bg-surface-2"
              >
                <div className="h-full bg-marque" style={{ width: `${progression.pourcentage}%` }} />
              </div>
            </>
          ) : (
            <p className="text-sm">Palier maximum atteint : {LIBELLE_PALIER[fiche.palier]}.</p>
          )}
        </div>
      )}
    </section>
  )
}

// --- Licences -----------------------------------------------------------------------------------------------

function LicencesFiche({ donnees, gere, raison }: { donnees: PagePersonne; gere: boolean; raison: string | null }) {
  const { fiche, peutEcrire } = donnees
  return (
    <section aria-labelledby="licences-titre" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="licences-titre" className="text-lg font-semibold">
          Licences
        </h2>
        <AjouterLicence personId={fiche.personId} desactive={!gere} raison={raison} />
      </div>
      {fiche.licences.length === 0 ? (
        <p className="text-texte-discret">Aucune licence saisie.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {fiche.licences.map((licence) => (
            <li key={licence.id} className="flex flex-col gap-2 rounded-lg border border-bordure p-4">
              <p className="font-medium">{LIBELLES_TYPE_LICENCE[licence.type]}</p>
              <p className="text-sm text-texte-discret">
                {[licence.numero && `N° ${licence.numero}`, licence.saison && `saison ${licence.saison}`].filter(Boolean).join(" · ") || "Sans numéro"}
              </p>
              <p className="text-sm">
                {licence.statut ? (
                  <span className={COULEUR_ECHEANCE[licence.statut]}>{LIBELLE_ECHEANCE[licence.statut]}</span>
                ) : (
                  <span className="text-texte-discret">Sans date de fin</span>
                )}
                {licence.valableAu && <span> · valable jusqu&apos;au {jourEnFrancais(licence.valableAu)}</span>}
              </p>
              {peutEcrire && licence.montantCents !== null && (
                <p className="text-sm text-texte-discret">Montant payé : {EUROS.format(licence.montantCents / 100)}</p>
              )}
              <div className="flex flex-wrap gap-2">
                <ModifierLicence
                  valeurs={{
                    id: licence.id,
                    type: licence.type,
                    numero: licence.numero,
                    saison: licence.saison,
                    valableDu: licence.valableDu,
                    valableAu: licence.valableAu,
                    montantCents: licence.montantCents,
                  }}
                  desactive={!gere}
                  raison={raison}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

// --- Équipement ---------------------------------------------------------------------------------------------

function EquipementFiche({ donnees, gere, raison }: { donnees: PagePersonne; gere: boolean; raison: string | null }) {
  const { fiche } = donnees
  return (
    <section aria-labelledby="equipement-titre" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="equipement-titre" className="text-lg font-semibold">
          Équipement
        </h2>
        <AjouterEquipement personId={fiche.personId} desactive={!gere} raison={raison} />
      </div>
      {fiche.equipements.length === 0 ? (
        <p className="text-texte-discret">Aucun équipement saisi.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {fiche.equipements.map((equipement) => (
            <li key={equipement.id} className="flex flex-col gap-2 rounded-lg border border-bordure p-4">
              <p className="font-medium">{LIBELLES_TYPE_EQUIPEMENT[equipement.type]}</p>
              <p className="text-sm text-texte-discret">
                {[equipement.marque, equipement.modele, equipement.norme && `norme ${equipement.norme}`].filter(Boolean).join(" · ") || "Sans marque"}
              </p>
              <p className="text-sm">
                {equipement.statut ? (
                  <span className={COULEUR_ECHEANCE[equipement.statut]}>{LIBELLE_ECHEANCE[equipement.statut]}</span>
                ) : (
                  <span className="text-texte-discret">Sans date d&apos;homologation</span>
                )}
                {equipement.finHomologation && <span> · homologué jusqu&apos;au {jourEnFrancais(equipement.finHomologation)}</span>}
              </p>
              <div className="flex flex-wrap gap-2">
                <ModifierEquipement
                  valeurs={{
                    id: equipement.id,
                    type: equipement.type,
                    marque: equipement.marque,
                    modele: equipement.modele,
                    norme: equipement.norme,
                    finHomologation: equipement.finHomologation,
                    taille: equipement.taille,
                    acheteLe: equipement.acheteLe,
                  }}
                  desactive={!gere}
                  raison={raison}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

// --- Disponibilités -----------------------------------------------------------------------------------------

function DisponibilitesFiche({ donnees, gere, raison }: { donnees: PagePersonne; gere: boolean; raison: string | null }) {
  const { fiche, epreuve } = donnees
  const reponseProchaine = epreuve ? (fiche.disponibilites.find((dispo) => dispo.eventId === epreuve.eventId)?.reponse ?? null) : null
  return (
    <section aria-labelledby="dispo-titre" className="flex flex-col gap-4">
      <h2 id="dispo-titre" className="text-lg font-semibold">
        Disponibilités
      </h2>
      {epreuve ? (
        <div className="flex flex-col gap-3 rounded-lg border border-bordure p-4">
          <p className="font-medium">
            {epreuve.nom} · {jourEnFrancais(epreuve.dateDebut)}
          </p>
          <p className="text-sm">Réponse : {reponseProchaine ? LIBELLE_REPONSE[reponseProchaine] : "pas encore répondu"}</p>
          <div>
            <RepondreDisponibilite
              personId={fiche.personId}
              eventId={epreuve.eventId}
              nomEpreuve={epreuve.nom}
              reponseActuelle={reponseProchaine}
              desactive={!gere}
              raison={raison}
            />
          </div>
        </div>
      ) : (
        <p className="text-texte-discret">Aucune épreuve à venir pour le moment.</p>
      )}
      {fiche.disponibilites.length > 0 && (
        <ul className="flex flex-col gap-2 text-sm">
          {fiche.disponibilites.map((dispo) => (
            <li key={dispo.eventId} className="flex flex-wrap justify-between gap-2 border-b border-bordure py-2">
              <span>
                {dispo.nom} · {jourEnFrancais(dispo.dateDebut)}
              </span>
              <span>{LIBELLE_REPONSE[dispo.reponse]}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

// --- Binômes ----------------------------------------------------------------------------------------------

function BinomesFiche({ donnees }: { donnees: PagePersonne }) {
  const { fiche } = donnees
  return (
    <section aria-labelledby="binomes-titre" className="flex flex-col gap-4">
      <h2 id="binomes-titre" className="text-lg font-semibold">
        Binômes
      </h2>
      <p className="text-sm text-texte-discret">Seulement les épreuves à résultat validé dans Saison, où les deux étaient inscrits.</p>
      {fiche.binomes.length === 0 ? (
        <p className="text-texte-discret">Pas encore de binôme avec un résultat validé.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {fiche.binomes.map((binome) => (
            <li key={binome.partenaireId} className="flex flex-col gap-2 rounded-lg border border-bordure p-4">
              <p className="font-medium">{binome.partenaireNom}</p>
              <p className="text-sm text-texte-discret">Rôle dans le binôme : {binome.role === "pilote" ? "pilote" : "copilote"}</p>
              <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <div>
                  <dt className="text-texte-discret">Épreuves</dt>
                  <dd className="chiffre font-semibold">{binome.stats.epreuvesCommunes}</dd>
                </div>
                <div>
                  <dt className="text-texte-discret">Arrivées</dt>
                  <dd className="chiffre font-semibold">{binome.stats.arriveesEnsemble}</dd>
                </div>
                <div>
                  <dt className="text-texte-discret">Km chronométrés</dt>
                  <dd className="chiffre font-semibold">{NOMBRE.format(binome.stats.kmEnsemble)} km</dd>
                </div>
                <div>
                  <dt className="text-texte-discret">Meilleur résultat</dt>
                  <dd className="chiffre font-semibold">
                    {binome.stats.meilleurResultat === null ? (
                      <>
                        <span aria-hidden="true">—</span>
                        <span className="sr-only">pas encore de classement</span>
                      </>
                    ) : (
                      binome.stats.meilleurResultat
                    )}
                  </dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

// --- Ressenti ---------------------------------------------------------------------------------------------

function RessentiFiche({ donnees }: { donnees: PagePersonne }) {
  const { fiche } = donnees
  return (
    <section aria-labelledby="ressenti-titre" className="flex flex-col gap-3">
      <h2 id="ressenti-titre" className="text-lg font-semibold">
        Ressenti
      </h2>
      <p className="text-sm text-texte-discret">Visible seulement par l&apos;équipage et le responsable.</p>
      {fiche.ressenti === null ? (
        <p>Pas encore de débrief.</p>
      ) : (
        <p>
          Moyenne des derniers débriefs : <span className="chiffre text-xl font-semibold">{NOMBRE.format(fiche.ressenti)}</span> sur 5
        </p>
      )}
    </section>
  )
}
