"use client"

// Panneau de l'emplacement choisi (brief 3.4, sections 2 et 3). Chaque action est un formulaire vers une Server Action
// de actions.ts. Sous le niveau écriture, le panneau reste en lecture seule. Les confirmations se font sur la page.

import { useActionState, useEffect, useState, type ReactNode } from "react"

import { ChampFichier, type FichierEnvoye } from "@/components/formulaire/champ-fichier"
import { Message } from "@/components/formulaire/message"
import type { FormeEmplacement } from "../gabarits/types"
import { BOUTON, BOUTON_SECONDAIRE, CHAMP } from "@/lib/classes-formulaire"
import type { Resultat } from "@/core/sdk/actions-serveur"
import { jourDeParis } from "@/core/dates"

import {
  enregistrerPositionAction,
  marquerIndisponibleAction,
  modifierEmplacementAction,
  poserLogoAction,
  reserverEmplacementAction,
  retirerLogoAction,
  supprimerEmplacementAction,
} from "../actions"
import { LIBELLE_STATUT_EMPLACEMENT, COULEUR_STATUT_EMPLACEMENT, TITRE_VUE, dateEnToutesLettres, dimensionsDe } from "../libelles"
import { COTE_MINIMAL, etendueDe, formeDuChamp, type Bornes, type EmplacementPlan, type VuePlan } from "../plan"

const ACCEPT_LOGO = "image/jpeg,image/png,image/webp,image/svg+xml"
const ACCEPT_PHOTO = "image/jpeg,image/png,image/webp"

type Action = "reserver" | "poser" | "retirer" | "annuler" | "indisponible" | "disponible" | "modifier" | "supprimer" | "deplacer"

interface PanneauEmplacementProps {
  emplacement: EmplacementPlan
  vue: VuePlan
  peutEcrire: boolean
  bornes: Bornes
  // Mode « Déplacer ou redimensionner » : la forme en cours d'édition, et ses changements.
  enDeplacement: boolean
  brouillon: FormeEmplacement | null
  onDemarrerDeplacement: () => void
  onChangerBrouillon: (forme: FormeEmplacement) => void
  onFinirDeplacement: () => void
}

function dateLisible(jour: string | null): string | null {
  return jour ? dateEnToutesLettres(new Date(`${jour}T00:00:00Z`)) : null
}

