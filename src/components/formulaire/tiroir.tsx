"use client"

// Tiroirs (brief 3.13, phase A). Une action qui demande une saisie s'ouvre dans un tiroir : sur téléphone il monte du
// bas, sur ordinateur il glisse depuis la droite. Le tiroir ne contient qu'un titre, les champs, puis une barre fixe :
// « Annuler » à gauche, le bouton principal à droite. Fermer une saisie modifiée demande confirmation, dans l'app.

import { useActionState, useEffect, useId, useState, type ReactNode } from "react"

import { avertirAvantSortie } from "@/components/formulaire/avertissement-sortie"
import { Message } from "@/components/formulaire/message"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import type { Resultat } from "@/core/sdk/actions-serveur"
import { BOUTON, BOUTON_DANGER, BOUTON_SECONDAIRE, LIEN } from "@/lib/classes-formulaire"
import { cn } from "@/lib/utils"

export type ActionTiroir = (etat: Resultat | null, donnees: FormData) => Promise<Resultat>

// Bas de l'écran sur téléphone, colonne de 480 px à droite à partir de md (768 px).
const CLASSE_TIROIR =
  "flex max-h-[90vh] flex-col overflow-hidden border-bordure bg-surface p-0 text-texte md:inset-y-0 md:bottom-auto md:left-auto md:right-0 md:top-0 md:h-full md:max-h-none md:w-[480px] md:max-w-[480px] md:border-l md:border-t-0 md:data-[state=closed]:slide-out-to-right md:data-[state=open]:slide-in-from-right"

interface TiroirProps {
  ouvert: boolean
  onOuvertChange: (ouvert: boolean) => void
  titre: string
  // Nom de ce que la saisie concerne, écrit sous le titre (par exemple l'emplacement).
  sousTitre?: string
  // Étape d'un parcours : « ← Retour » revient à l'étape d'avant, « Abandonner » aussi.
  retour?: () => void
  modifie?: boolean
  libelleAnnuler?: string
  principal?: ReactNode
  // Non modal : pas de fond, et un clic sur la page ne ferme pas le tiroir (le plan reste utilisable).
  modal?: boolean
  // Téléphone : hauteur réduite, pour laisser la page visible au-dessus.
  compact?: boolean
  children: ReactNode
}

