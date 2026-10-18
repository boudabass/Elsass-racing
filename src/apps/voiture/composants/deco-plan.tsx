"use client"

// Onglet Déco (brief 3.4) : le plan, la légende, la liste des emplacements et le panneau de l'emplacement choisi.
// Le plan et la liste ne servent pas seuls : la liste est la commande principale, et les deux restent synchronisés
// sur l'emplacement choisi. Sur téléphone, le panneau s'ouvre en tiroir par le bas.

import { Suspense, useActionState, useEffect, useMemo, useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import type { Resultat } from "@/core/sdk/actions-serveur"
import { BOUTON_SECONDAIRE } from "@/lib/classes-formulaire"

import type { FormeEmplacement, Gabarit } from "../gabarits/types"
import { ajouterEmplacementAction } from "../actions"
import { COULEUR_STATUT_EMPLACEMENT, LIBELLE_STATUT_EMPLACEMENT, TITRE_VUE } from "../libelles"
import {
  bornesDu,
  comptesDeStatuts,
  emplacementsDeLaListe,
  emplacementsDessines,
  formeAuCentre,
  libelleComptes,
  type Bornes,
  type EmplacementPlan,
  type VuePlan,
} from "../plan"
import { PlanVehicule } from "./plan-vehicule"
import { PanneauEmplacement } from "./deco-panneau"

// Vide : un véhicule sans gabarit n'a pas de plan, donc pas de déplacement.
const BORNES_VIDES: Bornes = { x: 0, y: 0, l: 0, h: 0 }
const LARGEUR_ORDINATEUR = "(min-width: 768px)"

export interface DecoPlanProps {
  ficheId: string
  nomVehicule: string
  gabarit: Gabarit | null
  emplacements: EmplacementPlan[]
  peutEcrire: boolean
}

export function DecoPlan(props: DecoPlanProps) {
  return (
    <Suspense fallback={null}>
      <DecoInteractif {...props} />
    </Suspense>
  )
}

function DecoInteractif({ ficheId, nomVehicule, gabarit, emplacements, peutEcrire }: DecoPlanProps) {
  const router = useRouter()
  const chemin = usePathname()
  const parametres = useSearchParams()
  const bornes = gabarit ? bornesDu(gabarit.viewBox) : BORNES_VIDES
  const aCote = gabarit?.vuesDessinees.some((v) => v.vue === "gauche") ?? false
  const vue: VuePlan = aCote && parametres.get("vue") === "gauche" ? "gauche" : "droite"

  const [choisi, setChoisi] = useState<string | null>(null)
  const [enDeplacement, setEnDeplacement] = useState(false)
  const [brouillon, setBrouillon] = useState<FormeEmplacement | null>(null)
  const [ordinateur, setOrdinateur] = useState(true)

  useEffect(() => {
    const media = window.matchMedia(LARGEUR_ORDINATEUR)
    const majer = () => setOrdinateur(media.matches)
    majer()
    media.addEventListener("change", majer)
    return () => media.removeEventListener("change", majer)
  }, [])

  const dessines = useMemo(() => emplacementsDessines(emplacements, vue), [emplacements, vue])
  const { horsPlan } = useMemo(() => emplacementsDeLaListe(emplacements, vue), [emplacements, vue])
  const comptes = useMemo(() => comptesDeStatuts(dessines.map((e) => e.statut)), [dessines])

  // L'emplacement choisi n'est affiché que s'il est dans la vue : un bandeau de pare-brise disparaît côté gauche.
  const visible = useMemo(
    () => emplacements.find((e) => e.id === choisi && (dessines.some((d) => d.id === e.id) || horsPlan.some((h) => h.id === e.id))) ?? null,
    [emplacements, choisi, dessines, horsPlan],
  )
  const enDeplacementVisible = enDeplacement && visible !== null && vue === "droite" && visible.forme !== null

  function choisir(id: string) {
    setChoisi(id)
    setEnDeplacement(false)
    setBrouillon(null)
  }

  function fermerPanneau() {
    setChoisi(null)
    setEnDeplacement(false)
    setBrouillon(null)
  }

  function changerVue(nouvelle: VuePlan) {
    const p = new URLSearchParams(parametres.toString())
    p.set("vue", nouvelle)
    router.replace(`${chemin}?${p.toString()}`, { scroll: false })
    setEnDeplacement(false)
    setBrouillon(null)
  }

  function demarrerDeplacement() {
    if (!visible?.forme) return
    setEnDeplacement(true)
    setBrouillon(visible.forme)
  }

  function finirDeplacement() {
    setEnDeplacement(false)
    setBrouillon(null)
  }

  // Un ajout : l'emplacement créé est choisi. Un ajout au côté gauche part du côté droit, où il est stocké : on y bascule.
  function ajoute(id: string) {
    choisir(id)
    if (vue === "gauche") changerVue("droite")
  }

  const panneau = visible && (
    <PanneauEmplacement
      key={visible.id}
      emplacement={visible}
      vue={vue}
      peutEcrire={peutEcrire}
      bornes={bornes}
      enDeplacement={enDeplacementVisible}
      brouillon={enDeplacementVisible ? brouillon : null}
      onDemarrerDeplacement={demarrerDeplacement}
      onChangerBrouillon={setBrouillon}
      onFinirDeplacement={finirDeplacement}
    />
  )

  return (
    <div className="flex flex-col gap-6">
      {aCote && (
        <div role="group" aria-label="Côté du véhicule" className="inline-flex w-fit overflow-hidden rounded-md border border-bordure">
          {(["droite", "gauche"] as const).map((cote) => (
            <button
              key={cote}
              type="button"
              aria-pressed={vue === cote}
              onClick={() => changerVue(cote)}
              className={`cible-tactile px-4 text-sm ${vue === cote ? "bg-surface-2 font-medium text-texte" : "text-texte-discret"}`}
            >
              {TITRE_VUE[cote]}
            </button>
          ))}
        </div>
      )}

      {gabarit && (
        <>
          <PlanVehicule
            nomVehicule={nomVehicule}
            gabarit={gabarit}
            vue={vue}
            emplacements={dessines}
            choisi={visible?.id ?? null}
            onChoisir={choisir}
            deplacement={enDeplacementVisible && visible && brouillon ? { id: visible.id, forme: brouillon, onChange: setBrouillon } : null}
          />
          <p className="text-sm text-texte-discret">{libelleComptes(comptes)}</p>
          {peutEcrire && (
            <AjouterEmplacement ficheId={ficheId} vue="droite" forme={formeAuCentre(bornes)} libelle="Ajouter un emplacement" onAjoute={ajoute} />
          )}
        </>
      )}

      <section aria-labelledby="liste-emplacements" className="flex flex-col gap-4">
        <h2 id="liste-emplacements" className="sr-only">
          Emplacements
        </h2>
        {emplacements.length === 0 && <p className="text-texte-discret">Aucun emplacement défini pour ce véhicule.</p>}
        {dessines.length > 0 && (
          <ListeEmplacements emplacements={dessines} choisi={visible?.id ?? null} onChoisir={choisir} />
        )}
        {(horsPlan.length > 0 || peutEcrire) && (
          <section aria-labelledby="autres-emplacements" className="flex flex-col gap-2">
            <h3 id="autres-emplacements" className="font-titre text-lg uppercase">
              {TITRE_VUE.hors_plan}
            </h3>
            {horsPlan.length > 0 && <ListeEmplacements emplacements={horsPlan} choisi={visible?.id ?? null} onChoisir={choisir} />}
            {peutEcrire && <AjouterEmplacement ficheId={ficheId} vue="hors_plan" forme={null} libelle="Ajouter sans forme" onAjoute={ajoute} />}
          </section>
        )}
      </section>

      {visible && ordinateur && panneau}

      {!ordinateur && (
        <Sheet open={visible !== null} onOpenChange={(ouvert) => !ouvert && fermerPanneau()}>
          <SheetContent side="bottom" className="flex max-h-[85vh] flex-col overflow-hidden border-bordure bg-surface text-texte">
            {/* En-tête fixe : le nom et la fermeture restent visibles, le contenu seul défile. */}
            <SheetHeader className="shrink-0">
              <SheetTitle className="pr-10 text-left">{visible?.nom ?? "Emplacement"}</SheetTitle>
              <SheetDescription className="sr-only">Détails de l'emplacement choisi et actions disponibles.</SheetDescription>
            </SheetHeader>
            <div className="min-h-0 flex-1 overflow-y-auto">{panneau}</div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  )
}

// Liste des emplacements d'une vue : un bouton de 44 px au moins par ligne, avec le statut écrit et le partenaire.
function ListeEmplacements({
  emplacements,
  choisi,
  onChoisir,
}: {
  emplacements: EmplacementPlan[]
  choisi: string | null
  onChoisir: (id: string) => void
}) {
  return (
    <ul className="flex flex-col divide-y divide-bordure rounded-lg border border-bordure">
      {emplacements.map((emplacement) => {
        const partenaire = emplacement.occupation?.partenaireNom
        return (
          <li key={emplacement.id}>
            <button
              type="button"
              aria-pressed={choisi === emplacement.id}
              onClick={() => onChoisir(emplacement.id)}
              className={`cible-tactile flex min-h-11 w-full items-center gap-3 px-3 py-2 text-left hover:bg-surface-2 ${choisi === emplacement.id ? "bg-surface-2" : ""}`}
            >
              <IndicateurStatut statut={emplacement.statut} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-medium">{emplacement.nom}</span>
                <span className={`text-sm ${COULEUR_STATUT_EMPLACEMENT[emplacement.statut]}`}>
                  {LIBELLE_STATUT_EMPLACEMENT[emplacement.statut]}
                  {partenaire ? ` · ${partenaire}` : ""}
                </span>
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

// Carré de statut dans la liste : la forme se lit aussi sans couleur (contour, fond).
function IndicateurStatut({ statut }: { statut: EmplacementPlan["statut"] }) {
  const classe: Record<EmplacementPlan["statut"], string> = {
    libre: "border-2 border-dashed border-marque",
    reserve: "border-2 border-marque bg-marque/15",
    occupe: "border-2 border-texte bg-texte/20",
    indisponible: "border-2 border-texte-discret bg-[repeating-linear-gradient(45deg,var(--bordure)_0_3px,transparent_3px_6px)]",
  }
  return <span aria-hidden="true" className={`block h-5 w-5 shrink-0 rounded-sm ${classe[statut]}`} />
}

// Ajout d'un emplacement : le service le crée, la page le choisit au retour.
function AjouterEmplacement({
  ficheId,
  vue,
  forme,
  libelle,
  onAjoute,
}: {
  ficheId: string
  vue: "droite" | "hors_plan"
  forme: FormeEmplacement | null
  libelle: string
  onAjoute: (id: string) => void
}) {
  const [resultat, envoyer, enCours] = useActionState<Resultat | null, FormData>(ajouterEmplacementAction, null)
  const surAjout = useRef(onAjoute)
  surAjout.current = onAjoute
  useEffect(() => {
    if (resultat?.ok && resultat.id) surAjout.current(resultat.id)
  }, [resultat])

  return (
    <form action={envoyer} className="flex flex-col gap-2">
      <input type="hidden" name="vehicleId" value={ficheId} />
      <input type="hidden" name="nom" value="Nouvel emplacement" />
      <input type="hidden" name="vue" value={vue} />
      {forme && <input type="hidden" name="forme" value={JSON.stringify(forme)} />}
      <button type="submit" disabled={enCours} className={`${BOUTON_SECONDAIRE} w-full sm:w-auto sm:self-start`}>
        {libelle}
      </button>
      {resultat && !resultat.ok && (
        <p role="alert" className="text-sm text-etat-rouge">
          {resultat.message}
        </p>
      )}
    </form>
  )
}