export function PanneauEmplacement(props: PanneauEmplacementProps) {
  const { emplacement, vue, peutEcrire, enDeplacement } = props
  const [action, setAction] = useState<Action | null>(null)
  const occupation = emplacement.occupation
  const dimensions = dimensionsDe(emplacement.largeurCm, emplacement.hauteurCm)
  const statut = emplacement.statut
  const formeOriginale = emplacement.forme !== null && vue === "droite"

  // Une autre forme choisie ferme le formulaire ouvert.
  useEffect(() => {
    setAction(null)
  }, [emplacement.id])

  return (
    <section aria-labelledby="panneau-emplacement-titre" className="flex flex-col gap-5 rounded-lg border border-bordure bg-surface p-4">
      <header className="flex flex-col gap-1">
        <h2 id="panneau-emplacement-titre" className="font-titre text-lg uppercase">
          {emplacement.nom}
        </h2>
        <p className="text-sm text-texte-discret">{TITRE_VUE[emplacement.vue]}</p>
      </header>

      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div className="flex flex-col gap-0.5">
          <dt className="text-texte-discret">Dimensions</dt>
          <dd>{dimensions ?? "Dimensions non renseignées"}</dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-texte-discret">Statut</dt>
          <dd className={`font-medium ${COULEUR_STATUT_EMPLACEMENT[statut]}`}>{LIBELLE_STATUT_EMPLACEMENT[statut]}</dd>
        </div>
        {occupation && (
          <>
            <div className="flex flex-col gap-0.5">
              <dt className="text-texte-discret">Partenaire</dt>
              <dd>{occupation.partenaireNom}</dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-texte-discret">Période</dt>
              <dd>
                {occupation.du || occupation.au
                  ? [occupation.du && `du ${dateLisible(occupation.du)}`, occupation.au && `au ${dateLisible(occupation.au)}`].filter(Boolean).join(" ")
                  : "Sans période"}
              </dd>
            </div>
            {occupation.poseLe && (
              <div className="flex flex-col gap-0.5">
                <dt className="text-texte-discret">Logo posé le</dt>
                <dd>{dateLisible(occupation.poseLe)}</dd>
              </div>
            )}
          </>
        )}
      </dl>

      {(occupation?.logoFileId || occupation?.photoPoseFileId) && (
        <div className="flex flex-wrap gap-4">
          {occupation.logoFileId && (
            <figure className="flex flex-col gap-1 text-xs text-texte-discret">
              <img src={`/api/fichiers/${occupation.logoFileId}`} alt={`Logo de ${occupation.partenaireNom}`} className="h-16 w-auto max-w-40 rounded border border-bordure bg-fond object-contain p-1" />
              <figcaption>Logo</figcaption>
            </figure>
          )}
          {occupation.photoPoseFileId && (
            <figure className="flex flex-col gap-1 text-xs text-texte-discret">
              <img src={`/api/fichiers/${occupation.photoPoseFileId}`} alt="Photo de la pose du logo" className="h-16 w-auto max-w-40 rounded border border-bordure bg-fond object-contain p-1" />
              <figcaption>Photo de pose</figcaption>
            </figure>
          )}
        </div>
      )}

      {!peutEcrire ? null : enDeplacement ? (
        <FormulaireDeplacement {...props} />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-3">
            {statut === "libre" && (
              <>
                <button type="button" className={BOUTON} aria-expanded={action === "reserver"} onClick={() => setAction(action === "reserver" ? null : "reserver")}>
                  Réserver
                </button>
                <FormulaireIndisponible slotId={emplacement.id} indisponible onSucces={() => setAction(null)} />
              </>
            )}
            {statut === "reserve" && occupation && (
              <>
                <button type="button" className={BOUTON} aria-expanded={action === "poser"} onClick={() => setAction(action === "poser" ? null : "poser")}>
                  Marquer le logo posé
                </button>
                <button type="button" className={BOUTON_SECONDAIRE} onClick={() => setAction(action === "annuler" ? null : "annuler")}>
                  Annuler la réservation
                </button>
              </>
            )}
            {statut === "occupe" && occupation && (
              <button type="button" className={BOUTON_SECONDAIRE} onClick={() => setAction(action === "retirer" ? null : "retirer")}>
                Retirer le logo
              </button>
            )}
            {statut === "indisponible" && <FormulaireIndisponible slotId={emplacement.id} indisponible={false} onSucces={() => setAction(null)} />}
          </div>

          {action === "reserver" && <FormulaireReservation slotId={emplacement.id} onSucces={() => setAction(null)} />}
          {action === "poser" && occupation && <FormulairePose assignmentId={occupation.id} onSucces={() => setAction(null)} />}
          {action === "annuler" && occupation && (
            <ConfirmationAction
              action={retirerLogoAction}
              champ={{ nom: "assignmentId", valeur: occupation.id }}
              question={`Annuler la réservation de ${occupation.partenaireNom} ?`}
              libelleBouton="Confirmer l'annulation"
              onFermer={() => setAction(null)}
              onSucces={() => setAction(null)}
            />
          )}
          {action === "retirer" && occupation && (
            <ConfirmationAction
              action={retirerLogoAction}
              champ={{ nom: "assignmentId", valeur: occupation.id }}
              question={`Retirer le logo de ${occupation.partenaireNom} ?`}
              libelleBouton="Confirmer le retrait"
              onFermer={() => setAction(null)}
              onSucces={() => setAction(null)}
            />
          )}

          {formeOriginale && (
            <button type="button" className={BOUTON_SECONDAIRE} onClick={props.onDemarrerDeplacement}>
              Déplacer ou redimensionner
            </button>
          )}
          {emplacement.forme !== null && vue === "gauche" && (
            <p className="text-sm text-texte-discret">Le déplacement se fait côté droit : le côté gauche suit.</p>
          )}

          <details className="rounded-md border border-bordure p-3">
            <summary className="cible-tactile cursor-pointer font-medium">Modifier l'emplacement</summary>
            <FormulaireModifier emplacement={emplacement} />
          </details>

          {!occupation && (
            <ConfirmationAction
              action={supprimerEmplacementAction}
              champ={{ nom: "slotId", valeur: emplacement.id }}
              question={`Supprimer l'emplacement « ${emplacement.nom} » ?`}
              libelleBouton="Supprimer l'emplacement"
              declencheur="Supprimer l'emplacement"
              onFermer={() => setAction(null)}
              onSucces={() => setAction(null)}
              styleDeclencheur="danger"
            />
          )}
        </div>
      )}
    </section>
  )
}

// Ligne d'un formulaire : libellé et champ.
function Champ({ libelle, children }: { libelle: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{libelle}</span>
      {children}
    </label>
  )
}

