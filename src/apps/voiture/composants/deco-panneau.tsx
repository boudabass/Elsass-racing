"use client"

// Tiroir de l'emplacement choisi (brief 3.4, brief 3.13 phase A). Le tiroir montre la fiche de l'emplacement, puis ses
// actions. Une action qui demande une saisie ouvre une étape du même tiroir : « ← Retour » revient à la fiche. Chaque
// étape est un formulaire vers une Server Action de actions.ts. Sur téléphone le tiroir monte du bas ; sur ordinateur il
// glisse depuis la droite, et le plan reste utilisable à côté. Sous le niveau écriture, la fiche reste en lecture seule.
// Les actions sans saisie (rendre indisponible) restent des boutons de la fiche.

import { useActionState, useState, type ReactNode } from "react"

import { ChampFichier, type FichierEnvoye } from "@/components/formulaire/champ-fichier"
import { Message } from "@/components/formulaire/message"
import { Tiroir, TiroirFormulaire, type TiroirFormulaireProps } from "@/components/formulaire/tiroir"
import type { PartenaireReservable } from "@/apps/partenaires/lectures-partagees"

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

// Les étapes du tiroir : chacune est une saisie (ou une confirmation) qui revient à la fiche.
export type EtapeEmplacement = "reserver" | "poser" | "annuler" | "retirer" | "modifier" | "position" | "supprimer"

interface TiroirEmplacementProps {
  emplacement: EmplacementPlan
  vue: VuePlan
  peutEcrire: boolean
  partenaires: PartenaireReservable[]
  bornes: Bornes
  // L'étape ouverte ; null pour la fiche.
  etape: EtapeEmplacement | null
  // Sur ordinateur, le tiroir est non modal : le plan reste cliquable (un autre emplacement se choisit sur le plan).
  ordinateur: boolean
  // Mode « Déplacer ou redimensionner » : la forme en cours d'édition, et ses changements.
  brouillon: FormeEmplacement | null
  onEtape: (etape: EtapeEmplacement | null) => void
  onChangerBrouillon: (forme: FormeEmplacement) => void
  onFermer: () => void
}

function dateLisible(jour: string | null): string | null {
  return jour ? dateEnToutesLettres(new Date(`${jour}T00:00:00Z`)) : null
}

export function TiroirEmplacement(props: TiroirEmplacementProps) {
  const { emplacement, etape, ordinateur, brouillon, bornes, onEtape, onChangerBrouillon, onFermer, partenaires } = props
  const modal = !ordinateur
  const occupation = emplacement.occupation

  const fiche = (
    <Tiroir
      ouvert
      onOuvertChange={(suivant) => {
        if (!suivant) onFermer()
      }}
      titre={emplacement.nom}
      libelleAnnuler="Fermer"
      modal={modal}
    >
      <PanneauEmplacement emplacement={emplacement} vue={props.vue} peutEcrire={props.peutEcrire} onEtape={onEtape} />
    </Tiroir>
  )
  if (etape === null) return fiche

  const retour = () => onEtape(null)
  const commun = { emplacement, retour, modal }
  switch (etape) {
    case "reserver":
      return <EtapeReserver {...commun} partenaires={partenaires} />
    case "poser":
      return occupation ? <EtapePose {...commun} assignmentId={occupation.id} /> : fiche
    case "annuler":
      return occupation ? (
        <EtapeConfirmation
          {...commun}
          titre="Annuler la réservation"
          question={`Annuler la réservation de ${occupation.partenaireNom} ?`}
          libelleBouton="Confirmer l'annulation"
          action={retirerLogoAction}
          champ={{ nom: "assignmentId", valeur: occupation.id }}
        />
      ) : (
        fiche
      )
    case "retirer":
      return occupation ? (
        <EtapeConfirmation
          {...commun}
          titre="Retirer le logo"
          question={`Retirer le logo de ${occupation.partenaireNom} ?`}
          libelleBouton="Confirmer le retrait"
          action={retirerLogoAction}
          champ={{ nom: "assignmentId", valeur: occupation.id }}
        />
      ) : (
        fiche
      )
    case "modifier":
      return <EtapeModifier {...commun} />
    case "supprimer":
      return emplacement.occupation ? (
        fiche
      ) : (
        <EtapeConfirmation
          {...commun}
          titre="Supprimer l'emplacement"
          question={`Supprimer l'emplacement « ${emplacement.nom} » ?`}
          libelleBouton="Supprimer l'emplacement"
          action={supprimerEmplacementAction}
          champ={{ nom: "slotId", valeur: emplacement.id }}
        />
      )
    case "position":
      // Non modal sur tous les écrans : le glissement sur le plan doit rester possible.
      return emplacement.forme && brouillon ? (
        <EtapePosition
          emplacement={emplacement}
          retour={retour}
          bornes={bornes}
          brouillon={brouillon}
          onChangerBrouillon={onChangerBrouillon}
          compact={!ordinateur}
        />
      ) : (
        fiche
      )
  }
}

