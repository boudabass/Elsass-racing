// Liste de base des contreparties (brief 3.6, §7) : nom, type, unité, quantité par défaut, ordre et actif.
// Rendu serveur : chaque ligne se lit, et « Modifier » ouvre son tiroir ; « Ajouter une ligne » ouvre un tiroir de saisie
// (brief 3.13b : plus de formulaire replié dans la page).

import { TiroirAction } from "@/components/formulaire/tiroir"
import { CHAMP } from "@/lib/classes-formulaire"

import { creerCatalogueAction, modifierCatalogueAction } from "../actions"
import { LIBELLES_TYPE_CONTREPARTIE } from "../affichage"

import { Champ } from "./formulaire"

export interface LigneCatalogue {
  id: string
  nom: string
  type: string
  unite: string
  quantiteDefaut: number
  ordre: number
  actif: boolean
}

function CorpsCatalogue({ ligne, prefixe }: { ligne?: LigneCatalogue; prefixe: string }) {
  const id = (champ: string) => `${prefixe}-${champ}`
  return (
    <div className="flex flex-col gap-4">
      <Champ id={id("nom")} libelle="Nom">
        <input id={id("nom")} name="nom" required defaultValue={ligne?.nom ?? ""} maxLength={120} className={CHAMP} />
      </Champ>
      <Champ id={id("type")} libelle="Type">
        <select id={id("type")} name="type" required defaultValue={ligne?.type ?? "autre"} className={CHAMP}>
          {Object.entries(LIBELLES_TYPE_CONTREPARTIE).map(([cle, libelle]) => (
            <option key={cle} value={cle}>
              {libelle}
            </option>
          ))}
        </select>
      </Champ>
      <Champ id={id("unite")} libelle="Unité" aide="Par exemple : publication, tenue, emplacement.">
        <input id={id("unite")} name="unite" required defaultValue={ligne?.unite ?? ""} maxLength={40} className={CHAMP} aria-describedby={`${id("unite")}-aide`} />
      </Champ>
      <Champ id={id("quantite")} libelle="Quantité par défaut">
        <input id={id("quantite")} name="quantiteDefaut" type="number" min={1} max={999} defaultValue={ligne?.quantiteDefaut ?? 1} className={CHAMP} />
      </Champ>
      <Champ id={id("ordre")} libelle="Ordre">
        <input id={id("ordre")} name="ordre" type="number" min={0} max={999} defaultValue={ligne?.ordre ?? 0} className={CHAMP} />
      </Champ>
      <label className="cible-tactile flex items-center gap-3">
        <input type="checkbox" name="actif" defaultChecked={ligne ? ligne.actif : true} className="h-5 w-5 accent-marque" />
        Active (proposée dans une convention)
      </label>
    </div>
  )
}

export function CatalogueBase({ lignes }: { lignes: LigneCatalogue[] }) {
  return (
    <section aria-labelledby="liste-base" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="liste-base" className="text-lg font-medium">
          Liste de base des contreparties
        </h2>
        <TiroirAction libelle="Ajouter une ligne" titre="Ajouter une ligne" action={creerCatalogueAction} libelleBouton="Ajouter la ligne" libelleEnCours="Ajout…">
          <CorpsCatalogue prefixe="catalogue-nouveau" />
        </TiroirAction>
      </div>
      <p className="text-sm text-texte-discret">Ces lignes se proposent dans une convention. Choisir une ligne remplit le libellé, le type, l&apos;unité et la quantité.</p>

      <ul className="flex flex-col gap-2">
        {lignes.map((ligne) => (
          <li key={ligne.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-bordure bg-surface p-4">
            <div className="flex flex-col gap-1">
              <span className="font-medium">{ligne.nom}</span>
              <span className="text-sm text-texte-discret">
                {LIBELLES_TYPE_CONTREPARTIE[ligne.type] ?? ligne.type} · {ligne.quantiteDefaut} {ligne.unite} · {ligne.actif ? "Active" : "Inactive"}
              </span>
            </div>
            <TiroirAction
              libelle="Modifier"
              titre={`Modifier ${ligne.nom}`}
              action={modifierCatalogueAction}
              libelleBouton="Enregistrer la ligne"
              libelleEnCours="Enregistrement…"
            >
              <input type="hidden" name="catalogueId" value={ligne.id} />
              <CorpsCatalogue ligne={ligne} prefixe={`catalogue-${ligne.id}`} />
            </TiroirAction>
          </li>
        ))}
      </ul>
    </section>
  )
}
