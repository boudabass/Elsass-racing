"use client"

// Plan de la voiture (brief 3.4, section 1) : le dessin du gabarit et les emplacements, en SVG. Les rôles de couleur
// sont des variables du thème, donc le plan suit le thème clair ou sombre. Aucun texte dans le SVG : les noms sont
// dans la liste, à côté du plan. Le statut se lit de trois façons (contour, fond, texte), jamais par la couleur seule.

import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react"

import type { ElementDessin, FormeEmplacement, Gabarit, RoleDessin } from "../gabarits/types"
import { LIBELLE_STATUT_EMPLACEMENT, TITRE_VUE } from "../libelles"
import {
  COTE_POIGNEE,
  bornesDu,
  deplacerForme,
  dessinDeLaVue,
  etendueDe,
  pasClavier,
  redimensionnerForme,
  type EmplacementPlan,
  type VuePlan,
} from "../plan"

// Épaisseur à partir de laquelle un trait « detail » est le filet rouge du dessin d'origine : il prend la couleur de la team.
const EPAISSEUR_FILET = 4
// Cible tactile minimale d'une poignée, en pixels à l'écran (règle du projet : 44 px).
const CIBLE_TACTILE_PX = 44
// Déplacement minimal, en unités du plan, avant qu'une forme bouge : un appui simple ne change rien.
const SEUIL_GLISSEMENT = 1

const STYLE_ROLE: Record<RoleDessin, CSSProperties> = {
  caisse: { fill: "var(--surface-2)", stroke: "var(--bordure)", strokeWidth: 1 },
  vitre: { fill: "color-mix(in srgb, var(--surface) 50%, var(--bordure))", stroke: "var(--bordure)", strokeWidth: 0.8 },
  roue: { fill: "var(--fond)", stroke: "var(--texte-discret)", strokeWidth: 1 },
  jante: { fill: "var(--texte-discret)", stroke: "none" },
  detail: { fill: "none", stroke: "var(--bordure)", strokeWidth: 1 },
  sol: { fill: "none", stroke: "var(--bordure)", strokeWidth: 1.5 },
}

// Déplacement en cours d'un emplacement (mode « Déplacer ou redimensionner »), dans la vue où il est dessiné.
export interface DeplacementEnCours {
  id: string
  forme: FormeEmplacement
  onChange: (forme: FormeEmplacement) => void
}

interface PlanVehiculeProps {
  nomVehicule: string
  gabarit: Gabarit
  vue: VuePlan
  // Emplacements dessinés dans cette vue, avec leur occupation active.
  emplacements: EmplacementPlan[]
  choisi: string | null
  onChoisir: (id: string) => void
  deplacement: DeplacementEnCours | null
}

interface Glissement {
  mode: "corps" | "coin"
  depart: { x: number; y: number }
  origine: FormeEmplacement
  bouge: boolean
}

