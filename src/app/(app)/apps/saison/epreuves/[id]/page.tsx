import Link from "next/link"
import { notFound } from "next/navigation"
import { Lock } from "lucide-react"

import { accesEcran } from "@/apps/saison/ecran"
import { lireEpreuve, lireResultatsEpreuve, listerChoixEngagement, listerContacts } from "@/apps/saison/lectures-serveur"
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
import { COULEUR_VALIDATION, LIBELLE_VALIDATION, formaterDuree } from "@/apps/saison/regles-resultats"
import { EcranVide } from "@/components/qg/ecran-vide"
import { aAuMoins } from "@/core/droits/niveaux"

// Fiche d'une épreuve, en trois onglets : Infos, Engagements, Programme. Les onglets prêt,
// reconnaissances et résultats arrivent aux tâches suivantes et ne sont pas affichés ici.
const ONGLETS = [
  { cle: "infos", libelle: "Infos" },
  { cle: "engagements", libelle: "Engagements" },
  { cle: "programme", libelle: "Programme" },
  { cle: "resultats", libelle: "Résultats" },
] as const

const LIBELLE_ENGAGEMENT: Record<string, string> = {
  envisage: "Envisagé",
  inscrit: "Inscrit",
  paye: "Payé",
  parti: "Parti",
  arrivee: "Arrivé",
  abandon: "Abandon",
  forfait: "Forfait",
}

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
  const { onglet = "infos" } = await searchParams
  const fiche = await lireEpreuve(id)
  if (!fiche) notFound()

  const { niveau, epreuve, infos, speciales, programme, kmChronometresTotal, engagements } = fiche
  const peutEcrire = aAuMoins(niveau, "ecriture")
  const choix = peutEcrire ? await listerChoixEngagement() : null
  const contacts = peutEcrire ? (await listerContacts()).contacts : []
  const resultats = onglet === "resultats" ? await lireResultatsEpreuve(id) : null
  const annulee = epreuve.statut === "annulee"

  return (
    <section className="mx-auto flex max-w-4xl flex-col gap-5 px-4 py-6">
      <Link href="/apps/saison" className="text-sm text-texte-discret">
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

      <nav className="flex gap-2 border-b border-bordure" aria-label="Onglets de l'épreuve">
        {ONGLETS.map((tab) => (
          <Link
            key={tab.cle}
            href={`/apps/saison/epreuves/${id}?onglet=${tab.cle}`}
            aria-current={onglet === tab.cle ? "page" : undefined}
            className={`min-h-11 px-3 py-2 ${onglet === tab.cle ? "border-b-2 border-marque font-medium" : "text-texte-discret"}`}
          >
            {tab.libelle}
          </Link>
        ))}
      </nav>

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
                    {LIBELLE_ENGAGEMENT[engagement.statut] ?? engagement.statut}
                  </span>
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

      {onglet === "programme" && (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h2 className="font-medium">Spéciales</h2>
            <ul className="flex flex-col gap-1 text-sm">
              {speciales.length === 0 && <li className="text-texte-discret">Aucune spéciale saisie.</li>}
              {speciales.map((stage) => (
                <li key={stage.id} className="tabular-nums">
                  {stage.numero}. {stage.nom}
                  {stage.longueurKm ? ` · ${stage.longueurKm.toString()} km` : ""}
                  {stage.nbPassages ? ` · ${stage.nbPassages} passage(s)` : ""}
                </li>
              ))}
              <li className="font-medium tabular-nums">Total chronométré : {kmChronometresTotal.toFixed(1)} km</li>
            </ul>
            {peutEcrire && !annulee && <FormulaireSpeciale eventId={id} />}
          </div>

          <div className="flex flex-col gap-2">
            <h2 className="font-medium">Programme du week-end</h2>
            <ul className="flex flex-col gap-1 text-sm">
              {programme.length === 0 && <li className="text-texte-discret">Programme vide.</li>}
              {programme.map((item) => (
                <li key={item.id} className="tabular-nums">
                  {item.heurePrevue
                    ? new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" }).format(item.heurePrevue)
                    : "--:--"}{" "}
                  · {item.type.replace(/_/g, " ")}
                  {item.lieu ? ` · ${item.lieu}` : ""}
                </li>
              ))}
            </ul>
            {peutEcrire && !annulee && (
              <FormulaireProgramme eventId={id} specialesIds={speciales.map((stage) => ({ id: stage.id, nom: stage.nom }))} />
            )}
          </div>
        </div>
      )}
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
          {resultats.engagements.map((engagement) => {
            const resultat = engagement.resultat
            const modifiable = resultats.niveau !== "lecture" && !resultats.saisonCloturee && (aAuMoins(resultats.niveau, "ecriture"))
            return (
              <article key={engagement.id} className="flex flex-col gap-3 rounded-lg border border-bordure bg-surface p-4">
                <header className="flex flex-col gap-1">
                  <h2 className="font-medium">
                    {engagement.voiture}
                    {engagement.numeroCourse ? ` · n° ${engagement.numeroCourse}` : ""}
                  </h2>
                  <p className="text-sm text-texte-discret">{engagement.equipage ?? "Équipage non renseigné"}</p>
                  <Link href={`/apps/saison/engagements/${engagement.id}`} className="text-sm underline">
                    Ouvrir l'engagement
                  </Link>
                  {resultat && (
                    <p className={`text-sm font-medium ${COULEUR_VALIDATION[resultat.validation] ?? ""}`}>
                      {LIBELLE_VALIDATION[resultat.validation] ?? resultat.validation}
                      {resultat.validation === "valide" && !resultat.preuveLien ? " · sans preuve" : ""}
                    </p>
                  )}
                </header>

                {resultat && (
                  <dl className="grid gap-1 text-sm sm:grid-cols-2">
                    <dt className="text-texte-discret">Statut final</dt>
                    <dd>{resultat.statutFinal}</dd>
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
                        <a href={resultat.preuveLien} className="underline">
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
