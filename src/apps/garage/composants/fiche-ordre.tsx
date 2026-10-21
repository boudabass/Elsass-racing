"use client"

// Fiche d'un ordre de travail (tâche 4.3, §3) : réglages, affectations, avancement, statut, pièces, coût et fin. Chaque
// action est un tiroir. Une action refusée reste visible, désactivée, avec la raison. L'assistance ne voit que les
// actions qui lui sont permises (avancement, statut, fin sans pièce), et jamais le coût.

import { useRouter } from "next/navigation"

import { TiroirAction } from "@/components/formulaire/tiroir"
import { BOUTON_SECONDAIRE, CHAMP } from "@/lib/classes-formulaire"

import {
  affecterOrdreAction,
  ajouterPieceOrdreAction,
  avancerOrdreAction,
  changerStatutOrdreAction,
  modifierCoutOrdreAction,
  modifierOrdreAction,
  retirerPieceOrdreAction,
  terminerOrdreAction,
} from "../actions"
import { LIBELLE_MOTIF_DEPOSE } from "../libelles"
import type { FicheOrdre, lireChoixTravaux } from "../lectures-serveur"
import { LIBELLE_PRIORITE, LIBELLE_STATUT_ORDRE, LIBELLE_TYPE_ORDRE, PRIORITES_TRAVAIL, TYPES_ORDRE } from "../travaux"

type Choix = Awaited<ReturnType<typeof lireChoixTravaux>>

export interface FicheOrdreProps {
  fiche: FicheOrdre
  // Présents seulement au niveau écriture.
  choix: Choix | null
  // Pièces de la voiture disponibles (non montées, non déjà sur l'ordre). Présent seulement au niveau écriture.
  stock: Array<{ id: string; designation: string }> | null
  // Ce compte peut faire avancer et terminer l'ordre (écriture, ou affecté pour l'assistance).
  peutAvancer: boolean
}

// Pourquoi une action d'écriture est refusée, dans l'ordre : terminé d'abord, puis niveau.
function raisonRefus(fiche: FicheOrdre): string | null {
  if (fiche.ordre.statut === "termine") return "Cet ordre est terminé : il ne se modifie plus."
  if (!fiche.peutEcrire) return "Seul l'équipage peut modifier cet ordre."
  return null
}

function montantSaisi(cents: number | null): string {
  if (cents === null) return ""
  return (cents / 100).toFixed(2).replace(".", ",")
}