export function PlanVehicule({ nomVehicule, gabarit, vue, emplacements, choisi, onChoisir, deplacement }: PlanVehiculeProps) {
  const bornes = bornesDu(gabarit.viewBox)
  const identifiant = useId().replace(/:/g, "")
  const motifHachures = `${identifiant}-hachures`
  const svg = useRef<SVGSVGElement>(null)
  const glissement = useRef<Glissement | null>(null)
  const dessin = dessinDeLaVue(gabarit, vue)
  // Unités du plan par pixel à l'écran : sert à donner aux poignées une cible de 44 px, quelle que soit la taille du plan.
  const [echelle, setEchelle] = useState(1)
  useEffect(() => {
    const element = svg.current
    if (!element) return
    const mesurer = () => setEchelle(element.getBoundingClientRect().width / bornes.l)
    mesurer()
    const observateur = new ResizeObserver(mesurer)
    observateur.observe(element)
    return () => observateur.disconnect()
  }, [bornes.l])

  // Coordonnées du plan (celles du viewBox) pour un événement de pointeur.
  function pointDuPlan(evenement: PointerEvent<SVGElement>): { x: number; y: number } | null {
    const element = svg.current
    const matrice = element?.getScreenCTM()
    if (!element || !matrice) return null
    const point = element.createSVGPoint()
    point.x = evenement.clientX
    point.y = evenement.clientY
    const dansLePlan = point.matrixTransform(matrice.inverse())
    return { x: dansLePlan.x, y: dansLePlan.y }
  }

  function debutGlissement(evenement: PointerEvent<SVGElement>, mode: Glissement["mode"]) {
    if (!deplacement) return
    const depart = pointDuPlan(evenement)
    if (!depart) return
    evenement.currentTarget.setPointerCapture(evenement.pointerId)
    glissement.current = { mode, depart, origine: deplacement.forme, bouge: false }
  }

  function suitGlissement(evenement: PointerEvent<SVGElement>) {
    const suivi = glissement.current
    if (!deplacement || !suivi) return
    const point = pointDuPlan(evenement)
    if (!point) return
    const dx = point.x - suivi.depart.x
    const dy = point.y - suivi.depart.y
    // Un appui qui ne bouge pas, ou à peine, ne change pas la position : le tiroir reste l'action du clic.
    if (!suivi.bouge) {
      if (Math.hypot(dx, dy) < SEUIL_GLISSEMENT) return
      suivi.bouge = true
    }
    if (suivi.mode === "corps") {
      deplacement.onChange(deplacerForme(suivi.origine, dx, dy, bornes))
    } else {
      const etendue = etendueDe(suivi.origine)
      deplacement.onChange(redimensionnerForme(suivi.origine, etendue.l + dx, etendue.h + dy, bornes))
    }
  }

  function finGlissement(evenement: PointerEvent<SVGElement>) {
    if (!glissement.current) return
    glissement.current = null
    if (evenement.currentTarget.hasPointerCapture(evenement.pointerId)) {
      evenement.currentTarget.releasePointerCapture(evenement.pointerId)
    }
  }

  // Entrée et Espace choisissent ; en mode déplacement, les flèches bougent la forme choisie (1 unité, 10 avec Maj).
  function toucheSurForme(evenement: KeyboardEvent<SVGElement>, id: string) {
    if (evenement.key === "Enter" || evenement.key === " ") {
      evenement.preventDefault()
      onChoisir(id)
      return
    }
    if (!deplacement || deplacement.id !== id) return
    const pas = pasClavier(evenement.shiftKey)
    const decalage: Record<string, [number, number]> = {
      ArrowLeft: [-pas, 0],
      ArrowRight: [pas, 0],
      ArrowUp: [0, -pas],
      ArrowDown: [0, pas],
    }
    const delta = decalage[evenement.key]
    if (!delta) return
    evenement.preventDefault()
    deplacement.onChange(deplacerForme(deplacement.forme, delta[0], delta[1], bornes))
  }

  const dessinees = emplacements.map((emplacement) => {
    const forme = deplacement?.id === emplacement.id ? deplacement.forme : emplacement.forme
    return { emplacement, forme }
  })

  return (
    <svg
      ref={svg}
      viewBox={gabarit.viewBox}
      role="group"
      aria-label={`Plan de ${nomVehicule}, ${TITRE_VUE[vue].toLowerCase()}`}
      className="block h-auto w-full"
      style={{ touchAction: deplacement ? "none" : undefined }}
    >
      <defs>
        <pattern id={motifHachures} patternUnits="userSpaceOnUse" width={5} height={5} patternTransform="rotate(45)">
          <line x1={0} y1={0} x2={0} y2={5} style={{ stroke: "var(--texte-discret)", strokeWidth: 1.5 }} />
        </pattern>
      </defs>

      {/* Une vue en miroir (le côté gauche) reprend le dessin droit, retourné autour de l'axe vertical du viewBox. */}
      {dessin && (
        <g transform={dessin.retourne ? `translate(${bornes.x + bornes.l} 0) scale(-1 1)` : undefined}>
          {dessin.elements.map((element, index) => (
            <TraitDessin key={index} element={element} />
          ))}
        </g>
      )}

      {dessinees.map(({ emplacement, forme }) => {
        if (!forme) return null
        const estChoisi = emplacement.id === choisi
        // Le logo du partenaire s'affiche dès la réservation, et reste après la pose.
        const logo = emplacement.occupation?.logoFileId ?? null
        const enDeplacement = deplacement?.id === emplacement.id
        return (
          <g key={emplacement.id}>
            <FormeEmplacementSvg
              forme={forme}
              statut={emplacement.statut}
              avecLogo={logo !== null}
              motifHachures={motifHachures}
              choisi={estChoisi}
              aria-label={libelleDuPlan(emplacement)}
              onChoisir={() => onChoisir(emplacement.id)}
              onTouche={(evenement) => toucheSurForme(evenement, emplacement.id)}
              onDebutGlissement={enDeplacement ? (e) => debutGlissement(e, "corps") : undefined}
              onSuitGlissement={enDeplacement ? suitGlissement : undefined}
              onFinGlissement={enDeplacement ? finGlissement : undefined}
              identifiant={`${identifiant}-${emplacement.id}`}
            />
            {logo && <LogoSvg forme={forme} fichierId={logo} identifiant={`${identifiant}-${emplacement.id}`} />}
            {enDeplacement && forme.type === "rect" && (
              <PoigneeSvg
                forme={forme}
                echelle={echelle}
                onDebut={(e) => debutGlissement(e, "coin")}
                onSuit={suitGlissement}
                onFin={finGlissement}
              />
            )}
          </g>
        )
      })}
    </svg>
  )
}

