import Link from "next/link"

import { aAuMoins } from "@/core/droits/niveaux"
import { LIEN, BOUTON } from "@/lib/classes-formulaire"

import { lireReglages } from "../lectures-serveur"
import { LIBELLE_CONDITIONS, LIBELLE_REVETEMENT, dateEnToutesLettres, noteSur5 } from "../libelles"
import { accesVoiture } from "../services-serveur"
import { ListeReglages, type LigneReglage } from "./liste-reglages"

// Onglet Réglages : fiches de la plus récente à la plus ancienne, références à part, comparaison.
export async function PanneauReglages({ ficheId }: { ficheId: string }) {
  const { niveau } = await accesVoiture("lecture")
  const { fiches, references } = await lireReglages(ficheId)
  const peutContribuer = aAuMoins(niveau, "contribution")

  const lignes: LigneReglage[] = fiches.map((f) => ({
    id: f.id,
    dateLibelle: dateEnToutesLettres(f.date),
    epreuve: f.epreuve,
    conditions: f.conditions ? LIBELLE_CONDITIONS[f.conditions] : null,
    revetement: f.revetement ? LIBELLE_REVETEMENT[f.revetement] : null,
    note: f.note ? noteSur5(f.note) : null,
    auteur: f.auteur,
  }))
  const idsFiches = new Set(fiches.map((f) => f.id))

  return (
    <div className="flex flex-col gap-8">
      {peutContribuer && (
        <Link href={`/apps/voiture/vehicules/${ficheId}/reglages/nouveau`} className={`${BOUTON} w-full self-start sm:w-auto`}>
          Nouvelle fiche de réglage
        </Link>
      )}

      {lignes.length === 0 ? (
        <p className="text-texte-discret">Aucune fiche de réglage pour ce véhicule.</p>
      ) : (
        <ListeReglages base={`/apps/voiture/vehicules/${ficheId}`} lignes={lignes} />
      )}

      {references.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-titre text-lg uppercase">Réglages de référence</h2>
          <ul className="flex flex-col gap-1">
            {references.map((reference) => (
              <li key={reference.id}>
                {reference.creeDepuisSetupId && idsFiches.has(reference.creeDepuisSetupId) ? (
                  <Link href={`/apps/voiture/vehicules/${ficheId}/reglages/${reference.creeDepuisSetupId}`} className={LIEN}>
                    {reference.nom}
                  </Link>
                ) : (
                  <span>{reference.nom}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
