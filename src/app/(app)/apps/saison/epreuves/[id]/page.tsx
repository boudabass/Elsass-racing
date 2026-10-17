import Link from "next/link"
import { notFound } from "next/navigation"
import { Lock } from "lucide-react"

import { accesEcran } from "@/apps/saison/ecran"
import { lireEpreuve, lireFinDEpreuve, lirePreparation, lireReconnaissances, lireResultatsEpreuve, listerChoixEngagement, listerContacts } from "@/apps/saison/lectures-serveur"
import { FinEpreuve } from "@/apps/saison/composants/fin-epreuve"
import { PanneauPreparation } from "@/apps/saison/composants/preparation"
import { ONGLETS_FICHE_EPREUVE } from "@/apps/onglets-fiches"
import { contexteQg } from "@/core/qg/donnees"
import { ongletsVisibles } from "@/core/sdk/onglets"
import { PanneauReconnaissances } from "@/apps/saison/composants/reconnaissances"
import { ProgrammeHorsLigne } from "@/apps/saison/composants/programme-hors-ligne"
import {
  BoutonAnnulerEpreuve,
  FormulaireEngagement,
  FormulaireInfos,
  FormulaireProgramme,
  FormulaireSpeciale,
} from "@/apps/saison/composants/formulaires"
import {
  BoutonValider,
  FormulaireContester,
  FormulairePreuve,
  FormulaireResultat,
} from "@/apps/saison/composants/resultats"
import { COULEUR_VALIDATION, formaterDuree } from "@/apps/saison/regles-resultats"
import {
  LIBELLE_STATUT_ENGAGEMENT,
  LIBELLE_STATUT_RESULTAT,
  LIBELLE_TYPE_PROGRAMME,
  LIBELLE_VALIDATION_RESULTAT,
  libelle,
} from "@/apps/saison/libelles"
import { Onglets } from "@/apps/saison/composants/onglets"
import { EcranVide } from "@/components/qg/ecran-vide"
import { aAuMoins } from "@/core/droits/niveaux"

// Fiche d'une épreuve. « Prêt pour l'épreuve ? » est le premier onglet, et l'onglet par défaut (brief 2.9).
const ONGLETS = [
  { cle: "pret", libelle: "Prêt pour l'épreuve ?" },
  { cle: "infos", libelle: "Infos" },
  { cle: "engagements", libelle: "Engagements" },
  { cle: "programme", libelle: "Programme" },
  { cle: "reconnaissances", libelle: "Reconnaissances" },
  { cle: "resultats", libelle: "Résultats" },
] as const


const formatJour = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })

