"use client"

// Page « Intervention » du bouton + (tâche 4.3, brief §4). Une page entière, qui finit comme un tiroir : la barre du bas
// envoie, « Annuler » quitte. Les pièces (et leur motif de dépose) n'apparaissent qu'au niveau écriture.

import { useActionState, useEffect, useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"

import { FormulairePage } from "@/components/formulaire/formulaire-page"
import { Message } from "@/components/formulaire/message"
import { newId } from "@/core/ids"
import type { Resultat } from "@/core/sdk/actions-serveur"
import { useEtatSynchro, useMoteurSynchro } from "@/core/synchro/client/react"
import { CHAMP } from "@/lib/classes-formulaire"

import { creerInterventionAction } from "../actions"
import { LIBELLE_MOTIF_DEPOSE } from "../libelles"

export interface FormulaireInterventionProps {
  vehicleId: string
  organes: Array<{ id: string; nom: string }>
  // Présentes seulement au niveau écriture.
  pieces: Array<{ id: string; designation: string; organeNom: string }> | null
}

export function FormulaireIntervention({ vehicleId, organes, pieces }: FormulaireInterventionProps) {
  const router = useRouter()
  const [resultat, action, enCours] = useActionState<Resultat | null, FormData>(creerInterventionAction, null)
  const retour = `/apps/garage/travaux?vehicule=${vehicleId}`
  const etat = useEtatSynchro()
  const moteur = useMoteurSynchro()
  const [local, setLocal] = useState<{ ok: boolean; texte: string } | null>(null)
  const [enregistrementLocal, setEnregistrementLocal] = useState(false)

  useEffect(() => {
    if (resultat?.ok) router.push(retour)
  }, [resultat, retour, router])

  // Hors ligne (D5) : seule l'intervention rapide sans pièce s'écrit sur l'appareil, et part au retour du réseau. En
  // ligne, le formulaire part comme avant (Server Action, redirection). Le serveur refait tous les contrôles à l'envoi.
  async function enregistrerHorsLigne(evenement: FormEvent<HTMLFormElement>) {
    if (etat.enLigne) return
    evenement.preventDefault()
    const formulaire = evenement.currentTarget
    const donnees = new FormData(formulaire)
    if (pieces && String(donnees.get("partId") ?? "") !== "") {
      setLocal({ ok: false, texte: "Pour utiliser une pièce, reviens en ligne." })
      return
    }
    setEnregistrementLocal(true)
    try {
      await moteur.ecrireLocal("garage_work_order", {
        type: "creer",
        id: newId(),
        champs: {
          vehicleId,
          vehicleComponentId: String(donnees.get("vehicleComponentId") ?? ""),
          titre: String(donnees.get("titre") ?? ""),
        },
      })
      formulaire.reset()
      setLocal({ ok: true, texte: "Intervention enregistrée sur cet appareil. Elle part dès que l'appareil est connecté." })
    } catch {
      setLocal({ ok: false, texte: "L'intervention n'a pas pu être enregistrée sur cet appareil." })
    } finally {
      setEnregistrementLocal(false)
    }
  }

  // Les pièces se regroupent par organe : le serveur vérifie que la pièce va bien sur l'organe choisi.
  const parOrgane = new Map<string, Array<{ id: string; designation: string }>>()
  for (const piece of pieces ?? []) {
    parOrgane.set(piece.organeNom, [...(parOrgane.get(piece.organeNom) ?? []), { id: piece.id, designation: piece.designation }])
  }

  return (
    <FormulairePage formulaireId="intervention-formulaire" annulerHref={retour} libelleBouton="Enregistrer l'intervention" libelleEnCours="Enregistrement…" enCours={enCours || enregistrementLocal}>
      <form id="intervention-formulaire" action={action} onSubmit={enregistrerHorsLigne} className="flex flex-col gap-5">
        <input type="hidden" name="vehicleId" value={vehicleId} />
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Organe</span>
          <select name="vehicleComponentId" required defaultValue="" className={CHAMP}>
            <option value="" disabled>
              Choisir l&apos;organe
            </option>
            {organes.map((organe) => (
              <option key={organe.id} value={organe.id}>
                {organe.nom}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Ce qui a été fait</span>
          <input name="titre" required maxLength={200} placeholder="Plaquettes avant changées" className={CHAMP} />
        </label>
        {pieces && (
          <>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Pièce utilisée (facultative)</span>
              <select name="partId" defaultValue="" className={CHAMP}>
                <option value="">Aucune pièce</option>
                {Array.from(parOrgane.entries()).map(([organeNom, liste]) => (
                  <optgroup key={organeNom} label={organeNom}>
                    {liste.map((piece) => (
                      <option key={piece.id} value={piece.id}>
                        {piece.designation}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <span className="text-texte-discret">Avec une pièce, elle est posée sur l&apos;organe. Sans pièce, l&apos;ordre est une réparation.</span>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Motif de dépose de la pièce en place (s&apos;il y en a une)</span>
              <select name="motifDepose" defaultValue="" className={CHAMP}>
                <option value="">Aucun, ou pas de pièce en place</option>
                {Object.entries(LIBELLE_MOTIF_DEPOSE).map(([cle, libelle]) => (
                  <option key={cle} value={cle}>
                    {libelle}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
      </form>
      <Message resultat={resultat} />
      {local && (
        <p role={local.ok ? "status" : "alert"} className={`text-sm ${local.ok ? "text-etat-ok" : "text-etat-rouge"}`}>
          {local.texte}
        </p>
      )}
    </FormulairePage>
  )
}