export function FicheOrdreEcran({ fiche, choix, stock, peutAvancer }: FicheOrdreProps) {
  const router = useRouter()
  const { ordre } = fiche
  const termine = ordre.statut === "termine"
  const refusEcriture = raisonRefus(fiche)
  const rafraichir = () => router.refresh()

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="text-sm text-texte-discret">
          {LIBELLE_TYPE_ORDRE[ordre.type]}
          {ordre.organeNom ? ` · ${ordre.organeNom}` : ""}
        </p>
        <h1 className="titre-rallye text-3xl">{ordre.titre}</h1>
        <p className="text-sm font-medium">{LIBELLE_STATUT_ORDRE[ordre.statut]}</p>
      </header>

      <section aria-labelledby="ordre-detail" className="flex flex-col gap-3">
        <h2 id="ordre-detail" className="text-lg font-semibold">
          Détail
        </h2>
        <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-texte-discret">Priorité</dt>
          <dd>{LIBELLE_PRIORITE[ordre.priorite]}</dd>
          <dt className="text-texte-discret">À faire avant</dt>
          <dd>{ordre.aFaireAvant ? `${ordre.aFaireAvant.nom} (${ordre.aFaireAvant.date.split("-").reverse().join("/")})` : "Pas d'échéance"}</dd>
          <dt className="text-texte-discret">Personnes affectées</dt>
          <dd>{ordre.personnes.length > 0 ? ordre.personnes.join(", ") : "Aucune"}</dd>
          <dt className="text-texte-discret">Avancement</dt>
          <dd className="chiffre">{ordre.avancementPct} %</dd>
          {ordre.cout !== undefined && (
            <>
              <dt className="text-texte-discret">Main-d&apos;œuvre</dt>
              <dd>{ordre.cout.cents === null ? "Coût non saisi" : new Intl.NumberFormat("fr-FR", { style: "currency", currency: ordre.cout.devise }).format(ordre.cout.cents / 100)}</dd>
              <dt className="text-texte-discret">Prestataire</dt>
              <dd>{ordre.prestataire ?? "Aucun"}</dd>
            </>
          )}
        </dl>
      </section>

      <section aria-labelledby="ordre-pieces" className="flex flex-col gap-3">
        <h2 id="ordre-pieces" className="text-lg font-semibold">
          Pièces
        </h2>
        {fiche.pieces.length === 0 ? (
          <p className="text-sm text-texte-discret">Aucune pièce sur cet ordre.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {fiche.pieces.map((piece) => (
              <li key={piece.partId} className="flex flex-wrap items-center justify-between gap-3 text-sm">
                <span>{piece.designation}</span>
                {refusEcriture ? (
                  <button type="button" disabled className={`${BOUTON_SECONDAIRE} opacity-60`}>
                    Retirer
                  </button>
                ) : (
                  <TiroirAction
                    libelle="Retirer"
                    titre="Retirer la pièce"
                    question="La pièce n'est plus sur cet ordre. Rien n'est posé ni déposé."
                    danger
                    action={retirerPieceOrdreAction}
                    libelleBouton="Retirer la pièce"
                    libelleEnCours="Retrait…"
                    onSucces={rafraichir}
                  >
                    <input type="hidden" name="ordreId" value={ordre.id} />
                    <input type="hidden" name="partId" value={piece.partId} />
                  </TiroirAction>
                )}
              </li>
            ))}
          </ul>
        )}
        {refusEcriture ? (
          <p className="text-sm text-texte-discret">{refusEcriture}</p>
        ) : (
          stock && (
            <TiroirAction
              libelle="Ajouter une pièce"
              titre="Ajouter une pièce à l'ordre"
              action={ajouterPieceOrdreAction}
              libelleBouton="Ajouter la pièce"
              libelleEnCours="Enregistrement…"
              onSucces={rafraichir}
            >
              <input type="hidden" name="ordreId" value={ordre.id} />
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">Pièce du stock</span>
                <select name="partId" required defaultValue="" className={CHAMP}>
                  <option value="" disabled>
                    Choisir une pièce
                  </option>
                  {stock.map((piece) => (
                    <option key={piece.id} value={piece.id}>
                      {piece.designation}
                    </option>
                  ))}
                </select>
              </label>
            </TiroirAction>
          )
        )}
      </section>

      <section aria-labelledby="ordre-actions" className="flex flex-col gap-3">
        <h2 id="ordre-actions" className="text-lg font-semibold">
          Actions
        </h2>
        <div className="flex flex-wrap gap-3">
          {fiche.peutEcrire && choix && (
            <TiroirAction
              libelle="Modifier"
              titre="Modifier l'ordre"
              action={modifierOrdreAction}
              libelleBouton="Enregistrer"
              libelleEnCours="Enregistrement…"
              onSucces={rafraichir}
            >
              <input type="hidden" name="ordreId" value={ordre.id} />
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">Titre</span>
                <input name="titre" required maxLength={200} defaultValue={ordre.titre} className={CHAMP} />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">Type</span>
                <select name="type" defaultValue={ordre.type} className={CHAMP}>
                  {TYPES_ORDRE.map((type) => (
                    <option key={type} value={type}>
                      {LIBELLE_TYPE_ORDRE[type]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">Organe</span>
                <select name="vehicleComponentId" defaultValue={fiche.vehicleComponentId ?? ""} className={CHAMP}>
                  <option value="">Aucun organe précis</option>
                  {choix.organes.map((organe) => (
                    <option key={organe.id} value={organe.id}>
                      {organe.nom}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">Priorité</span>
                <select name="priorite" defaultValue={ordre.priorite} className={CHAMP}>
                  {PRIORITES_TRAVAIL.map((priorite) => (
                    <option key={priorite} value={priorite}>
                      {LIBELLE_PRIORITE[priorite]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">À faire avant l&apos;épreuve</span>
                <select name="aFaireAvantEventId" defaultValue={fiche.aFaireAvantEventId ?? ""} className={CHAMP}>
                  <option value="">Pas d&apos;échéance</option>
                  {choix.epreuves.map((epreuve) => (
                    <option key={epreuve.id} value={epreuve.id}>
                      {epreuve.nom} ({epreuve.date})
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">Durée estimée, en minutes (facultative)</span>
                <input name="dureeEstimeeMinutes" type="number" inputMode="numeric" min={1} step={1} defaultValue={fiche.dureeEstimeeMinutes ?? ""} className={CHAMP} />
              </label>
            </TiroirAction>
          )}

          {fiche.peutEcrire && choix && (
            <TiroirAction
              libelle="Affecter"
              titre="Personnes affectées"
              action={affecterOrdreAction}
              libelleBouton="Enregistrer les affectations"
              libelleEnCours="Enregistrement…"
              onSucces={rafraichir}
            >
              <input type="hidden" name="ordreId" value={ordre.id} />
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1 text-sm font-medium">Qui travaille sur cet ordre</legend>
                {choix.personnes.length === 0 ? (
                  <p className="text-sm text-texte-discret">Aucune personne dans la team pour l&apos;instant.</p>
                ) : (
                  choix.personnes.map((personne) => (
                    <label key={personne.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        name="personIds"
                        value={personne.id}
                        defaultChecked={fiche.personIds.includes(personne.id)}
                        className="h-5 w-5"
                      />
                      <span>{personne.nom}</span>
                    </label>
                  ))
                )}
              </fieldset>
            </TiroirAction>
          )}

          {peutAvancer && !termine && (
            <TiroirAction
              libelle="Avancement"
              titre="Avancement"
              action={avancerOrdreAction}
              libelleBouton="Enregistrer l'avancement"
              libelleEnCours="Enregistrement…"
              onSucces={rafraichir}
            >
              <input type="hidden" name="ordreId" value={ordre.id} />
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">Avancement, en pourcentage</span>
                <input name="pct" type="number" inputMode="numeric" min={0} max={100} step={1} required defaultValue={ordre.avancementPct} className={CHAMP} />
              </label>
            </TiroirAction>
          )}

          {peutAvancer && !termine && (
            <TiroirAction
              libelle="Changer le statut"
              titre="Statut de l'ordre"
              action={changerStatutOrdreAction}
              libelleBouton="Enregistrer le statut"
              libelleEnCours="Enregistrement…"
              onSucces={rafraichir}
            >
              <input type="hidden" name="ordreId" value={ordre.id} />
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">Statut</span>
                <select name="statut" defaultValue={ordre.statut === "en_cours" ? "en_cours" : "prevu"} className={CHAMP}>
                  <option value="prevu">{LIBELLE_STATUT_ORDRE.prevu}</option>
                  <option value="en_cours">{LIBELLE_STATUT_ORDRE.en_cours}</option>
                </select>
              </label>
            </TiroirAction>
          )}

          {fiche.peutEcrire && choix && !termine && (
            <TiroirAction
              libelle="Coût et prestataire"
              titre="Coût et prestataire"
              action={modifierCoutOrdreAction}
              libelleBouton="Enregistrer"
              libelleEnCours="Enregistrement…"
              onSucces={rafraichir}
            >
              <input type="hidden" name="ordreId" value={ordre.id} />
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">Main-d&apos;œuvre, en euros (facultatif)</span>
                <input name="coutMainOeuvre" inputMode="decimal" placeholder="0,00" defaultValue={montantSaisi(ordre.cout?.cents ?? null)} className={CHAMP} />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">Prestataire (facultatif)</span>
                <select name="prestataireContactId" defaultValue="" className={CHAMP}>
                  <option value="">Aucun prestataire</option>
                  {choix.prestataires.map((contact) => (
                    <option key={contact.id} value={contact.id}>
                      {contact.nom}
                    </option>
                  ))}
                </select>
              </label>
            </TiroirAction>
          )}

          {peutAvancer && !termine && (
            <TiroirAction
              libelle="Terminer l'ordre"
              titre="Terminer l'ordre"
              question="L'ordre passe à terminé et ne se rouvre pas. Pour un remplacement, la pièce est posée sur son organe."
              action={terminerOrdreAction}
              libelleBouton="Terminer l'ordre"
              libelleEnCours="Fin en cours…"
              onSucces={rafraichir}
            >
              <input type="hidden" name="ordreId" value={ordre.id} />
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">Motif de dépose de la pièce en place (si une pièce est montée)</span>
                <select name="motifDepose" defaultValue="" className={CHAMP}>
                  <option value="">Aucun, ou pas de pièce en place</option>
                  {Object.entries(LIBELLE_MOTIF_DEPOSE).map(([cle, libelle]) => (
                    <option key={cle} value={cle}>
                      {libelle}
                    </option>
                  ))}
                </select>
              </label>
            </TiroirAction>
          )}
        </div>
        {termine && <p className="text-sm text-texte-discret">Cet ordre est terminé : il ne se modifie plus.</p>}
        {!termine && !peutAvancer && !fiche.peutEcrire && (
          <p className="text-sm text-texte-discret">Vous ne pouvez pas agir sur cet ordre.</p>
        )}
      </section>
    </div>
  )
}
