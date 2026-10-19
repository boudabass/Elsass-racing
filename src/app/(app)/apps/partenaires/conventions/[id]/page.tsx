import Link from "next/link"
import { notFound } from "next/navigation"
import { Lock } from "lucide-react"

import { accesEcran } from "@/apps/partenaires/ecran"
import { FormulaireConvention, type ValeursConvention } from "@/apps/partenaires/composants/formulaire-convention"
import { FormulaireContrepartie } from "@/apps/partenaires/composants/formulaire-contrepartie"
import { FormulaireAvenant, FormulaireSignature } from "@/apps/partenaires/composants/formulaire-documents"
import { FormulairePreuve } from "@/apps/partenaires/composants/formulaire-preuve"
import { ActionsContrepartie } from "@/apps/partenaires/composants/actions-contrepartie"
import { ActionsPreuve } from "@/apps/partenaires/composants/actions-preuve"
import { SaisieAvancement } from "@/apps/partenaires/composants/saisie-avancement"
import { BoutonEnvoi, FormulaireAction } from "@/apps/partenaires/composants/formulaire"
import {
  dateFrancaise,
  LIBELLES_APPORT_RECU,
  LIBELLES_STATUT_CONTREPARTIE,
  LIBELLES_STATUT_CONVENTION,
  LIBELLES_TYPE_CONTREPARTIE,
  LIBELLES_TYPE_PREUVE,
  couleurBarreContrepartie,
  couleurContrepartie,
} from "@/apps/partenaires/affichage"
import {
  genererDocumentAction,
  marquerEnvoyeeAction,
  masquerPreuveAction,
  renouvelerAction,
  reporterContrepartieAction,
  resilierAction,
  supprimerPreuveAction,
} from "@/apps/partenaires/actions"
import { accesPartenaires, genererDocument, lireCatalogue, lireModeles } from "@/apps/partenaires/services-serveur"
import { lireConvention, lireEpreuvesDeSaison, lireSaisons, lireVersementsConvention } from "@/apps/partenaires/lectures-serveur"
import { listerEmplacementsPourPartenaires } from "@/apps/voiture/lectures-partagees"
import { enRetard, formaterMontant, jourParis, statutContrepartie } from "@/apps/partenaires/regles"
import { EcranVide } from "@/components/qg/ecran-vide"
import { Onglets } from "@/components/qg/onglets-fiche"
import { aAuMoins } from "@/core/droits/niveaux"
import { BOUTON_DANGER, BOUTON_SECONDAIRE, CHAMP, LIEN } from "@/lib/classes-formulaire"

const jour = (date: Date) => date.toISOString().slice(0, 10)

// Libellés des champs du modèle, pour l'encadré « champs à compléter » (brief 3.6, §5).
const LIBELLES_CHAMP: Record<string, string> = {
  "team.nom": "le nom de la team",
  "team.forme_juridique": "la forme juridique de la team",
  "team.rna": "le numéro d'inscription de la team",
  "team.adresse": "le siège de la team",
  "team.representant": "le représentant de la team",
  "partenaire.entreprise": "le nom de l'entreprise",
  "partenaire.adresse": "l'adresse du partenaire",
  "partenaire.representant": "le représentant du partenaire",
  "partenaire.qualite": "la fonction de l'interlocuteur du partenaire",
  "convention.apport_financier": "l'apport financier",
  "convention.apport_nature": "l'apport en nature",
  "convention.echeancier": "l'échéancier",
  "convention.date_debut": "la date de début",
  "convention.date_fin": "la date de fin",
  "convention.saison": "saison",
  contreparties: "les contreparties",
}

// Où remplir chaque champ : les données de la team dans Réglages, celles du partenaire dans sa fiche.
function destinationChamp(cle: string, partnerId: string): { href: string; texte: string } | null {
  if (cle.startsWith("team.")) return { href: "/apps/settings/association", texte: "Réglages, rubrique Association" }
  if (cle.startsWith("partenaire.")) return { href: `/apps/partenaires/${partnerId}`, texte: "la fiche du partenaire" }
  return null
}

const CLASSE_BLOC = "flex flex-col gap-4 rounded-md border border-bordure bg-surface p-4"