// Libellé accessible d'une forme : nom, statut écrit, partenaire s'il y en a un.
export function libelleDuPlan(emplacement: EmplacementPlan): string {
  const partenaire = emplacement.occupation ? `, ${emplacement.occupation.partenaireNom}` : ""
  return `${emplacement.nom}, ${LIBELLE_STATUT_EMPLACEMENT[emplacement.statut]}${partenaire}`
}

function TraitDessin({ element }: { element: ElementDessin }) {
  const { "stroke-width": epaisseurAttribut, ...geometrie } = element.attributs
  const estFilet = element.role === "detail" && Number(epaisseurAttribut ?? 0) >= EPAISSEUR_FILET
  const style: CSSProperties = {
    ...STYLE_ROLE[element.role],
    ...(estFilet ? { stroke: "var(--marque)" } : {}),
    ...(epaisseurAttribut !== undefined ? { strokeWidth: Number(epaisseurAttribut) } : {}),
  }
  if (element.type === "circle") return <circle {...geometrie} style={style} />
  if (element.type === "line") return <line {...geometrie} style={style} />
  return <path {...geometrie} style={style} />
}

function styleStatut(statut: EmplacementPlan["statut"], avecLogo: boolean, motif: string): CSSProperties {
  if (statut === "libre") return { fill: "none", stroke: "var(--marque)", strokeDasharray: "4 3", strokeWidth: 1.5 }
  if (statut === "reserve") return { fill: "var(--marque)", fillOpacity: 0.15, stroke: "var(--marque)", strokeWidth: 1.5 }
  if (statut === "occupe") {
    return avecLogo
      ? { fill: "none", stroke: "var(--texte)", strokeWidth: 1.5 }
      : { fill: "var(--texte)", fillOpacity: 0.2, stroke: "var(--texte)", strokeWidth: 1.5 }
  }
  return { fill: `url(#${motif})`, stroke: "var(--texte-discret)", strokeWidth: 1.5 }
}

interface FormeEmplacementSvgProps {
  forme: FormeEmplacement
  statut: EmplacementPlan["statut"]
  avecLogo: boolean
  motifHachures: string
  choisi: boolean
  "aria-label": string
  identifiant: string
  onChoisir: () => void
  onTouche: (evenement: KeyboardEvent<SVGElement>) => void
  onDebutGlissement?: (evenement: PointerEvent<SVGElement>) => void
  onSuitGlissement?: (evenement: PointerEvent<SVGElement>) => void
  onFinGlissement?: (evenement: PointerEvent<SVGElement>) => void
}

