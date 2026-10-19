"use client"

// Formulaire de convention (brief 3.6, §5), commun à la création et à la modification d'un brouillon.
// L'échéancier est une liste de lignes « date, montant » ; sa somme s'affiche, et un avertissement (sans
// blocage) apparaît si elle diffère de l'apport financier.

import { useRouter } from "next/navigation"
import { useState } from "react"

import { CHAMP } from "@/lib/classes-formulaire"

import { centimesDeSaisie } from "../affichage"
import { creerConventionAction, modifierConventionAction } from "../actions"
import { formaterMontant } from "../regles"

import { BoutonEnvoi, Champ, FormulaireAction } from "./formulaire"

export interface LigneEcheancier {
  date: string
  montant: string
}

export interface ValeursConvention {
  templateId: string
  seasonId: string
  dateDebut: string
  dateFin: string
  apportFinancier: string
  apportNatureDescription: string
  apportNatureValeur: string
  echeancier: LigneEcheancier[]
}

interface Props {
  mode: "creation" | "modification"
  partnerId: string
  agreementId?: string
  modeles: { id: string; nom: string; version: number }[]
  saisons: { id: string; nom: string; dateDebut: string; dateFin: string }[]
  valeurs: ValeursConvention
}

export function FormulaireConvention({ mode, partnerId, agreementId, modeles, saisons, valeurs }: Props) {
  const router = useRouter()
  const [saison, setSaison] = useState(valeurs.seasonId)
  const [dateDebut, setDateDebut] = useState(valeurs.dateDebut)
  const [dateFin, setDateFin] = useState(valeurs.dateFin)
  const [apport, setApport] = useState(valeurs.apportFinancier)
  const [lignes, setLignes] = useState<LigneEcheancier[]>(valeurs.echeancier.length > 0 ? valeurs.echeancier : [{ date: "", montant: "" }])

  // La saison choisie reprend ses dates, sauf si l'utilisateur les a déjà changées à la main.
  function choisirSaison(identifiant: string) {
    setSaison(identifiant)
    const choix = saisons.find((s) => s.id === identifiant)
    if (choix && dateDebut === valeurs.dateDebut && dateFin === valeurs.dateFin) {
      setDateDebut(choix.dateDebut)
      setDateFin(choix.dateFin)
    }
  }

  function modifierLigne(index: number, champ: keyof LigneEcheancier, valeur: string) {
    setLignes((anciennes) => anciennes.map((ligne, position) => (position === index ? { ...ligne, [champ]: valeur } : ligne)))
  }

  const totalCentimes = lignes.reduce((somme, ligne) => somme + (centimesDeSaisie(ligne.montant) ?? 0), 0)
  const apportCentimes = centimesDeSaisie(apport) ?? 0
  const differe = lignes.some((ligne) => ligne.montant.trim() !== "") && totalCentimes !== apportCentimes

  return (
    <FormulaireAction
      nom={mode === "creation" ? "Nouvelle convention" : "Modifier la convention"}
      action={mode === "creation" ? creerConventionAction : modifierConventionAction}
      auSucces={(resultat) => {
        if (mode === "creation" && resultat.id) router.push(`/apps/partenaires/conventions/${resultat.id}?onglet=contreparties`)
      }}
      className="flex flex-col gap-8"
    >
      <input type="hidden" name={mode === "creation" ? "partnerId" : "agreementId"} value={mode === "creation" ? partnerId : agreementId} />

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 text-lg font-medium">Saison et modèle</legend>
        <Champ id="saison" libelle="Saison">
          <select id="saison" name="seasonId" value={saison} onChange={(e) => choisirSaison(e.target.value)} className={CHAMP}>
            <option value="">Aucune saison</option>
            {saisons.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nom}
              </option>
            ))}
          </select>
        </Champ>
        <Champ id="modele" libelle="Modèle de convention">
          <select id="modele" name="templateId" required defaultValue={valeurs.templateId} className={CHAMP}>
            {modeles.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nom} (version {m.version})
              </option>
            ))}
          </select>
        </Champ>
        <Champ id="date-debut" libelle="Début">
          <input id="date-debut" name="dateDebut" type="date" required value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} className={CHAMP} />
        </Champ>
        <Champ id="date-fin" libelle="Fin">
          <input id="date-fin" name="dateFin" type="date" required value={dateFin} onChange={(e) => setDateFin(e.target.value)} className={CHAMP} />
        </Champ>
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 text-lg font-medium">Apports</legend>
        <Champ id="apport-financier" libelle="Apport financier (€)" aide="Le montant reçu, en euros. Laisse vide s'il n'y en a pas.">
          <input
            id="apport-financier"
            name="apportFinancier"
            inputMode="decimal"
            value={apport}
            onChange={(e) => setApport(e.target.value)}
            className={CHAMP}
            aria-describedby="apport-financier-aide"
          />
        </Champ>
        <div />
        <div className="sm:col-span-2">
          <Champ id="apport-nature" libelle="Apport en nature" aide="Par exemple : une prestation, du matériel.">
            <textarea id="apport-nature" name="apportNatureDescription" rows={2} maxLength={500} defaultValue={valeurs.apportNatureDescription} className={CHAMP} aria-describedby="apport-nature-aide" />
          </Champ>
        </div>
        <Champ id="apport-nature-valeur" libelle="Valeur estimée (€)">
          <input id="apport-nature-valeur" name="apportNatureValeur" inputMode="decimal" defaultValue={valeurs.apportNatureValeur} className={CHAMP} />
        </Champ>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-lg font-medium">Échéancier</legend>
        <p className="text-sm text-texte-discret">Les dates et les montants que le partenaire doit verser.</p>
        {lignes.map((ligne, index) => (
          <div key={index} className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <Champ id={`echeance-date-${index}`} libelle={`Date, ligne ${index + 1}`}>
              <input id={`echeance-date-${index}`} name="echeancierDate" type="date" value={ligne.date} onChange={(e) => modifierLigne(index, "date", e.target.value)} className={CHAMP} />
            </Champ>
            <Champ id={`echeance-montant-${index}`} libelle={`Montant (€), ligne ${index + 1}`}>
              <input
                id={`echeance-montant-${index}`}
                name="echeancierMontant"
                inputMode="decimal"
                value={ligne.montant}
                onChange={(e) => modifierLigne(index, "montant", e.target.value)}
                className={CHAMP}
              />
            </Champ>
            <button
              type="button"
              onClick={() => setLignes((anciennes) => anciennes.filter((_, position) => position !== index))}
              disabled={lignes.length === 1}
              className="cible-tactile rounded-md border border-bordure px-4 text-sm hover:bg-surface-2 disabled:opacity-50"
            >
              Retirer la ligne {index + 1}
            </button>
          </div>
        ))}
        <div>
          <button type="button" onClick={() => setLignes((anciennes) => [...anciennes, { date: "", montant: "" }])} className="cible-tactile rounded-md border border-bordure px-4 text-sm hover:bg-surface-2">
            Ajouter une ligne
          </button>
        </div>
        <p className="text-sm">
          Total des échéances : <span className="font-medium">{formaterMontant(totalCentimes)}</span>
        </p>
        {differe && (
          <p role="status" className="text-sm text-etat-orange">
            La somme des échéances ({formaterMontant(totalCentimes)}) ne correspond pas à l&apos;apport financier ({formaterMontant(apportCentimes)}). Tu peux enregistrer quand même.
          </p>
        )}
      </fieldset>

      <div>
        <BoutonEnvoi libelle={mode === "creation" ? "Créer la convention" : "Enregistrer"} />
      </div>
    </FormulaireAction>
  )
}
