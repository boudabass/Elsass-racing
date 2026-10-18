"use client"

// Contrepartie (brief 3.6, §5) : choix dans la liste de base (qui préremplit libellé, type, unité et quantité) ou
// texte libre. Pour un logo sur la voiture, un choix d'emplacement avec son statut ; épreuves par cases à cocher.

import { useState } from "react"

import { CHAMP } from "@/lib/classes-formulaire"

import { LIBELLE_EMPLACEMENT, LIBELLES_TYPE_CONTREPARTIE } from "../affichage"
import { ajouterContrepartieAction, modifierContrepartieAction } from "../actions"

import { BoutonEnvoi, Champ, FormulaireAction } from "./formulaire"

export interface ContrepartieValeurs {
  libelle: string
  type: string
  quantitePromise: number
  unite: string
  slotId: string | null
  eventIds: string[]
  echeance: string | null
}

export function FormulaireContrepartie({
  mode,
  agreementId,
  benefitId,
  catalogue,
  emplacements,
  epreuves,
  valeurs,
}: {
  mode: "creation" | "modification"
  agreementId: string
  benefitId?: string
  catalogue: { id: string; nom: string; type: string; unite: string; quantiteDefaut: number }[]
  emplacements: { id: string; nom: string; vehicleNom: string; statut: string }[]
  epreuves: { id: string; nom: string }[]
  valeurs: ContrepartieValeurs
}) {
  const [catalogId, setCatalogId] = useState("")
  const [libelle, setLibelle] = useState(valeurs.libelle)
  const [type, setType] = useState(valeurs.type)
  const [unite, setUnite] = useState(valeurs.unite)
  const [quantite, setQuantite] = useState(String(valeurs.quantitePromise))
  const [slotId, setSlotId] = useState(valeurs.slotId ?? "")
  const [eventIds, setEventIds] = useState<string[]>(valeurs.eventIds)
  const [echeance, setEcheance] = useState(valeurs.echeance ?? "")

  // Choisir une ligne de la liste de base remplit le reste du formulaire, sans l'enfermer.
  function choisirCatalogue(identifiant: string) {
    setCatalogId(identifiant)
    const ligne = catalogue.find((c) => c.id === identifiant)
    if (!ligne) return
    setLibelle(ligne.nom)
    setType(ligne.type)
    setUnite(ligne.unite)
    setQuantite(String(ligne.quantiteDefaut))
  }

  const slot = emplacements.find((e) => e.id === slotId) ?? null
  const epreuvesCochees = new Set(eventIds)
  const cle = `${mode}-${benefitId ?? agreementId}`

  return (
    <FormulaireAction
      nom={mode === "creation" ? "Ajouter une contrepartie" : "Modifier la contrepartie"}
      action={mode === "creation" ? ajouterContrepartieAction : modifierContrepartieAction}
      className="flex flex-col gap-4"
    >
      {mode === "creation" ? (
        <>
          <input type="hidden" name="agreementId" value={agreementId} />
          <input type="hidden" name="catalogId" value={catalogId} />
        </>
      ) : (
        <input type="hidden" name="benefitId" value={benefitId} />
      )}

      {mode === "creation" && catalogue.length > 0 && (
        <Champ id={`catalogue-${cle}`} libelle="Dans la liste de base">
          <select id={`catalogue-${cle}`} value={catalogId} onChange={(e) => choisirCatalogue(e.target.value)} className={CHAMP}>
            <option value="">Autre (texte libre)</option>
            {catalogue.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nom}
              </option>
            ))}
          </select>
        </Champ>
      )}

      <Champ id={`libelle-${cle}`} libelle="Libellé">
        <input id={`libelle-${cle}`} name="libelle" value={libelle} onChange={(e) => setLibelle(e.target.value)} maxLength={200} required={mode === "modification"} className={CHAMP} />
      </Champ>

      <div className="grid gap-4 sm:grid-cols-2">
        <Champ id={`type-${cle}`} libelle="Type">
          <select id={`type-${cle}`} name="type" value={type} onChange={(e) => setType(e.target.value)} className={CHAMP}>
            {Object.entries(LIBELLES_TYPE_CONTREPARTIE).map(([cleType, libelleType]) => (
              <option key={cleType} value={cleType}>
                {libelleType}
              </option>
            ))}
          </select>
        </Champ>
        <Champ id={`quantite-${cle}`} libelle="Quantité promise">
          <input id={`quantite-${cle}`} name="quantitePromise" type="number" min={1} max={999} value={quantite} onChange={(e) => setQuantite(e.target.value)} className={CHAMP} />
        </Champ>
        {mode === "creation" && (
          <Champ id={`unite-${cle}`} libelle="Unité" aide="Par exemple : publication, tenue, emplacement.">
            <input id={`unite-${cle}`} name="unite" value={unite} onChange={(e) => setUnite(e.target.value)} maxLength={40} className={CHAMP} aria-describedby={`unite-${cle}-aide`} />
          </Champ>
        )}
        <Champ id={`echeance-${cle}`} libelle="Échéance">
          <input id={`echeance-${cle}`} name="echeance" type="date" value={echeance} onChange={(e) => setEcheance(e.target.value)} className={CHAMP} />
        </Champ>
      </div>

      {type === "logo_voiture" && (
        <div className="flex flex-col gap-2">
          <Champ id={`slot-${cle}`} libelle="Emplacement sur la voiture">
            <select id={`slot-${cle}`} name="slotId" value={slotId} onChange={(e) => setSlotId(e.target.value)} className={CHAMP}>
              <option value="">Aucun emplacement choisi</option>
              {emplacements.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.vehicleNom} · {e.nom} ({LIBELLE_EMPLACEMENT[e.statut] ?? e.statut})
                </option>
              ))}
            </select>
          </Champ>
          <input type="hidden" name="slotNom" value={slot?.nom ?? ""} />
        </div>
      )}

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-medium">Épreuves concernées</legend>
        {epreuves.length === 0 ? (
          <p className="text-sm text-texte-discret">Aucune épreuve dans la saison de cette convention.</p>
        ) : (
          epreuves.map((epreuve) => (
            <label key={epreuve.id} className="cible-tactile flex items-center gap-3">
              <input
                type="checkbox"
                name="eventIds"
                value={epreuve.id}
                checked={epreuvesCochees.has(epreuve.id)}
                onChange={(e) => setEventIds((anciennes) => (e.target.checked ? [...anciennes, epreuve.id] : anciennes.filter((id) => id !== epreuve.id)))}
                className="h-5 w-5 accent-marque"
              />
              {epreuve.nom}
            </label>
          ))
        )}
      </fieldset>

      <div>
        <BoutonEnvoi libelle={mode === "creation" ? "Ajouter la contrepartie" : "Enregistrer"} />
      </div>
    </FormulaireAction>
  )
}