// Un formulaire, une action : son résultat s'affiche dessous, et il se ferme au succès.
function FormulaireAction({
  action,
  libelleBouton,
  onSucces,
  children,
  desactive,
}: {
  action: (etat: Resultat | null, donnees: FormData) => Promise<Resultat>
  libelleBouton: string
  onSucces?: () => void
  children: ReactNode
  desactive?: boolean
}) {
  const [resultat, envoyer, enCours] = useActionState<Resultat | null, FormData>(action, null)
  useEffect(() => {
    if (resultat?.ok) onSucces?.()
  }, [resultat, onSucces])
  return (
    <form action={envoyer} className="flex flex-col gap-3 rounded-md border border-bordure p-4">
      {children}
      <div className="flex flex-col gap-3">
        <button type="submit" disabled={enCours || desactive} className={`${BOUTON} w-full sm:w-auto`}>
          {libelleBouton}
        </button>
        <Message resultat={resultat} />
      </div>
    </form>
  )
}

function aujourdhui(): string {
  return jourDeParis(new Date())
}

function FormulaireIndisponible({ slotId, indisponible, onSucces }: { slotId: string; indisponible: boolean; onSucces: () => void }) {
  const [resultat, envoyer, enCours] = useActionState<Resultat | null, FormData>(marquerIndisponibleAction, null)
  useEffect(() => {
    if (resultat?.ok) onSucces()
  }, [resultat, onSucces])
  return (
    <form action={envoyer} className="flex flex-col gap-2">
      <input type="hidden" name="slotId" value={slotId} />
      <input type="hidden" name="indisponible" value={indisponible ? "oui" : "non"} />
      <button type="submit" disabled={enCours} className={BOUTON_SECONDAIRE}>
        {indisponible ? "Rendre indisponible" : "Rendre disponible"}
      </button>
      <Message resultat={resultat} />
    </form>
  )
}

function FormulaireReservation({ slotId, onSucces }: { slotId: string; onSucces: () => void }) {
  const [logo, setLogo] = useState<FichierEnvoye | null>(null)
  return (
    <FormulaireAction action={reserverEmplacementAction} libelleBouton="Réserver l'emplacement" onSucces={onSucces}>
      <input type="hidden" name="slotId" value={slotId} />
      <Champ libelle="Partenaire">
        <input name="partenaireNom" required maxLength={120} autoComplete="off" className={CHAMP} />
      </Champ>
      <div className="grid gap-4 sm:grid-cols-2">
        <Champ libelle="Du (facultatif)">
          <input name="du" type="date" className={CHAMP} />
        </Champ>
        <Champ libelle="Au (facultatif)">
          <input name="au" type="date" className={CHAMP} />
        </Champ>
      </div>
      <ChampFichier
        app="voiture"
        accept={ACCEPT_LOGO}
        libelle="Logo (JPEG, PNG, WebP ou SVG)"
        name="logoFileId"
        valeur={logo?.id ?? null}
        typeValeur={logo?.mimeType ?? null}
        nomValeur={logo?.nom ?? null}
        onChange={setLogo}
        libelleRetirer="Retirer le logo"
      />
    </FormulaireAction>
  )
}

function FormulairePose({ assignmentId, onSucces }: { assignmentId: string; onSucces: () => void }) {
  const [photo, setPhoto] = useState<FichierEnvoye | null>(null)
  return (
    <FormulaireAction action={poserLogoAction} libelleBouton="Enregistrer la pose" onSucces={onSucces}>
      <input type="hidden" name="assignmentId" value={assignmentId} />
      <Champ libelle="Date de pose">
        <input name="poseLe" type="date" required defaultValue={aujourdhui()} className={CHAMP} />
      </Champ>
      <ChampFichier
        app="voiture"
        accept={ACCEPT_PHOTO}
        libelle="Photo de la pose (facultatif)"
        name="photoPoseFileId"
        valeur={photo?.id ?? null}
        typeValeur={photo?.mimeType ?? null}
        nomValeur={photo?.nom ?? null}
        onChange={setPhoto}
        libelleRetirer="Retirer la photo"
      />
    </FormulaireAction>
  )
}

// Confirmation affichée sur la page avant une action qui retire ou supprime (brief 3.4, section 2).
function ConfirmationAction({
  action,
  champ,
  question,
  libelleBouton,
  declencheur,
  onFermer,
  onSucces,
  styleDeclencheur,
}: {
  action: (etat: Resultat | null, donnees: FormData) => Promise<Resultat>
  champ: { nom: string; valeur: string }
  question: string
  libelleBouton: string
  declencheur?: string
  onFermer: () => void
  onSucces: () => void
  styleDeclencheur?: "danger"
}) {
  const [ouvert, setOuvert] = useState(declencheur === undefined)
  if (!ouvert) {
    return (
      <button type="button" className={styleDeclencheur === "danger" ? "cible-tactile self-start text-sm font-medium text-etat-rouge underline underline-offset-4" : BOUTON_SECONDAIRE} onClick={() => setOuvert(true)}>
        {declencheur}
      </button>
    )
  }
  return (
    <div role="group" aria-label={question} className="flex flex-col gap-3 rounded-md border border-bordure p-4">
      <p className="font-medium">{question}</p>
      <FormulaireAction action={action} libelleBouton={libelleBouton} onSucces={onSucces}>
        <input type="hidden" name={champ.nom} value={champ.valeur} />
      </FormulaireAction>
      <button type="button" className={`${BOUTON_SECONDAIRE} self-start`} onClick={onFermer}>
        Garder
      </button>
    </div>
  )
}

