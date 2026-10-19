"use client"

// Onglet Déco (brief 3.4) : le plan, la légende, la liste des emplacements et le panneau de l'emplacement choisi.
// Le plan et la liste ne servent pas seuls : la liste est la commande principale, et les deux restent synchronisés
// sur l'emplacement choisi. Le panneau est un tiroir : par le bas sur téléphone, depuis la droite sur ordinateur (brief 3.13).

import { Suspense, useActionState, useEffect, useMemo, useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import type { Resultat } from "@/core/sdk/actions-serveur"
import type { PartenaireReservable } from "@/apps/partenaires/lectures-partagees"
import { BOUTON, BOUTON_SECONDAIRE, CHAMP } from "@/lib/classes-formulaire"

import { CLE_GABARIT_GENERIQUE, GABARITS } from "../gabarits"
import type { FormeEmplacement, Gabarit } from "../gabarits/types"
import { ajouterEmplacementAction, choisirGabaritAction, completerGabaritAction, type ResultatComplement } from "../actions"
import { COULEUR_STATUT_EMPLACEMENT, LIBELLE_STATUT_EMPLACEMENT, TITRE_VUE } from "../libelles"
import {
  bornesDu,
  comptesDeStatuts,
  emplacementsDessines,
  formeAuCentre,
  libelleComptes,
  type Bornes,
  type EmplacementPlan,
  type VuePlan,
} from "../plan"
import { PlanVehicule } from "./plan-vehicule"
import { BarrePosition, HAUTEUR_BARRE_POSITION, TiroirEmplacement, type EtapeEmplacement } from "./deco-panneau"

// Vide : un véhicule sans gabarit n'a pas de plan, donc pas de déplacement.
const BORNES_VIDES: Bornes = { x: 0, y: 0, l: 0, h: 0 }
const LARGEUR_ORDINATEUR = "(min-width: 768px)"

export interface DecoPlanProps {
  // Ce que « Mettre le plan à jour » fera, en phrase. Vide : rien à faire, le bouton n'apparaît pas.
  complement: string
  ficheId: string
  nomVehicule: string
  gabarit: Gabarit | null
  emplacements: EmplacementPlan[]
  peutEcrire: boolean
  partenaires: PartenaireReservable[]
}

export function DecoPlan(props: DecoPlanProps) {
  return (
    <Suspense fallback={null}>
      <DecoInteractif {...props} />
    </Suspense>
  )
}

function DecoInteractif({ ficheId, nomVehicule, gabarit, emplacements, peutEcrire, partenaires, complement }: DecoPlanProps) {
  const router = useRouter()
  const chemin = usePathname()
  const parametres = useSearchParams()
  const bornes = gabarit ? bornesDu(gabarit.viewBox) : BORNES_VIDES
  // Les vues proposées sont celles que le gabarit dessine (droite, gauche, avant, arrière, dessus).
  const vuesDessinees: VuePlan[] = (gabarit?.vuesDessinees ?? []).map((v) => v.vue).filter((v): v is VuePlan => v !== "hors_plan")
  const vue: VuePlan = vuesDessinees.find((v) => v === parametres.get("vue")) ?? "droite"

  const [choisi, setChoisi] = useState<string | null>(null)
  const [etape, setEtape] = useState<EtapeEmplacement | null>(null)
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
  const comptes = useMemo(() => comptesDeStatuts(dessines.map((e) => e.statut)), [dessines])

  // L'emplacement choisi n'est affiché que s'il est dans la vue : un bandeau de pare-brise disparaît côté gauche.
  const visible = useMemo(
    () => emplacements.find((e) => e.id === choisi && dessines.some((d) => d.id === e.id)) ?? null,
    [emplacements, choisi, dessines],
  )
  // Le glissement sur le plan ne vaut que pour l'étape « position », côté droit, sur une forme.
  const enDeplacementVisible = etape === "position" && visible !== null && visible.forme !== null
  // Pendant « Déplacer ou redimensionner », seul le logo en cours bouge : le reste de la page (côtés, ajout, liste) est inerte.
  const inerte = etape === "position" ? true : undefined
  // Sur téléphone, cette étape se fait sur une barre fixe en bas, sans tiroir : le plan reste visible et actif.
  const enBarre = enDeplacementVisible && !ordinateur && brouillon !== null

  // La forme en déplacement reste au-dessus de la barre : au départ, puis à chaque relâchement du doigt ou de la souris.
  useEffect(() => {
    if (!enBarre) return
    const garder = () => {
      const forme = document.querySelector<SVGElement>('[data-deplacement="oui"]')
      if (!forme) return
      const boite = forme.getBoundingClientRect()
      if (boite.top < 0 || boite.bottom > window.innerHeight - HAUTEUR_BARRE_POSITION) forme.scrollIntoView({ block: "center" })
    }
    garder()
    window.addEventListener("pointerup", garder)
    return () => window.removeEventListener("pointerup", garder)
  }, [enBarre])

  // Pendant « Déplacer ou redimensionner », un autre emplacement ne se choisit pas : on sort par Enregistrer ou Annuler.
  function choisir(id: string) {
    if (etape === "position") return
    setChoisi(id)
    setEtape(null)
    setBrouillon(null)
  }

  function fermerPanneau() {
    setChoisi(null)
    setEtape(null)
    setBrouillon(null)
  }

  function changerVue(nouvelle: VuePlan) {
    const p = new URLSearchParams(parametres.toString())
    p.set("vue", nouvelle)
    router.replace(`${chemin}?${p.toString()}`, { scroll: false })
    setEtape(null)
    setBrouillon(null)
  }

  // Une étape s'ouvre depuis la fiche. « Position » part de la forme actuelle : la quitter l'annule (le brouillon est jeté).
  function allerA(nouvelle: EtapeEmplacement | null) {
    setBrouillon(nouvelle === "position" && visible?.forme ? visible.forme : null)
    setEtape(nouvelle)
  }

  // Un ajout : l'emplacement créé, dans la vue affichée, est choisi.
  function ajoute(id: string) {
    choisir(id)
  }

  return (
    <div className={`flex flex-col gap-6 ${enBarre ? "pb-24" : ""}`}>
      {vuesDessinees.length > 1 && (
        <div role="group" aria-label="Vue du véhicule" inert={inerte} className="flex w-fit flex-wrap overflow-hidden rounded-md border border-bordure">
          {vuesDessinees.map((nouvelle) => (
            <button
              key={nouvelle}
              type="button"
              aria-pressed={vue === nouvelle}
              onClick={() => changerVue(nouvelle)}
              className={`cible-tactile px-4 text-sm ${vue === nouvelle ? "bg-surface-2 font-medium text-texte" : "text-texte-discret"}`}
            >
              {TITRE_VUE[nouvelle]}
            </button>
          ))}
        </div>
      )}

      {!gabarit && (
        <div className="flex flex-col gap-3 rounded-lg border border-bordure p-4">
          <p className="text-texte">Ce véhicule n'a pas encore de plan. Choisissez un modèle de plan pour y placer vos emplacements.</p>
          {peutEcrire && <ChoisirModele ficheId={ficheId} vue={vue} />}
        </div>
      )}

      {gabarit && (
        <>
          {enBarre && <p className="text-sm text-texte-discret">Glisse la forme, ou son coin pour la redimensionner.</p>}
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
            <div inert={inerte}>
              <AjouterEmplacement ficheId={ficheId} vue={vue} forme={formeAuCentre(bornes)} onAjoute={ajoute} />
              {complement !== "" && <MettreAJourPlan ficheId={ficheId} vue={vue} libelle={complement} />}
            </div>
          )}
        </>
      )}

      <section aria-labelledby="liste-emplacements" inert={inerte} className="flex flex-col gap-4">
        <h2 id="liste-emplacements" className="sr-only">
          Emplacements
        </h2>
        {emplacements.length === 0 && <p className="text-texte-discret">Aucun emplacement défini pour ce véhicule.</p>}
        {dessines.length > 0 && (
          <ListeEmplacements emplacements={dessines} choisi={visible?.id ?? null} onChoisir={choisir} />
        )}
      </section>

      {visible && enBarre && brouillon && <BarrePosition emplacement={visible} brouillon={brouillon} onTerminer={() => allerA(null)} />}

      {visible && !enBarre && (
        <TiroirEmplacement
          key={visible.id}
          emplacement={visible}
          peutEcrire={peutEcrire}
          partenaires={partenaires}
          etape={etape}
          ordinateur={ordinateur}
          brouillon={brouillon}
          onEtape={allerA}
          onFermer={fermerPanneau}
        />
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

// Choix du modèle de plan, pour un véhicule qui n'en a pas. Le modèle se pose une fois : ensuite, le plan est là.
function ChoisirModele({ ficheId, vue }: { ficheId: string; vue: VuePlan }) {
  const [resultat, envoyer, enCours] = useActionState<ResultatComplement | null, FormData>(choisirGabaritAction, null)
  return (
    <form action={envoyer} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <input type="hidden" name="vehicleId" value={ficheId} />
      <input type="hidden" name="vue" value={vue} />
      <label className="flex flex-1 flex-col gap-1 text-sm">
        <span className="font-medium">Modèle de plan</span>
        <select name="gabaritCle" defaultValue={CLE_GABARIT_GENERIQUE} className={CHAMP}>
          {GABARITS.map((modele) => (
            <option key={modele.cle} value={modele.cle}>
              {modele.nom}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" disabled={enCours} className={BOUTON}>
        Choisir ce modèle
      </button>
      {resultat && !resultat.ok && (
        <p role="alert" className="text-sm text-etat-rouge">
          {resultat.message}
        </p>
      )}
    </form>
  )
}

// Complément : les emplacements des vues ajoutées au gabarit, pour un véhicule déjà créé. Sans effet si tout y est.
// Les lignes sans vue du plan sont rangées dans la vue affichée (`vue`) ; la phrase (`libelle`) le dit, avec les chiffres.
function MettreAJourPlan({ ficheId, vue, libelle }: { ficheId: string; vue: VuePlan; libelle: string }) {
  const [resultat, envoyer, enCours] = useActionState<ResultatComplement | null, FormData>(completerGabaritAction, null)
  return (
    <form action={envoyer} className="flex flex-col gap-2">
      <input type="hidden" name="vehicleId" value={ficheId} />
      <input type="hidden" name="vue" value={vue} />
      <button type="submit" disabled={enCours} className={`${BOUTON_SECONDAIRE} w-full sm:w-auto sm:self-start`}>
        Mettre le plan à jour
      </button>
      <p className="text-sm text-texte-discret">{libelle}</p>
      {resultat && !resultat.ok && (
        <p role="alert" className="text-sm text-etat-rouge">
          {resultat.message}
        </p>
      )}
      {resultat && resultat.ok && resultat.avis && (
        <p role="status" className="text-sm text-texte">
          {resultat.avis}
        </p>
      )}
    </form>
  )
}

// Ajout d'un emplacement sur la vue affichée, au centre : le service le crée, la page le choisit au retour.
function AjouterEmplacement({
  ficheId,
  vue,
  forme,
  onAjoute,
}: {
  ficheId: string
  vue: VuePlan
  forme: FormeEmplacement
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
      <input type="hidden" name="forme" value={JSON.stringify(forme)} />
      <button type="submit" disabled={enCours} className={`${BOUTON_SECONDAIRE} w-full sm:w-auto sm:self-start`}>
        Ajouter un emplacement
      </button>
      {resultat && !resultat.ok && (
        <p role="alert" className="text-sm text-etat-rouge">
          {resultat.message}
        </p>
      )}
    </form>
  )
}