// Le tiroir seul : titre, contenu qui défile, barre du bas. La garde « Abandonner les modifications ? » est ici.
export function Tiroir({
  ouvert,
  onOuvertChange,
  titre,
  sousTitre,
  retour,
  modifie = false,
  libelleAnnuler = "Annuler",
  principal,
  modal = true,
  compact = false,
  children,
}: TiroirProps) {
  const [demandeAbandon, setDemandeAbandon] = useState(false)

  useEffect(() => {
    if (!ouvert) setDemandeAbandon(false)
  }, [ouvert])

  // Fermer (Échap, fond, croix, Annuler) : une saisie modifiée d'abord demande confirmation.
  function demanderFermeture(suivant: boolean) {
    if (suivant) return onOuvertChange(true)
    if (modifie) return setDemandeAbandon(true)
    onOuvertChange(false)
  }

  // Quitter l'étape (Retour, ou Abandonner) : on revient à l'étape d'avant, sinon on ferme.
  function quitter() {
    if (retour) return retour()
    onOuvertChange(false)
  }

  // Non modal : un clic ou un focus hors du tiroir ne le ferme pas.
  const ignorerClicDehors = (evenement: Event) => {
    if (!modal) evenement.preventDefault()
  }

  return (
    <Sheet open={ouvert} onOpenChange={demanderFermeture} modal={modal}>
      <SheetContent
        side="bottom"
        sansFond={!modal}
        onInteractOutside={ignorerClicDehors}
        className={cn(CLASSE_TIROIR, compact && "max-h-[45vh]")}
      >
        <div className="flex shrink-0 flex-col gap-2 border-b border-bordure p-4 pr-14">
          {retour && (
            <button type="button" onClick={() => (modifie ? setDemandeAbandon(true) : retour())} className={`${LIEN} self-start text-sm`}>
              ← Retour
            </button>
          )}
          <SheetTitle className="text-left text-lg font-semibold">{titre}</SheetTitle>
          {sousTitre && <p className="-mt-1 text-sm text-texte-discret">{sousTitre}</p>}
          <SheetDescription className="sr-only">{titre}</SheetDescription>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">{children}</div>
        <div className="shrink-0 border-t border-bordure p-4">
          {demandeAbandon ? (
            <div className="flex flex-col gap-3">
              <p className="font-medium">Abandonner les modifications ?</p>
              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={() => onOuvertChange(false)} className={BOUTON_DANGER}>
                  Abandonner
                </button>
                <button type="button" onClick={() => setDemandeAbandon(false)} className={BOUTON}>
                  Continuer la saisie
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <button type="button" onClick={() => demanderFermeture(false)} className={BOUTON_SECONDAIRE}>
                {libelleAnnuler}
              </button>
              {principal}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

export interface TiroirFormulaireProps {
  ouvert: boolean
  onOuvertChange: (ouvert: boolean) => void
  titre: string
  sousTitre?: string
  action: ActionTiroir
  libelleBouton: string
  libelleEnCours?: string
  libelleAnnuler?: string
  danger?: boolean
  // Phrase qui dit ce qui va se passer (tiroir de confirmation).
  question?: string
  retour?: () => void
  // Modifié hors formulaire (par exemple un glissement sur le plan) : la garde s'applique quand même.
  modifie?: boolean
  // Bouton principal désactivé (par exemple tant qu'une photo part).
  desactive?: boolean
  modal?: boolean
  compact?: boolean
  onSucces?: (resultat: Extract<Resultat, { ok: true }>) => void
  children: ReactNode
}

// Un formulaire dans un tiroir. Le formulaire est remonté à chaque ouverture : son message ne reste pas d'une fois sur l'autre.
export function TiroirFormulaire(props: TiroirFormulaireProps) {
  const [session, setSession] = useState(0)
  const [etaitOuvert, setEtaitOuvert] = useState(props.ouvert)
  if (props.ouvert !== etaitOuvert) {
    setEtaitOuvert(props.ouvert)
    if (props.ouvert) setSession((s) => s + 1)
  }
  return <FormulaireTiroir key={session} {...props} />
}

function FormulaireTiroir({
  ouvert,
  onOuvertChange,
  titre,
  sousTitre,
  action,
  libelleBouton,
  libelleEnCours,
  libelleAnnuler,
  danger = false,
  question,
  retour,
  modifie: modifieDehors = false,
  desactive = false,
  modal,
  compact,
  onSucces,
  children,
}: TiroirFormulaireProps) {
  const identifiant = useId()
  const [etat, envoyer, enCours] = useActionState(action, null)
  const [modifieDedans, setModifieDedans] = useState(false)

  // Réussite : le tiroir se ferme, et la page affiche la nouvelle valeur (revalidation côté serveur).
  useEffect(() => {
    if (!etat?.ok) return
    onSucces?.(etat)
    setModifieDedans(false)
    onOuvertChange(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seule la réponse du serveur déclenche la fermeture.
  }, [etat])

  // Un envoi en cours (server action) est coupé par un rechargement ou une sortie de page : on le dit avant (brief 4.7).
  useEffect(() => {
    if (!enCours) return
    const avantSortie = (evenement: BeforeUnloadEvent) => avertirAvantSortie(evenement, true)
    window.addEventListener("beforeunload", avantSortie)
    return () => window.removeEventListener("beforeunload", avantSortie)
  }, [enCours])

  return (
    <Tiroir
      ouvert={ouvert}
      onOuvertChange={onOuvertChange}
      titre={titre}
      sousTitre={sousTitre}
      retour={retour}
      modifie={modifieDedans || modifieDehors}
      libelleAnnuler={libelleAnnuler}
      modal={modal}
      compact={compact}
      principal={
        <button type="submit" form={identifiant} disabled={enCours || desactive} className={danger ? BOUTON_DANGER : BOUTON}>
          {enCours ? (libelleEnCours ?? "Envoi…") : libelleBouton}
        </button>
      }
    >
      <form id={identifiant} action={envoyer} onChange={() => setModifieDedans(true)} className="flex flex-col gap-4" aria-label={titre}>
        {question && <p className="text-sm">{question}</p>}
        {children}
        <Message resultat={etat} />
      </form>
    </Tiroir>
  )
}

// Un bouton de la page qui ouvre son tiroir de saisie. Les boutons sans saisie restent des boutons de la page.
export function TiroirAction({
  libelle,
  secondaire = true,
  ...reste
}: Omit<TiroirFormulaireProps, "ouvert" | "onOuvertChange"> & { libelle: string; secondaire?: boolean }) {
  const [ouvert, setOuvert] = useState(false)
  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => setOuvert(true)}
        className={reste.danger ? BOUTON_DANGER : secondaire ? BOUTON_SECONDAIRE : BOUTON}
      >
        {libelle}
      </button>
      <TiroirFormulaire ouvert={ouvert} onOuvertChange={setOuvert} {...reste} />
    </>
  )
}