// Forme cliquable et focusable. Le libellé accessible porte le nom, le statut et le partenaire.
function FormeEmplacementSvg({
  forme,
  statut,
  avecLogo,
  motifHachures,
  choisi,
  "aria-label": libelle,
  onChoisir,
  onTouche,
  onDebutGlissement,
  onSuitGlissement,
  onFinGlissement,
}: FormeEmplacementSvgProps) {
  // Toute la surface de la forme reçoit le pointeur, pas seulement son contour : un emplacement libre n'a pas de remplissage.
  const style: CSSProperties = {
    ...styleStatut(statut, avecLogo, motifHachures),
    ...(choisi ? { stroke: "var(--texte)", strokeWidth: 3 } : {}),
    pointerEvents: "all",
    touchAction: onDebutGlissement ? "none" : undefined,
    cursor: onDebutGlissement ? "move" : "pointer",
  }
  const commun = {
    role: "button" as const,
    tabIndex: 0,
    "aria-label": libelle,
    "aria-pressed": choisi,
    style,
    // Le clic qui termine un glissement ne doit pas quitter le mode déplacement : la forme en cours est gardée.
    onClick: onDebutGlissement ? undefined : onChoisir,
    onKeyDown: onTouche,
    onPointerDown: onDebutGlissement,
    onPointerMove: onSuitGlissement,
    onPointerUp: onFinGlissement,
    onPointerCancel: onFinGlissement,
    // Repère de la forme en déplacement : la page la retrouve pour la garder au-dessus de la barre (téléphone).
    "data-deplacement": onDebutGlissement ? "oui" : undefined,
  }
  if (forme.type === "rect") {
    return <rect x={forme.x} y={forme.y} width={forme.l} height={forme.h} {...commun} />
  }
  return <polygon points={forme.points.map(([x, y]) => `${x},${y}`).join(" ")} {...commun} />
}

// Logo du partenaire dans la boîte de la forme, sans déformation. Un polygone est découpé à sa forme.
function LogoSvg({ forme, fichierId, identifiant }: { forme: FormeEmplacement; fichierId: string; identifiant: string }) {
  const boite = etendueDe(forme)
  const idDecoupe = `${identifiant}-decoupe`
  return (
    <>
      {forme.type === "polygone" && (
        <defs>
          <clipPath id={idDecoupe}>
            <polygon points={forme.points.map(([x, y]) => `${x},${y}`).join(" ")} />
          </clipPath>
        </defs>
      )}
      <image
        href={`/api/fichiers/${fichierId}`}
        x={boite.x}
        y={boite.y}
        width={boite.l}
        height={boite.h}
        preserveAspectRatio="xMidYMid meet"
        clipPath={forme.type === "polygone" ? `url(#${idDecoupe})` : undefined}
        style={{ pointerEvents: "none" }}
      />
    </>
  )
}

// Poignée carrée au coin bas-droit d'un rectangle, en mode déplacement. Le dessin reste petit ; la zone de contact
// autour fait au moins 44 px à l'écran, pour le doigt.
function PoigneeSvg({
  forme,
  echelle,
  onDebut,
  onSuit,
  onFin,
}: {
  forme: Extract<FormeEmplacement, { type: "rect" }>
  echelle: number
  onDebut: (evenement: PointerEvent<SVGElement>) => void
  onSuit: (evenement: PointerEvent<SVGElement>) => void
  onFin: (evenement: PointerEvent<SVGElement>) => void
}) {
  const cible = Math.max(COTE_POIGNEE, CIBLE_TACTILE_PX / echelle)
  const xCoin = forme.x + forme.l
  const yCoin = forme.y + forme.h
  return (
    <g aria-hidden="true" style={{ cursor: "nwse-resize", touchAction: "none" }} onPointerDown={onDebut} onPointerMove={onSuit} onPointerUp={onFin} onPointerCancel={onFin}>
      <rect x={xCoin - cible / 2} y={yCoin - cible / 2} width={cible} height={cible} style={{ fill: "transparent" }} />
      <rect
        x={xCoin - COTE_POIGNEE / 2}
        y={yCoin - COTE_POIGNEE / 2}
        width={COTE_POIGNEE}
        height={COTE_POIGNEE}
        style={{ fill: "var(--marque)", stroke: "var(--texte)", strokeWidth: 1, pointerEvents: "none" }}
      />
    </g>
  )
}