export default async function PageConvention({
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
  const convention = await lireConvention(id)
  if (!convention) notFound()

  const gestion = aAuMoins(acces.niveau, "gestion")
  const { ctx } = await accesPartenaires("ecriture")
  const aujourdhui = jourParis(new Date())
  const [saisons, modeles, catalogue, epreuves, emplacements] = await Promise.all([
    lireSaisons(),
    lireModeles(),
    lireCatalogue(),
    convention.seasonId ? lireEpreuvesDeSaison(convention.seasonId) : Promise.resolve([]),
    listerEmplacementsPourPartenaires(ctx),
  ])
  const versements = await lireVersementsConvention(id)
  const modelesActifs = modeles.filter((m) => m.actif)
  const nomEpreuve = new Map(epreuves.map((e) => [e.id, e.nom]))
  const statut = convention.statut
  const estBrouillon = statut === "brouillon"
  const estEnvoyee = statut === "envoyee"
  const estActive = statut === "signee" || statut === "en_cours"
  const estSignee = estActive || statut === "terminee"

  // Le document n'est pas généré ici : on lit seulement ce qui manque au modèle, pour l'encadré.
  const apercu = await genererDocument(id).catch(() => null)
  const vides = apercu?.vides ?? []
  const inconnus = apercu?.inconnus ?? []

  const onglets = [
    { cle: "contreparties", libelle: "Contreparties" },
    { cle: "document", libelle: "Document" },
    { cle: "avenants", libelle: "Avenants" },
    { cle: "historique", libelle: "Historique" },
  ]
  const actif = onglets.find((choix) => choix.cle === onglet)?.cle ?? "contreparties"

  const valeursConvention: ValeursConvention = {
    templateId: convention.templateId ?? modelesActifs[0]?.id ?? "",
    seasonId: convention.seasonId ?? "",
    dateDebut: jour(convention.dateDebut),
    dateFin: jour(convention.dateFin),
    apportFinancier: convention.apportFinancierCentimes ? (convention.apportFinancierCentimes / 100).toString().replace(".", ",") : "",
    apportNatureDescription: convention.apportNatureDescription ?? "",
    apportNatureValeur: convention.apportNatureValeurCentimes ? (convention.apportNatureValeurCentimes / 100).toString().replace(".", ",") : "",
    echeancier: (convention.echeancier as { date: string; montantCentimes: number }[]).map((ligne) => ({
      date: ligne.date,
      montant: (ligne.montantCentimes / 100).toString().replace(".", ","),
    })),
  }
  const catalogueActif = catalogue.filter((c) => c.actif).map((c) => ({ id: c.id, nom: c.nom, type: c.type, unite: c.unite, quantiteDefaut: c.quantiteDefaut }))
  const emplacementsPourChoix = emplacements.map((e) => ({ id: e.id, nom: e.nom, vehicleNom: e.vehicleNom, statut: e.statut }))
  const epreuvesPourChoix = epreuves.map((e) => ({ id: e.id, nom: e.nom }))

  return (
    <section className="flex w-full max-w-4xl flex-col gap-6">
      <Link href={`/apps/partenaires/${convention.partnerId}?onglet=conventions`} className={`${LIEN} self-start text-sm text-texte-discret`}>
        ← {convention.partner.contact.nom}
      </Link>
      <header className="flex flex-col gap-2">
        <h1 className="titre-rallye text-3xl">Convention {convention.season?.nom ?? ""}</h1>
        <p className="text-texte-discret">
          Du {dateFrancaise(jour(convention.dateDebut))} au {dateFrancaise(jour(convention.dateFin))} · {LIBELLES_STATUT_CONVENTION[statut]} · Apport{" "}
          {formaterMontant(convention.apportFinancierCentimes)}
        </p>
        <p className="font-medium" data-testid="apport-recu">
          {LIBELLES_APPORT_RECU[convention.apportRecu]}
        </p>
        {versements.length > 0 && (
          <ul aria-label="Versements prévus" className="flex flex-col gap-1 text-sm">
            {versements.map((versement) => (
              <li key={versement.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span>
                  {formaterMontant(versement.montant)}, prévu le {dateFrancaise(jour(versement.date))} ·{" "}
                  {versement.statut === "encaissee" && versement.encaisseeLe
                    ? `encaissé le ${dateFrancaise(jour(versement.encaisseeLe))}`
                    : "pas encore encaissé"}
                </span>
                {versement.statut === "prevue" && (
                  <Link href={`/apps/budget/mouvement/${versement.id}`} className={LIEN}>
                    Encaisser dans Budget
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
        {convention.signataires && <p className="text-sm">Signée par {convention.signataires}{convention.signeeLe ? `, le ${dateFrancaise(jour(convention.signeeLe))}` : ""}.</p>}
      </header>
      {estBrouillon && (
        <p className="text-sm">
          Prochaine étape : {convention.benefits.length === 0 ? "« Ajoute une contrepartie »" : "« Génère le document », puis « Marque-la envoyée »"}
        </p>
      )}
      {estEnvoyee && <p className="text-sm">Prochaine étape : « Marque-la signée »</p>}
      <Onglets base={`/apps/partenaires/conventions/${id}`} onglets={onglets} actif={actif} nom="Onglets de la convention" />



      {actif === "contreparties" && (
        <div className="flex flex-col gap-6">
          {/* Un bouton à sa taille ; le formulaire ouvert prend toute la largeur (brief 3.10, §3). */}
          <details className="self-start [&[open]]:w-full">
            <summary className={`${BOUTON_SECONDAIRE} inline-flex cursor-pointer list-none`}>Ajouter une contrepartie</summary>
            <div className={`${CLASSE_BLOC} mt-4`}>
              <FormulaireContrepartie
                mode="creation"
                agreementId={convention.id}
                catalogue={catalogueActif}
                emplacements={emplacementsPourChoix}
                epreuves={epreuvesPourChoix}
                valeurs={{ libelle: "", type: "autre", quantitePromise: 1, unite: "", slotId: null, eventIds: [], echeance: null }}
              />
            </div>
          </details>

          {convention.benefits.length === 0 ? (
            <p className="text-texte-discret">Aucune contrepartie pour l&apos;instant.</p>
          ) : (
            <ul className="flex flex-col gap-4">
              {convention.benefits.map((benefice) => {
                const echeance = benefice.echeance ? jour(benefice.echeance) : null
                const retard = echeance !== null && enRetard({ statut: benefice.statut, quantitePromise: benefice.quantitePromise, quantiteTenue: benefice.quantiteTenue, echeance }, aujourdhui)
                const statutAffiche = retard ? "en_retard" : statutContrepartie({ statut: benefice.statut, quantitePromise: benefice.quantitePromise, quantiteTenue: benefice.quantiteTenue, echeance })
                const pourcentage = benefice.quantitePromise > 0 ? Math.min(100, Math.round((benefice.quantiteTenue / benefice.quantitePromise) * 100)) : 0
                const epreuvesDuBenefice = benefice.eventIds.map((identifiant) => nomEpreuve.get(identifiant)).filter((nom): nom is string => Boolean(nom))
                const typeAffiche = LIBELLES_TYPE_CONTREPARTIE[benefice.type] ?? benefice.type
                // Le type ne répète pas le libellé : « Logo sur la voiture » n'est pas écrit deux fois.
                const sousTitre = [
                  typeAffiche && !benefice.libelle.toLowerCase().includes(typeAffiche.toLowerCase()) ? typeAffiche : null,
                  benefice.slotNom ? `Emplacement : ${benefice.slotNom}` : null,
                  epreuvesDuBenefice.length > 0 ? `Épreuves : ${epreuvesDuBenefice.join(", ")}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")
                return (
                  <li key={benefice.id} id={`contrepartie-${benefice.id}`} className={`${CLASSE_BLOC} scroll-mt-24`}>
                    <div className="flex flex-col gap-1">
                      <h3 className="break-words font-medium">{benefice.libelle}</h3>
                      {sousTitre && <p className="text-sm text-texte-discret">{sousTitre}</p>}
                    </div>
                    <div className="flex flex-col gap-2">
                      <div
                        role="progressbar"
                        aria-label={`Avancement : ${benefice.libelle}`}
                        aria-valuemin={0}
                        aria-valuemax={benefice.quantitePromise}
                        aria-valuenow={benefice.quantiteTenue}
                        className="h-2 w-full overflow-hidden rounded bg-surface-2"
                      >
                        <div className={`h-2 rounded ${couleurBarreContrepartie(statutAffiche, echeance, aujourdhui)}`} style={{ width: `${pourcentage}%` }} />
                      </div>
                      <p className="text-sm">
                        {benefice.quantiteTenue} sur {benefice.quantitePromise} ·{" "}
                        <span className={couleurContrepartie(statutAffiche, echeance, aujourdhui)}>{LIBELLES_STATUT_CONTREPARTIE[statutAffiche]}</span>
                        {echeance ? ` · Échéance ${dateFrancaise(echeance)}` : ""}
                      </p>
                    </div>

                    <ActionsContrepartie
                      actions={[
                        {
                          cle: "avancement",
                          libelle: "Saisir l'avancement",
                          contenu: <SaisieAvancement benefitId={benefice.id} quantiteTenue={benefice.quantiteTenue} quantitePromise={benefice.quantitePromise} />,
                        },
                        {
                          cle: "report",
                          libelle: "Reporter",
                          contenu: (
                            <FormulaireAction action={reporterContrepartieAction} nom="Reporter la contrepartie" className="flex flex-wrap items-end gap-3">
                              <input type="hidden" name="benefitId" value={benefice.id} />
                              <label className="flex flex-col gap-1 text-sm font-medium">
                                Reporter à
                                <input name="echeance" type="date" defaultValue={echeance ?? ""} className={CHAMP} />
                              </label>
                              <BoutonEnvoi libelle="Reporter" secondaire />
                            </FormulaireAction>
                          ),
                        },
                        {
                          cle: "modification",
                          libelle: "Modifier la contrepartie",
                          contenu: (
                            <FormulaireContrepartie
                              mode="modification"
                              agreementId={convention.id}
                              benefitId={benefice.id}
                              catalogue={[]}
                              emplacements={emplacementsPourChoix}
                              epreuves={epreuvesPourChoix}
                              valeurs={{
                                libelle: benefice.libelle,
                                type: benefice.type,
                                quantitePromise: benefice.quantitePromise,
                                unite: "",
                                slotId: benefice.slotId,
                                eventIds: benefice.eventIds,
                                echeance,
                              }}
                            />
                          ),
                        },
                      ]}
                      preuves={
                        <>
                          <h4 className="font-medium">Preuves</h4>
                          {benefice.proofs.length === 0 ? (
                            <p className="text-sm text-texte-discret">Aucune preuve pour l&apos;instant.</p>
                          ) : (
                            <ul className="flex flex-col gap-3">
                              {benefice.proofs.map((preuve) => (
                                <li key={preuve.id} className="flex flex-col gap-2">
                                  <div className="flex flex-wrap items-start gap-3">
                                    {preuve.fileId && (
                                      // eslint-disable-next-line @next/next/no-img-element -- fichier de la team servi par /api/fichiers ; taille fixe et chargement paresseux
                                      <img src={`/api/fichiers/${preuve.fileId}`} width={64} height={64} alt="Photo de la preuve" loading="lazy" decoding="async" className="h-16 w-16 rounded-md object-cover" />
                                    )}
                                    <div className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
                                      <p className="font-medium">
                                        {dateFrancaise(jour(preuve.date))} · {LIBELLES_TYPE_PREUVE[preuve.type] ?? preuve.type}
                                        {preuve.event ? ` · ${preuve.event.nom}` : ""}
                                      </p>
                                      {preuve.commentaire && <p className="whitespace-pre-line">{preuve.commentaire}</p>}
                                      {preuve.lien && (
                                        <a href={preuve.lien} target="_blank" rel="noopener noreferrer" className={`${LIEN} break-all`}>
                                          Ouvrir le lien
                                        </a>
                                      )}
                                      <p className="text-texte-discret">{preuve.visiblePartenaire ? "Visible par le partenaire" : "Masquée pour le partenaire"}</p>
                                    </div>
                                  </div>
                                  <ActionsPreuve preuveId={preuve.id} visiblePartenaire={preuve.visiblePartenaire} masquer={masquerPreuveAction} supprimer={supprimerPreuveAction} />
                                </li>
                              ))}
                            </ul>
                          )}
                        </>
                      }
                      ajoutPreuve={{
                        cle: "preuve",
                        libelle: "Ajouter une preuve",
                        contenu: <FormulairePreuve benefitId={benefice.id} epreuves={epreuvesPourChoix} aujourdhui={aujourdhui} />,
                      }}
                    />
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}

      {actif === "document" && (
        <div className="flex flex-col gap-6">
          <section aria-labelledby="document-genere" className={CLASSE_BLOC}>
            <h2 id="document-genere" className="text-lg font-medium">
              Document de la convention
            </h2>
            {vides.length > 0 && (
              <div role="status" className="flex flex-col gap-2 rounded-md border border-etat-orange p-3 text-sm">
                <p className="font-medium">
                  {vides.length === 1 ? "1 champ à compléter" : `${vides.length} champs à compléter`} avant le téléchargement :
                </p>
                <ul className="flex list-inside list-disc flex-col gap-1">
                  {vides.map((cle) => {
                    const destination = destinationChamp(cle, convention.partnerId)
                    return (
                      <li key={cle}>
                        {LIBELLES_CHAMP[cle] ?? cle}
                        {destination && (
                          <>
                            {" · "}
                            <Link href={destination.href} className={LIEN}>
                              {destination.texte}
                            </Link>
                          </>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
            {inconnus.length > 0 && (
              <p role="status" className="text-sm text-etat-rouge">
                Champ inconnu dans le modèle : {inconnus.join(", ")}. Corrige-le dans Modèles.
              </p>
            )}
            {!apercu && <p className="text-sm text-texte-discret">Le modèle de cette convention ne peut pas être lu. Vérifie le modèle dans Modèles.</p>}
            <div className="flex flex-wrap gap-3">
              {convention.documentGenereFileId && (
                <a href={`/api/fichiers/${convention.documentGenereFileId}`} className={LIEN}>
                  Télécharger le document
                </a>
              )}
              {convention.documentSigneFileId && (
                <a href={`/api/fichiers/${convention.documentSigneFileId}`} className={LIEN}>
                  Télécharger le document signé
                </a>
              )}
            </div>
            {(estBrouillon || estEnvoyee) && (
              <FormulaireAction action={genererDocumentAction} nom="Générer le document" ok="Document généré." className="flex">
                <input type="hidden" name="agreementId" value={convention.id} />
                <BoutonEnvoi libelle={convention.documentGenereFileId ? "Générer à nouveau le document" : "Générer le document"} />
              </FormulaireAction>
            )}
          </section>
        </div>
      )}

      {actif === "avenants" && (
        <div className="flex flex-col gap-6">
          {convention.amendments.length === 0 ? (
            <p className="text-texte-discret">Aucun avenant pour l&apos;instant.</p>
          ) : (
            <ol className="flex flex-col gap-3">
              {convention.amendments.map((avenant) => (
                <li key={avenant.id} className="flex flex-col gap-1 rounded-md border border-bordure bg-surface p-4 text-sm">
                  <p className="font-medium">
                    Avenant {avenant.numero} · {dateFrancaise(jour(avenant.date))} · {avenant.motif}
                  </p>
                  <p className="whitespace-pre-line">{avenant.changements}</p>
                  {avenant.documentFileId && (
                    <a href={`/api/fichiers/${avenant.documentFileId}`} className={`${LIEN} self-start`}>
                      Télécharger le document de l&apos;avenant
                    </a>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      {actif === "historique" && (
        <div className="flex flex-col gap-4">
          {convention.precedente ? (
            <p className="text-sm">
              Convention précédente :{" "}
              <Link href={`/apps/partenaires/conventions/${convention.precedente.id}`} className={LIEN}>
                du {dateFrancaise(jour(convention.precedente.dateDebut))} au {dateFrancaise(jour(convention.precedente.dateFin))}
              </Link>
            </p>
          ) : (
            <p className="text-sm text-texte-discret">Aucune convention précédente.</p>
          )}
          {convention.renouvellements.length > 0 && (
            <ul className="flex flex-col gap-2 text-sm">
              {convention.renouvellements.map((suivante) => (
                <li key={suivante.id}>
                  Renouvellement :{" "}
                  <Link href={`/apps/partenaires/conventions/${suivante.id}`} className={LIEN}>
                    du {dateFrancaise(jour(suivante.dateDebut))} au {dateFrancaise(jour(suivante.dateFin))}
                  </Link>{" "}
                  ({LIBELLES_STATUT_CONVENTION[suivante.statut]})
                </li>
              ))}
            </ul>
          )}
        </div>
      )}


      {/* Actions selon le statut (brief 3.6, §5). Les refus du service s'affichent tels quels. En bas de page depuis la 3.11. */}
      <section aria-labelledby="gerer" className={CLASSE_BLOC}>
        <h2 id="gerer" className="text-lg font-medium">
          Gérer la convention
        </h2>
        {estBrouillon && (
          <div className="flex flex-col gap-4">
            <details>
              <summary className={`${BOUTON_SECONDAIRE} inline-flex cursor-pointer list-none`}>Modifier la convention</summary>
              <div className="mt-4">
                <FormulaireConvention
                  mode="modification"
                  partnerId={convention.partnerId}
                  agreementId={convention.id}
                  modeles={modelesActifs.map((m) => ({ id: m.id, nom: m.nom, version: m.version }))}
                  saisons={saisons.map((s) => ({ id: s.id, nom: s.nom, dateDebut: jour(s.dateDebut), dateFin: jour(s.dateFin) }))}
                  valeurs={valeursConvention}
                />
              </div>
            </details>
            <div className="flex flex-wrap gap-3">
              <FormulaireAction action={genererDocumentAction} nom="Générer le document" ok="Document généré. Le téléchargement est dans l'onglet Document." className="flex">
                <input type="hidden" name="agreementId" value={convention.id} />
                <BoutonEnvoi libelle="Générer le document" secondaire />
              </FormulaireAction>
              <FormulaireAction action={marquerEnvoyeeAction} nom="Marquer envoyée" className="flex">
                <input type="hidden" name="agreementId" value={convention.id} />
                <BoutonEnvoi libelle="Marquer envoyée" secondaire />
              </FormulaireAction>
            </div>
          </div>
        )}
        {estEnvoyee && gestion && (
          <details>
            <summary className={`${BOUTON_SECONDAIRE} inline-flex cursor-pointer list-none`}>Marquer signée</summary>
            <div className="mt-4">
              <FormulaireSignature agreementId={convention.id} aujourdhui={aujourdhui} />
            </div>
          </details>
        )}
        {estEnvoyee && !gestion && <p className="text-sm text-texte-discret">Seule la gestion peut marquer la convention signée.</p>}
        {/* Une seule ligne d'actions, qui passe à la ligne sur téléphone (brief 3.9, §6). Les formulaires s'ouvrent
            en pleine largeur, sous la ligne. « Résilier » est à droite, en couleur de danger. */}
        {estSignee && (
          <div className="flex flex-wrap items-center gap-3">
            <FormulaireAction action={renouvelerAction} nom="Renouveler" ok="Convention renouvelée. Elle apparaît dans l'historique." className="flex">
              <input type="hidden" name="agreementId" value={convention.id} />
              <BoutonEnvoi libelle="Renouveler" secondaire />
            </FormulaireAction>
            {estActive && gestion && (
              <details className="[&[open]]:basis-full">
                <summary className={`${BOUTON_SECONDAIRE} inline-flex cursor-pointer list-none`}>Ajouter un avenant</summary>
                <div className="mt-4">
                  <FormulaireAvenant agreementId={convention.id} aujourdhui={aujourdhui} />
                </div>
              </details>
            )}
            {estActive && gestion && (
              <details className="ml-auto [&[open]]:basis-full">
                <summary className={`${BOUTON_DANGER} inline-flex cursor-pointer list-none`}>Résilier la convention</summary>
                <div className="mt-4">
                  <FormulaireAction action={resilierAction} nom="Résilier" className="flex flex-col gap-3">
                    <input type="hidden" name="agreementId" value={convention.id} />
                    <label htmlFor="motif-resiliation" className="font-medium">
                      Motif (obligatoire)
                    </label>
                    <textarea id="motif-resiliation" name="motif" required rows={2} maxLength={1000} className={CHAMP} />
                    <div>
                      <BoutonEnvoi libelle="Résilier la convention" danger />
                    </div>
                  </FormulaireAction>
                </div>
              </details>
            )}
          </div>
        )}
        {statut === "resiliee" && <p className="text-sm text-texte-discret">Convention résiliée{convention.motifResiliation ? ` : ${convention.motifResiliation}` : "."}</p>}
      </section>
    </section>
  )
}