function FormulaireModifier({ emplacement }: { emplacement: EmplacementPlan }) {
  return (
    <FormulaireAction action={modifierEmplacementAction} libelleBouton="Enregistrer les modifications">
      <input type="hidden" name="slotId" value={emplacement.id} />
      <Champ libelle="Nom">
        <input name="nom" required maxLength={80} defaultValue={emplacement.nom} className={CHAMP} />
      </Champ>
      <div className="grid gap-4 sm:grid-cols-2">
        <Champ libelle="Largeur (cm)">
          <input name="largeurCm" inputMode="numeric" defaultValue={emplacement.largeurCm ?? ""} className={CHAMP} />
        </Champ>
        <Champ libelle="Hauteur (cm)">
          <input name="hauteurCm" inputMode="numeric" defaultValue={emplacement.hauteurCm ?? ""} className={CHAMP} />
        </Champ>
      </div>
      {emplacement.vue === "droite" && (
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" name="symetrique" value="oui" defaultChecked={emplacement.symetrique} className="h-4 w-4" />
          Symétrique à gauche
        </label>
      )}
    </FormulaireAction>
  )
}

// Mode « Déplacer ou redimensionner » : X, Y, Largeur, Hauteur en unités du plan (côté droit). Les champs font la
// même chose que le glissement au pointeur. Un polygone se déplace, il ne se redimensionne pas.
function FormulaireDeplacement(props: PanneauEmplacementProps) {
  const { emplacement, bornes, brouillon, onChangerBrouillon, onFinirDeplacement } = props
  const forme = brouillon ?? emplacement.forme
  if (!forme) return null
  const etendue = etendueDe(forme)
  const polygone = forme.type === "polygone"
  const champ = (nom: "x" | "y" | "l" | "h", valeur: number) => {
    if (!Number.isFinite(valeur)) return
    onChangerBrouillon(formeDuChamp(forme, nom, valeur, bornes))
  }
  const valeur = (n: number) => n.toFixed(1).replace(/\.0$/, "")

  return (
    <div className="flex flex-col gap-4 rounded-md border border-bordure p-4">
      <p className="text-sm text-texte-discret">
        Glisse la forme sur le plan, ou règle-la ici. {polygone ? "Un polygone se déplace, il ne se redimensionne pas." : `Taille minimale : ${COTE_MINIMAL} unités.`}
      </p>
      <div className="grid grid-cols-2 gap-4">
        <Champ libelle="X">
          <input type="number" step={1} value={valeur(etendue.x)} onChange={(e) => champ("x", Number(e.target.value))} className={`${CHAMP} tabular-nums`} />
        </Champ>
        <Champ libelle="Y">
          <input type="number" step={1} value={valeur(etendue.y)} onChange={(e) => champ("y", Number(e.target.value))} className={`${CHAMP} tabular-nums`} />
        </Champ>
        <Champ libelle="Largeur">
          <input type="number" step={1} min={COTE_MINIMAL} value={valeur(etendue.l)} disabled={polygone} onChange={(e) => champ("l", Number(e.target.value))} className={`${CHAMP} tabular-nums`} />
        </Champ>
        <Champ libelle="Hauteur">
          <input type="number" step={1} min={COTE_MINIMAL} value={valeur(etendue.h)} disabled={polygone} onChange={(e) => champ("h", Number(e.target.value))} className={`${CHAMP} tabular-nums`} />
        </Champ>
      </div>
      <FormulaireAction action={enregistrerPositionAction} libelleBouton="Enregistrer la position" onSucces={onFinirDeplacement} desactive={brouillon === null}>
        <input type="hidden" name="slotId" value={emplacement.id} />
        <input type="hidden" name="forme" value={JSON.stringify(forme)} />
      </FormulaireAction>
      <button type="button" className={`${BOUTON_SECONDAIRE} self-start`} onClick={onFinirDeplacement}>
        Annuler
      </button>
    </div>
  )
}