export default async function PageEpreuve({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ onglet?: string }>
}) {
  const acces = await accesEcran("lecture")
  if (!acces.ok) {
    return <EcranVide icone={Lock} titre={acces.titre} lignes={acces.lignes} action={{ libelle: "Retour au calendrier", href: "/apps/saison" }} />
  }
  const { id } = await params
  const { onglet = "pret" } = await searchParams
  const fiche = await lireEpreuve(id)
  if (!fiche) notFound()

  const { niveau, saisonCloturee, epreuve, infos, speciales, programme, engagements } = fiche
  // Onglets apportés par d'autres apps (Budget : Dépenses), selon l'activation de l'app et le niveau du membre.
  const { contexte } = await contexteQg()
  const ongletsApps = await ongletsVisibles(contexte, ONGLETS_FICHE_EPREUVE)
  const ongletApp = ongletsApps.find((tab) => tab.cle === onglet)
  // Saison clôturée : plus aucun bouton d'écriture, nulle part dans la fiche.
  const peutEcrire = aAuMoins(niveau, "ecriture") && !saisonCloturee
  const choix = peutEcrire ? await listerChoixEngagement() : null
  const contacts = peutEcrire ? (await listerContacts()).contacts : []
  const resultats = onglet === "resultats" ? await lireResultatsEpreuve(id) : null
  // Bloc de fin d'épreuve : seulement pour un résultat validé (lireFinDEpreuve renvoie null sinon).
  const fins = resultats ? await Promise.all(resultats.engagements.map((engagement) => lireFinDEpreuve(engagement.id))) : []
  const preparation = onglet === "pret" ? await lirePreparation(id) : null
  const reco = onglet === "reconnaissances" ? await lireReconnaissances(id) : null
  const annulee = epreuve.statut === "annulee"

  return (
    <section className="mx-auto flex max-w-4xl flex-col gap-5 px-4 py-6">
      <Link href="/apps/saison" className="cible-tactile inline-flex items-center text-sm text-texte-discret">
        ← Calendrier
      </Link>
      <header className="flex flex-col gap-1">
        <h1 className="font-titre text-2xl uppercase">{epreuve.nom}</h1>
        <p className="text-sm text-texte-discret">
          {formatJour.format(epreuve.dateDebut)} – {formatJour.format(epreuve.dateFin)}
          {epreuve.lieu ? ` · ${epreuve.lieu}` : ""}
          {annulee ? " · Annulée" : ""}
        </p>
      </header>

      <Onglets base={`/apps/saison/epreuves/${id}`} onglets={[...ONGLETS, ...ongletsApps.map((tab) => ({ cle: tab.cle, libelle: tab.libelle }))]} actif={onglet} />

      {onglet === "infos" && (
        <div className="flex flex-col gap-6">
          {peutEcrire ? (
            <FormulaireInfos
              eventId={id}
              contacts={contacts}
              organisateurId={epreuve.organisateurContactId ?? null}
              asaId={infos?.asaContactId ?? null}
              valeurs={
                infos
                  ? {
                      lieu: epreuve.lieu,
                      departement: epreuve.departement,
                      lienOfficiel: epreuve.lienOfficiel,
                      championnat: infos.championnat,
                      lienResultats: infos.lienResultats,
                      engagementsOuverture: infos.engagementsOuverture ? infos.engagementsOuverture.toISOString().slice(0, 10) : null,
                      engagementsCloture: infos.engagementsCloture ? infos.engagementsCloture.toISOString().slice(0, 10) : null,
                      // Présents seulement sous écriture : masquerMontants les retire pour la lecture.
                      tarifNormal: (infos as { tarifNormal?: number | null }).tarifNormal ?? null,
                      tarifLicencieAsa: (infos as { tarifLicencieAsa?: number | null }).tarifLicencieAsa ?? null,
                      geolocalisationIncluse: infos.geolocalisationIncluse,
                      nbSpeciales: infos.nbSpeciales,
                      kmChronometresPrevus: infos.kmChronometresPrevus?.toString() ?? null,
                      kmTotal: infos.kmTotal?.toString() ?? null,
                      lieuParcAssistance: infos.lieuParcAssistance,
                      adresseEnvoiDossier: infos.adresseEnvoiDossier,
                    }
                  : {
                      lieu: epreuve.lieu,
                      departement: epreuve.departement,
                      lienOfficiel: epreuve.lienOfficiel,
                      championnat: null,
                      lienResultats: null,
                      engagementsOuverture: null,
                      engagementsCloture: null,
                      tarifNormal: null,
                      tarifLicencieAsa: null,
                      geolocalisationIncluse: false,
                      nbSpeciales: null,
                      kmChronometresPrevus: null,
                      kmTotal: null,
                      lieuParcAssistance: null,
                      adresseEnvoiDossier: null,
                    }
              }
            />
          ) : (
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <dt className="text-texte-discret">Lieu</dt>
              <dd>{epreuve.lieu ?? "—"}</dd>
              <dt className="text-texte-discret">Lien officiel</dt>
              <dd className="break-all">{epreuve.lienOfficiel ?? "—"}</dd>
              <dt className="text-texte-discret">Championnat</dt>
              <dd>{infos?.championnat ?? "—"}</dd>
            </dl>
          )}
          {peutEcrire && !annulee && <BoutonAnnulerEpreuve eventId={id} />}
        </div>
      )}

      {onglet === "engagements" && (
        <div className="flex flex-col gap-4">
          {engagements.length === 0 && <p className="text-texte-discret">Aucune voiture engagée sur cette épreuve.</p>}
          <ul className="flex flex-col divide-y divide-bordure rounded-lg border border-bordure bg-surface">
            {engagements.map((engagement) => (
              <li key={engagement.id}>
                <Link href={`/apps/saison/engagements/${engagement.id}`} className="flex flex-col gap-1 px-4 py-3">
                  <span className="font-medium">
                    {engagement.voiture}
                    {engagement.numeroCourse ? ` · n° ${engagement.numeroCourse}` : ""}
                  </span>
                  <span className="text-sm text-texte-discret">
                    {[engagement.pilote, engagement.copilote].filter(Boolean).join(" / ") || "Équipage non renseigné"}
                    {" · "}
                    {LIBELLE_STATUT_ENGAGEMENT[engagement.statut as keyof typeof LIBELLE_STATUT_ENGAGEMENT] ?? engagement.statut}
                  </span>
                </Link>
                <Link href={`/apps/saison/engagements/${engagement.id}#debrief`} className="cible-tactile inline-flex items-center px-4 pb-3 text-sm underline">
                  Débrief
                </Link>
              </li>
            ))}
          </ul>
          {peutEcrire && !annulee && choix && (
            <div className="flex flex-col gap-2">
              <h2 className="font-medium">Engager une voiture</h2>
              <FormulaireEngagement eventId={id} choix={choix} />
            </div>
          )}
        </div>
      )}

      {onglet === "pret" && preparation && (
        <PanneauPreparation engagements={preparation.engagements} />
      )}

      {onglet === "reconnaissances" && reco && (
        <PanneauReconnaissances
          donnees={{
            eventId: id,
            peutEcrire: aAuMoins(reco.niveau, "ecriture") && !reco.saisonCloturee,
            recce: reco.recce,
            speciales: reco.speciales,
            personnes: reco.personnes,
            vehicules: reco.vehicules,
          }}
        />
      )}

      {onglet === "programme" && (
        <div className="flex flex-col gap-6">
          <ProgrammeHorsLigne
            eventId={id}
            specialesInitiales={speciales.map((stage) => ({ id: stage.id, numero: stage.numero, nom: stage.nom, longueurKm: stage.longueurKm?.toString() ?? null, nbPassages: stage.nbPassages }))}
            programmeInitial={programme.map((item) => ({ id: item.id, type: item.type, heurePrevue: item.heurePrevue?.toISOString() ?? null, lieu: item.lieu }))}
          />
          {peutEcrire && !annulee && <FormulaireSpeciale eventId={id} />}
          {peutEcrire && !annulee && (
            <FormulaireProgramme eventId={id} specialesIds={speciales.map((stage) => ({ id: stage.id, nom: stage.nom }))} />
          )}
        </div>
      )}
      {ongletApp && <ongletApp.composant ficheId={id} />}
      {onglet === "resultats" && resultats && (
        <div className="flex flex-col gap-4">
          {resultats.saisonCloturee && (
            <p className="rounded-md border border-bordure px-4 py-3 text-sm text-texte-discret">
              Cette saison est clôturée : les résultats se consultent, ils ne se modifient plus.
            </p>
          )}
          {resultats.engagements.length === 0 && (
            <p className="text-texte-discret">Aucun engagement n'est encore parti ou terminé.</p>
          )}
          {resultats.engagements.map((engagement, index) => {
            const resultat = engagement.resultat
            const fin = fins[index]
            const modifiable = resultats.niveau !== "lecture" && !resultats.saisonCloturee && (aAuMoins(resultats.niveau, "ecriture"))
            return (
              <article key={engagement.id} className="flex flex-col gap-3 rounded-lg border border-bordure bg-surface p-4">
                <header className="flex flex-col gap-1">
                  <h2 className="font-medium">
                    {engagement.voiture}
                    {engagement.numeroCourse ? ` · n° ${engagement.numeroCourse}` : ""}
                  </h2>
                  <p className="text-sm text-texte-discret">{engagement.equipage ?? "Équipage non renseigné"}</p>
                  <div className="flex flex-wrap gap-4 text-sm">
                    <Link href={`/apps/saison/engagements/${engagement.id}`} className="cible-tactile inline-flex items-center underline">
                      Ouvrir l'engagement
                    </Link>
                    {resultat && (
                      <Link href={`/apps/saison/engagements/${engagement.id}#debrief`} className="cible-tactile inline-flex items-center underline">
                        Débrief
                      </Link>
                    )}
                  </div>
                  {resultat && (
                    <p className={`text-sm font-medium ${COULEUR_VALIDATION[resultat.validation] ?? ""}`}>
                      {libelle(LIBELLE_VALIDATION_RESULTAT, resultat.validation)}
                      {resultat.validation === "valide" && !resultat.preuveLien ? " · sans preuve" : ""}
                    </p>
                  )}
                </header>

                {fin && (
                  <FinEpreuve
                    epreuve={fin.epreuve}
                    statutFinal={fin.statutFinal}
                    classementGeneral={fin.classementGeneral}
                    classementClasse={fin.classementClasse}
                    nbPartantsClasse={fin.nbPartantsClasse}
                    kmChronometres={fin.kmChronometres}
                    kmSaison={fin.kmSaison}
                    aDebrief={fin.aDebrief}
                    peutDebriefer={modifiable}
                    sansPreuve={fin.sansPreuve}
                    coutEpreuve={null}
                  />
                )}

                {resultat && (
                  <dl className="grid gap-1 text-sm sm:grid-cols-2">
                    <dt className="text-texte-discret">Statut final</dt>
                    <dd>{libelle(LIBELLE_STATUT_RESULTAT, resultat.statutFinal)}</dd>
                    <dt className="text-texte-discret">Classement général</dt>
                    <dd>{resultat.classementGeneral ?? "—"}</dd>
                    <dt className="text-texte-discret">Classement de classe</dt>
                    <dd>
                      {resultat.classementClasse ?? "—"}
                      {resultat.classementClasse && resultat.nbPartantsClasse ? ` / ${resultat.nbPartantsClasse}` : ""}
                    </dd>
                    <dt className="text-texte-discret">Temps total</dt>
                    <dd className="tabular-nums">{resultat.tempsTotalMs !== null ? formaterDuree(resultat.tempsTotalMs) : "—"}</dd>
                    <dt className="text-texte-discret">Preuve</dt>
                    <dd className="break-all">
                      {resultat.preuveLien ? (
                        <a href={resultat.preuveLien} className="cible-tactile inline-flex items-center underline">
                          {resultat.preuveLien}
                        </a>
                      ) : (
                        "Aucune"
                      )}
                    </dd>
                  </dl>
                )}

                {modifiable && (!resultat || resultat.validation !== "valide") && (
                  <FormulaireResultat
                    entryId={engagement.id}
                    speciales={resultats.speciales}
                    valeurs={
                      resultat
                        ? {
                            statutFinal: resultat.statutFinal,
                            classementGeneral: resultat.classementGeneral,
                            classementClasse: resultat.classementClasse,
                            nbClasses: resultat.nbClasses,
                            classementGroupe: resultat.classementGroupe,
                            nbPartantsClasse: resultat.nbPartantsClasse,
                            tempsTotalMs: resultat.tempsTotalMs,
                            penalitesMs: resultat.penalitesMs,
                            kmChronometres: resultat.kmChronometres,
                            causeAbandon: resultat.causeAbandon,
                            stageAbandonId: resultat.stageAbandonId,
                            public: resultat.public,
                          }
                        : null
                    }
                  />
                )}

                {modifiable && resultat && resultat.validation !== "valide" && (
                  <FormulairePreuve entryId={engagement.id} lienActuel={resultat.preuveLien} />
                )}

                {engagement.droits?.peutValider && <BoutonValider entryId={engagement.id} />}
                {engagement.droits?.messageValidation && (
                  <p className="text-sm text-texte-discret">{engagement.droits.messageValidation}</p>
                )}
                {engagement.droits?.peutContester && <FormulaireContester entryId={engagement.id} />}
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