// La fiche : les dimensions, le statut, le partenaire, les images, puis les actions.
function PanneauEmplacement({
  emplacement,
  vue,
  peutEcrire,
  onEtape,
}: {
  emplacement: EmplacementPlan
  vue: VuePlan
  peutEcrire: boolean
  onEtape: (etape: EtapeEmplacement) => void
}) {
  const occupation = emplacement.occupation
  const dimensions = dimensionsDe(emplacement.largeurCm, emplacement.hauteurCm)
  const statut = emplacement.statut
  const formeOriginale = emplacement.forme !== null && vue === "droite"

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-texte-discret">{TITRE_VUE[emplacement.vue]}</p>

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
              <img src={`/api/fichiers/${occupation.logoFileId}`} alt={`Logo de ${occupation.partenaireNom}`} width={160} height={64} loading="lazy" decoding="async" className="h-16 w-auto max-w-40 rounded border border-bordure bg-fond object-contain p-1" />
              <figcaption>Logo</figcaption>
            </figure>
          )}
          {occupation.photoPoseFileId && (
            <figure className="flex flex-col gap-1 text-xs text-texte-discret">
              <img src={`/api/fichiers/${occupation.photoPoseFileId}`} alt="Photo de la pose du logo" width={160} height={64} loading="lazy" decoding="async" className="h-16 w-auto max-w-40 rounded border border-bordure bg-fond object-contain p-1" />
              <figcaption>Photo de pose</figcaption>
            </figure>
          )}
        </div>
      )}

      {peutEcrire && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-3">
            {statut === "libre" && (
              <>
                <button type="button" className={BOUTON} aria-haspopup="dialog" onClick={() => onEtape("reserver")}>
                  Réserver
                </button>
                <FormulaireIndisponible slotId={emplacement.id} indisponible />
              </>
            )}
            {statut === "reserve" && occupation && (
              <>
                <button type="button" className={BOUTON} aria-haspopup="dialog" onClick={() => onEtape("poser")}>
                  Marquer le logo posé
                </button>
                <button type="button" className={BOUTON_SECONDAIRE} aria-haspopup="dialog" onClick={() => onEtape("annuler")}>
                  Annuler la réservation
                </button>
              </>
            )}
            {statut === "occupe" && occupation && (
              <button type="button" className={BOUTON_SECONDAIRE} aria-haspopup="dialog" onClick={() => onEtape("retirer")}>
                Retirer le logo
              </button>
            )}
            {statut === "indisponible" && <FormulaireIndisponible slotId={emplacement.id} indisponible={false} />}
          </div>

          {formeOriginale && (
            <button type="button" className={`${BOUTON_SECONDAIRE} w-full sm:w-auto sm:self-start`} aria-haspopup="dialog" onClick={() => onEtape("position")}>
              Déplacer ou redimensionner
            </button>
          )}
          {emplacement.forme !== null && vue === "gauche" && (
            <p className="text-sm text-texte-discret">Le déplacement se fait côté droit : le côté gauche suit.</p>
          )}

          <button type="button" className={`${BOUTON_SECONDAIRE} w-full sm:w-auto sm:self-start`} aria-haspopup="dialog" onClick={() => onEtape("modifier")}>
            Modifier l'emplacement
          </button>

          {!occupation && (
            <button
              type="button"
              aria-haspopup="dialog"
              className="cible-tactile self-start text-sm font-medium text-etat-rouge underline underline-offset-4"
              onClick={() => onEtape("supprimer")}
            >
              Supprimer l'emplacement
            </button>
          )}
        </div>
      )}
    </div>
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

