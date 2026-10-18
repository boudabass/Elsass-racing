"use client"

// Éditeur d'un modèle de convention (brief 3.6, §7) : un grand champ texte, des boutons « Insérer » pour chaque
// champ connu (à la position du curseur), un aperçu qui n'enregistre rien, puis enregistrer, dupliquer et activer.

import { useMemo, useRef, useState } from "react"

import { CHAMP, BOUTON_SECONDAIRE } from "@/lib/classes-formulaire"

import { dupliquerModeleAction, changerActifModeleAction, modifierModeleAction } from "../actions"
import { CHAMPS_CONNUS, remplirModele, type ValeurModele } from "../regles"

import { BoutonEnvoi, FormulaireAction } from "./formulaire"

// Valeurs d'exemple pour l'aperçu seulement : elles ne sont jamais enregistrées.
const EXEMPLE: Partial<Record<(typeof CHAMPS_CONNUS)[number], ValeurModele>> = {
  "team.nom": "Équipe Exemple",
  "team.forme_juridique": "association de droit local",
  "team.rna": "exemple",
  "team.adresse": "1 rue de l'Exemple, 67500 Haguenau",
  "team.representant": "Prénom Nom, président",
  "partenaire.entreprise": "Garage Exemple",
  "partenaire.adresse": "2 rue de l'Exemple, 67500 Haguenau",
  "partenaire.representant": "Prénom Nom",
  "convention.apport_financier": "1 500,00 €",
  "convention.apport_nature": "aucun",
  "convention.echeancier": "15/03/2027 : 750,00 € ; 15/09/2027 : 750,00 €",
  "convention.date_debut": "01/03/2027",
  "convention.date_fin": "31/12/2027",
  "convention.saison": "Saison 2027",
  contreparties: [
    { libelle: "Logo sur la voiture", quantite: 1, unite: "emplacement", emplacement: "Portière", epreuves: [], echeance: "2027-12-31" },
    { libelle: "Publications sur les réseaux", quantite: 4, unite: "publication", emplacement: null, epreuves: [], echeance: null },
  ],
}

export function EditeurModele({
  modele,
}: {
  modele: { id: string; nom: string; texte: string; version: number; actif: boolean }
}) {
  const [nom, setNom] = useState(modele.nom)
  const [texte, setTexte] = useState(modele.texte)
  const [apercu, setApercu] = useState(false)
  const zone = useRef<HTMLTextAreaElement>(null)

  // Insère le champ à la position du curseur, puis replace le curseur juste après lui.
  function inserer(champ: string) {
    const element = zone.current
    const debut = element?.selectionStart ?? texte.length
    const fin = element?.selectionEnd ?? debut
    const jeton = `{{${champ}}}`
    setTexte(texte.slice(0, debut) + jeton + texte.slice(fin))
    requestAnimationFrame(() => {
      element?.focus()
      element?.setSelectionRange(debut + jeton.length, debut + jeton.length)
    })
  }

  const rendu = useMemo(() => remplirModele(texte, EXEMPLE), [texte])

  return (
    <div className="flex flex-col gap-8">
      <FormulaireAction action={modifierModeleAction} nom="Modifier le modèle" className="flex flex-col gap-4">
        <input type="hidden" name="modeleId" value={modele.id} />
        <label htmlFor="nom-modele" className="font-medium">
          Nom du modèle
        </label>
        <input id="nom-modele" name="nom" required value={nom} onChange={(e) => setNom(e.target.value)} maxLength={120} className={CHAMP} />

        <label htmlFor="texte-modele" className="font-medium">
          Texte
        </label>
        <textarea
          id="texte-modele"
          ref={zone}
          name="texte"
          required
          rows={20}
          value={texte}
          onChange={(e) => setTexte(e.target.value)}
          maxLength={20000}
          className={`${CHAMP} min-h-[20rem] font-mono text-sm leading-relaxed`}
        />

        <div>
          <BoutonEnvoi libelle="Enregistrer" />
        </div>
      </FormulaireAction>

      <section aria-labelledby="champs-disponibles" className="flex flex-col gap-3">
        <h2 id="champs-disponibles" className="text-lg font-medium">
          Champs disponibles
        </h2>
        <p className="text-sm text-texte-discret">Un champ inséré se remplit à la création du document. Un champ vide s&apos;écrit en blanc sur le document.</p>
        <div className="flex flex-wrap gap-2">
          {CHAMPS_CONNUS.map((champ) => (
            <button key={champ} type="button" onClick={() => inserer(champ)} aria-label={`Insérer le champ ${champ}`} className="cible-tactile rounded-md border border-bordure px-3 font-mono text-sm hover:bg-surface-2">
              {`{{${champ}}}`}
            </button>
          ))}
        </div>
      </section>

      <section aria-labelledby="apercu-modele" className="flex flex-col gap-3">
        <h2 id="apercu-modele" className="text-lg font-medium">
          Aperçu
        </h2>
        <div>
          <button type="button" aria-expanded={apercu} onClick={() => setApercu((ouvert) => !ouvert)} className={`${BOUTON_SECONDAIRE} inline-flex`}>
            {apercu ? "Masquer l'aperçu" : "Aperçu"}
          </button>
        </div>
        {apercu && (
          <div className="flex flex-col gap-3">
            {rendu.inconnus.length > 0 && (
              <p role="status" className="text-sm text-etat-rouge">
                Champ inconnu : {rendu.inconnus.join(", ")}. Il restera tel quel dans le document.
              </p>
            )}
            <p className="text-sm text-texte-discret">Aperçu avec des valeurs d&apos;exemple. Rien n&apos;est enregistré.</p>
            <pre className="whitespace-pre-wrap rounded-md border border-bordure bg-surface p-4 font-sans text-sm leading-relaxed">{rendu.texte}</pre>
          </div>
        )}
      </section>

      <section aria-labelledby="actions-modele" className="flex flex-col gap-4">
        <h2 id="actions-modele" className="text-lg font-medium">
          Version {modele.version} · {modele.actif ? "Actif" : "Désactivé"}
        </h2>
        <div className="flex flex-wrap gap-3">
          <FormulaireAction action={dupliquerModeleAction} nom="Dupliquer le modèle" className="flex">
            <input type="hidden" name="nom" value={nom} />
            <input type="hidden" name="texte" value={texte} />
            <BoutonEnvoi libelle="Dupliquer" secondaire />
          </FormulaireAction>
          <FormulaireAction action={changerActifModeleAction} nom="Activer ou désactiver le modèle" className="flex">
            <input type="hidden" name="modeleId" value={modele.id} />
            <input type="hidden" name="actif" value={modele.actif ? "non" : "oui"} />
            <BoutonEnvoi libelle={modele.actif ? "Désactiver" : "Activer"} secondaire />
          </FormulaireAction>
        </div>
        <p className="text-sm text-texte-discret">Un modèle désactivé ne se propose plus pour une nouvelle convention. Les conventions existantes gardent le leur.</p>
      </section>
    </div>
  )
}
