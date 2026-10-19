import { notFound } from "next/navigation"

import { aAuMoins } from "@/core/droits/niveaux"

import { lireVehicule } from "../lectures-serveur"
import { dateEnToutesLettres } from "../libelles"
import { accesVoiture } from "../services-serveur"
import { FormulaireIdentite, PhotoPrincipale, type ValeursIdentite } from "./formulaire-identite"

const texteOuTiret = (valeur: string | number | null | undefined, unite = "") => (valeur === null || valeur === undefined || valeur === "" ? "—" : `${valeur}${unite}`)

// Onglet Identité : la fiche se lit sur la page, un champ vide affiche « — ». En écriture, « Modifier » ouvre le tiroir.
export async function PanneauIdentite({ ficheId }: { ficheId: string }) {
  const { niveau } = await accesVoiture("lecture")
  const fiche = await lireVehicule(ficheId)
  if (!fiche || !fiche.vehicule) notFound()
  const v = fiche.fiche
  const peutEcrire = aAuMoins(niveau, "ecriture")

  const valeurs: ValeursIdentite = {
    marque: v.marque ?? "",
    modele: v.modele ?? "",
    version: v.version ?? "",
    annee: v.annee?.toString() ?? "",
    cylindreeCm3: v.cylindreeCm3?.toString() ?? "",
    puissanceCh: v.puissanceCh?.toString() ?? "",
    poidsKg: v.poidsKg?.toString() ?? "",
    couleur: v.couleur ?? "",
    groupe: v.groupe ?? "",
    classe: v.classe ?? "",
    discipline: v.discipline ?? "",
    immatriculation: v.immatriculation ?? "",
    numeroSerie: v.numeroSerie ?? "",
    acheteLe: v.acheteLe ? v.acheteLe.toISOString().slice(0, 10) : "",
  }

  const lignesVehicule: Array<[string, string]> = [
    ["Marque", texteOuTiret(v.marque)],
    ["Modèle", texteOuTiret(v.modele)],
    ["Version", texteOuTiret(v.version)],
    ["Année", texteOuTiret(v.annee)],
    ["Cylindrée", texteOuTiret(v.cylindreeCm3, " cm³")],
    ["Puissance", texteOuTiret(v.puissanceCh, " ch")],
    ["Poids", texteOuTiret(v.poidsKg, " kg")],
    ["Couleur", texteOuTiret(v.couleur)],
    ["Groupe", texteOuTiret(v.groupe)],
    ["Classe", texteOuTiret(v.classe)],
    ["Discipline", texteOuTiret(v.discipline)],
  ]
  const lignesPapiers: Array<[string, string]> = [
    ["Immatriculation", texteOuTiret(v.immatriculation)],
    ["Numéro de série", texteOuTiret(v.numeroSerie)],
    ["Date d'achat", v.acheteLe ? dateEnToutesLettres(v.acheteLe) : "—"],
  ]

  return (
    <div className="flex flex-col gap-6">
      <PhotoPrincipale vehicleId={ficheId} fileId={fiche.vehicule.photoFileId} peutModifier={peutEcrire} />
      <div className="flex flex-col gap-6">
        <Liste titre="Le véhicule" lignes={lignesVehicule} />
        <Liste titre="Papiers et homologation" lignes={lignesPapiers} />
        {peutEcrire && <FormulaireIdentite vehicleId={ficheId} valeurs={valeurs} />}
      </div>
    </div>
  )
}

function Liste({ titre, lignes }: { titre: string; lignes: Array<[string, string]> }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-titre text-lg uppercase">{titre}</h2>
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {lignes.map(([libelle, valeur]) => (
          <div key={libelle} className="flex flex-col">
            <dt className="text-sm text-texte-discret">{libelle}</dt>
            <dd>{valeur}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