function aujourdhui(): string {
  return jourDeParis(new Date())
}

// Une étape du tiroir : un formulaire, « ← Retour » et la fermeture reviennent à la fiche.
type EtapeProps = Omit<TiroirFormulaireProps, "ouvert" | "onOuvertChange" | "retour"> & { retour: () => void }

function Etape({ retour, ...reste }: EtapeProps) {
  return <TiroirFormulaire {...reste} ouvert onOuvertChange={(suivant) => !suivant && retour()} retour={retour} />
}

// Ce que reçoivent toutes les étapes : l'emplacement, le retour à la fiche, et la modalité du tiroir.
interface EtapeCommune {
  emplacement: EmplacementPlan
  retour: () => void
  modal: boolean
}

function FormulaireIndisponible({ slotId, indisponible }: { slotId: string; indisponible: boolean }) {
  const [resultat, envoyer, enCours] = useActionState<Resultat | null, FormData>(marquerIndisponibleAction, null)
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

// Un partenaire de la liste (convention signée ou en cours) : ses dates et son logo viennent de sa convention. « Autre »
// (valeur vide) : un nom libre, pour un sponsor hors app. Brief 3.11, §3.
function EtapeReserver({ emplacement, retour, modal, partenaires }: EtapeCommune & { partenaires: PartenaireReservable[] }) {
  const [logo, setLogo] = useState<FichierEnvoye | null>(null)
  const [choix, setChoix] = useState(partenaires[0]?.id ?? "")
  const partenaireChoisi = choix !== ""
  return (
    <Etape
      titre="Réserver"
      sousTitre={emplacement.nom}
      action={reserverEmplacementAction}
      libelleBouton="Réserver l'emplacement"
      libelleEnCours="Réservation…"
      retour={retour}
      modal={modal}
    >
      <input type="hidden" name="slotId" value={emplacement.id} />
      <Champ libelle="Partenaire">
        <select id="reservation-partenaire" name="partenaireId" value={choix} onChange={(evenement) => setChoix(evenement.target.value)} className={CHAMP}>
          {partenaires.map((partenaire) => (
            <option key={partenaire.id} value={partenaire.id}>
              {partenaire.nom}
            </option>
          ))}
          <option value="">Autre (hors app)</option>
        </select>
      </Champ>
      {!partenaireChoisi && (
        <>
          <Champ libelle="Nom du sponsor">
            <input id="reservation-nom" name="partenaireNom" required maxLength={120} autoComplete="off" className={CHAMP} />
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
        </>
      )}
    </Etape>
  )
}

function EtapePose({ emplacement, retour, modal, assignmentId }: EtapeCommune & { assignmentId: string }) {
  const [photo, setPhoto] = useState<FichierEnvoye | null>(null)
  // Tant que la photo part, on ne peut pas enregistrer : sans elle, la pose serait enregistrée sans photo.
  const [envoiPhoto, setEnvoiPhoto] = useState(false)
  return (
    <Etape
      titre="Marquer le logo posé"
      sousTitre={emplacement.nom}
      action={poserLogoAction}
      libelleBouton={envoiPhoto ? "Envoi de la photo…" : "Enregistrer la pose"}
      libelleEnCours="Enregistrement…"
      desactive={envoiPhoto}
      retour={retour}
      modal={modal}
    >
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
        onEnvoi={setEnvoiPhoto}
        libelleRetirer="Retirer la photo"
      />
    </Etape>
  )
}

// Confirmation avant une action qui retire ou supprime (brief 3.4, section 2) : la question dit ce qui va se passer.
function EtapeConfirmation({
  emplacement,
  retour,
  modal,
  titre,
  question,
  libelleBouton,
  action,
  champ,
}: EtapeCommune & {
  titre: string
  question: string
  libelleBouton: string
  action: TiroirFormulaireProps["action"]
  champ: { nom: string; valeur: string }
}) {
  return (
    <Etape titre={titre} sousTitre={emplacement.nom} action={action} libelleBouton={libelleBouton} libelleEnCours="Envoi…" danger question={question} retour={retour} modal={modal}>
      <input type="hidden" name={champ.nom} value={champ.valeur} />
    </Etape>
  )
}

function EtapeModifier({ emplacement, retour, modal }: EtapeCommune) {
  return (
    <Etape
      titre="Modifier l'emplacement"
      sousTitre={emplacement.nom}
      action={modifierEmplacementAction}
      libelleBouton="Enregistrer les modifications"
      retour={retour}
      modal={modal}
    >
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
    </Etape>
  )
}

// Mode « Déplacer ou redimensionner » : X, Y, Largeur, Hauteur en unités du plan (côté droit). Les champs font la
// même chose que le glissement au pointeur. Un polygone se déplace, il ne se redimensionne pas. Le tiroir reste non
// modal : le plan se glisse pendant l'étape. Enregistrer, Annuler et « ← Retour » reviennent à la fiche.
function EtapePosition({
  emplacement,
  retour,
  bornes,
  brouillon,
  onChangerBrouillon,
  compact,
}: {
  emplacement: EmplacementPlan
  retour: () => void
  bornes: Bornes
  brouillon: FormeEmplacement
  onChangerBrouillon: (forme: FormeEmplacement) => void
  compact: boolean
}) {
  // Texte tapé dans un champ, le temps qu'il a le focus : un champ vidé reste vide sans envoyer la forme à 0.
  const [saisies, setSaisies] = useState<Partial<Record<"x" | "y" | "l" | "h", string>>>({})
  const forme = brouillon
  const etendue = etendueDe(forme)
  const polygone = forme.type === "polygone"
  const champ = (nom: "x" | "y" | "l" | "h", brut: string) => {
    setSaisies((s) => ({ ...s, [nom]: brut }))
    if (brut.trim() === "") return
    const nombre = Number(brut)
    if (!Number.isFinite(nombre)) return
    onChangerBrouillon(formeDuChamp(forme, nom, nombre, bornes))
  }
  const oublier = (nom: "x" | "y" | "l" | "h") => setSaisies((s) => ({ ...s, [nom]: undefined }))
  const valeur = (n: number) => n.toFixed(1).replace(/\.0$/, "")
  const affiche = (nom: "x" | "y" | "l" | "h", n: number) => saisies[nom] ?? valeur(n)

  return (
    <TiroirFormulaire
      ouvert
      onOuvertChange={(suivant) => !suivant && retour()}
      retour={retour}
      titre="Déplacer ou redimensionner"
      sousTitre={emplacement.nom}
      action={enregistrerPositionAction}
      libelleBouton="Enregistrer la position"
      libelleEnCours="Enregistrement…"
      modifie={brouillon !== emplacement.forme}
      modal={false}
      compact={compact}
    >
      <input type="hidden" name="slotId" value={emplacement.id} />
      <input type="hidden" name="forme" value={JSON.stringify(forme)} />
      <p className="text-sm text-texte-discret">
        Glisse la forme sur le plan, ou règle-la ici. {polygone ? "Un polygone se déplace, il ne se redimensionne pas." : `Taille minimale : ${COTE_MINIMAL} unités.`}
      </p>
      <div className="grid grid-cols-2 gap-4">
        <Champ libelle="X">
          <input type="number" step="any" value={affiche("x", etendue.x)} onChange={(e) => champ("x", e.target.value)} onBlur={() => oublier("x")} className={`${CHAMP} tabular-nums`} />
        </Champ>
        <Champ libelle="Y">
          <input type="number" step="any" value={affiche("y", etendue.y)} onChange={(e) => champ("y", e.target.value)} onBlur={() => oublier("y")} className={`${CHAMP} tabular-nums`} />
        </Champ>
        <Champ libelle="Largeur">
          <input type="number" step="any" min={COTE_MINIMAL} value={affiche("l", etendue.l)} disabled={polygone} onChange={(e) => champ("l", e.target.value)} onBlur={() => oublier("l")} className={`${CHAMP} tabular-nums`} />
        </Champ>
        <Champ libelle="Hauteur">
          <input type="number" step="any" min={COTE_MINIMAL} value={affiche("h", etendue.h)} disabled={polygone} onChange={(e) => champ("h", e.target.value)} onBlur={() => oublier("h")} className={`${CHAMP} tabular-nums`} />
        </Champ>
      </div>
    </TiroirFormulaire>
  )
}
