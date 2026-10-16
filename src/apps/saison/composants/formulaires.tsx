"use client"

import { useActionState, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { LIBELLE_MODE_PAIEMENT, LIBELLE_TYPE_EPREUVE, LIBELLE_TYPE_PROGRAMME } from "@/apps/saison/libelles"

import {
  ajouterProgrammeAction,
  ajouterSpecialeAction,
  annulerEpreuveAction,
  creerEpreuveAction,
  engagerVoitureAction,
  enregistrerPaiementAction,
  modifierInfosAction,
  modifierInscriptionAction,
  type Resultat,
} from "../actions"

// Formulaires de la fiche et du calendrier. Chacun appelle une Server Action et affiche le
// message français de la garde ou de la règle. Aucun écran ne compte sur une vérification CSS.

export const CHAMP =
  "min-h-11 w-full rounded-md border border-bordure bg-surface px-3 py-2 text-texte focus:outline-none focus:ring-2 focus:ring-marque"

export function Message({ resultat }: { resultat: Resultat | null }) {
  if (!resultat) return null
  return resultat.ok ? (
    <p role="status" className="text-sm text-etat-ok">
      Enregistré.
    </p>
  ) : (
    <p role="alert" className="text-sm text-etat-rouge">
      {resultat.message}
    </p>
  )
}

export function Champ({ libelle, children, id }: { libelle: string; children: ReactNode; id: string }) {
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id}>{libelle}</Label>
      {children}
    </div>
  )
}

const TYPES = Object.entries(LIBELLE_TYPE_EPREUVE).map(([valeur, libelle]) => ({ valeur, libelle }))

// Nouvelle épreuve : trois champs. Après création, la fiche s'ouvre.
export function FormulaireNouvelleEpreuve() {
  const router = useRouter()
  const [resultat, action, enCours] = useActionState(
    async (etat: Resultat | null, donnees: FormData) => {
      const suite = await creerEpreuveAction(etat, donnees)
      if (suite.ok && suite.id) router.push(`/apps/saison/epreuves/${suite.id}`)
      return suite
    },
    null,
  )
  return (
    <form action={action} className="flex flex-col gap-4">
      <Champ id="nom" libelle="Nom de l'épreuve">
        <Input id="nom" name="nom" required maxLength={200} className={CHAMP} />
      </Champ>
      <div className="grid gap-4 sm:grid-cols-2">
        <Champ id="dateDebut" libelle="Premier jour">
          <Input id="dateDebut" name="dateDebut" type="date" required className={CHAMP} />
        </Champ>
        <Champ id="dateFin" libelle="Dernier jour">
          <Input id="dateFin" name="dateFin" type="date" required className={CHAMP} />
        </Champ>
      </div>
      <Champ id="type" libelle="Type">
        <select id="type" name="type" required className={CHAMP} defaultValue="rallye">
          {TYPES.map((type) => (
            <option key={type.valeur} value={type.valeur}>
              {type.libelle}
            </option>
          ))}
        </select>
      </Champ>
      <Message resultat={resultat} />
      <Button type="submit" disabled={enCours} className="min-h-11">
        Ajouter l'épreuve
      </Button>
    </form>
  )
}

interface InfosEpreuve {
  lieu: string | null
  departement: string | null
  lienOfficiel: string | null
  championnat: string | null
  lienResultats: string | null
  engagementsOuverture: string | null
  engagementsCloture: string | null
  tarifNormal: number | null
  tarifLicencieAsa: number | null
  geolocalisationIncluse: boolean
  nbSpeciales: number | null
  kmChronometresPrevus: string | null
  kmTotal: string | null
  lieuParcAssistance: string | null
  adresseEnvoiDossier: string | null
}

const euros = (centimes: number | null) => (centimes === null ? "" : String(centimes / 100))

// Infos de la fiche épreuve (modifiables au niveau écriture). Les tarifs sont en euros à l'écran.
export function FormulaireInfos({
  eventId,
  valeurs,
  contacts,
  organisateurId,
  asaId,
}: {
  eventId: string
  valeurs: InfosEpreuve | null
  contacts: Array<{ id: string; nom: string }>
  organisateurId: string | null
  asaId: string | null
}) {
  const [resultat, action, enCours] = useActionState<Resultat | null, FormData>(modifierInfosAction, null)
  const v = valeurs
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="eventId" value={eventId} />
      <Champ id="organisateurContactId" libelle="Organisateur">
        <select id="organisateurContactId" name="organisateurContactId" defaultValue={organisateurId ?? ""} className={CHAMP}>
          <option value="">Aucun</option>
          {contacts.map((contact) => (
            <option key={contact.id} value={contact.id}>
              {contact.nom}
            </option>
          ))}
        </select>
      </Champ>
      <Champ id="asaContactId" libelle="ASA">
        <select id="asaContactId" name="asaContactId" defaultValue={asaId ?? ""} className={CHAMP}>
          <option value="">Aucune</option>
          {contacts.map((contact) => (
            <option key={contact.id} value={contact.id}>
              {contact.nom}
            </option>
          ))}
        </select>
      </Champ>
      <Champ id="lieu" libelle="Lieu">
        <Input id="lieu" name="lieu" defaultValue={v?.lieu ?? ""} className={CHAMP} />
      </Champ>
      <Champ id="departement" libelle="Département">
        <Input id="departement" name="departement" maxLength={3} defaultValue={v?.departement ?? ""} className={CHAMP} />
      </Champ>
      <Champ id="lienOfficiel" libelle="Lien officiel">
        <Input id="lienOfficiel" name="lienOfficiel" defaultValue={v?.lienOfficiel ?? ""} className={CHAMP} />
      </Champ>
      <Champ id="championnat" libelle="Championnat">
        <Input id="championnat" name="championnat" defaultValue={v?.championnat ?? ""} className={CHAMP} />
      </Champ>
      <Champ id="engagementsOuverture" libelle="Engagements : ouverture">
        <Input id="engagementsOuverture" name="engagementsOuverture" type="date" defaultValue={v?.engagementsOuverture ?? ""} className={CHAMP} />
      </Champ>
      <Champ id="engagementsCloture" libelle="Engagements : clôture">
        <Input id="engagementsCloture" name="engagementsCloture" type="date" defaultValue={v?.engagementsCloture ?? ""} className={CHAMP} />
      </Champ>
      <Champ id="tarifNormal" libelle="Tarif normal (€)">
        <Input id="tarifNormal" name="tarifNormal" inputMode="decimal" defaultValue={euros(v?.tarifNormal ?? null)} className={CHAMP} />
      </Champ>
      <Champ id="tarifLicencieAsa" libelle="Tarif licencié ASA (€)">
        <Input id="tarifLicencieAsa" name="tarifLicencieAsa" inputMode="decimal" defaultValue={euros(v?.tarifLicencieAsa ?? null)} className={CHAMP} />
      </Champ>
      <Champ id="nbSpeciales" libelle="Nombre de spéciales">
        <Input id="nbSpeciales" name="nbSpeciales" inputMode="numeric" defaultValue={v?.nbSpeciales ?? ""} className={CHAMP} />
      </Champ>
      <Champ id="kmChronometresPrevus" libelle="Km chronométrés prévus">
        <Input id="kmChronometresPrevus" name="kmChronometresPrevus" inputMode="decimal" defaultValue={v?.kmChronometresPrevus ?? ""} className={CHAMP} />
      </Champ>
      <Champ id="kmTotal" libelle="Km total">
        <Input id="kmTotal" name="kmTotal" inputMode="decimal" defaultValue={v?.kmTotal ?? ""} className={CHAMP} />
      </Champ>
      <Champ id="lieuParcAssistance" libelle="Parc d'assistance">
        <Input id="lieuParcAssistance" name="lieuParcAssistance" defaultValue={v?.lieuParcAssistance ?? ""} className={CHAMP} />
      </Champ>
      <Champ id="adresseEnvoiDossier" libelle="Adresse d'envoi du dossier">
        <Input id="adresseEnvoiDossier" name="adresseEnvoiDossier" defaultValue={v?.adresseEnvoiDossier ?? ""} className={CHAMP} />
      </Champ>
      <Champ id="lienResultats" libelle="Lien des résultats">
        <Input id="lienResultats" name="lienResultats" defaultValue={v?.lienResultats ?? ""} className={CHAMP} />
      </Champ>
      <label className="flex min-h-11 items-center gap-2 sm:col-span-2">
        <input type="checkbox" name="geolocalisationIncluse" defaultChecked={v?.geolocalisationIncluse ?? false} className="h-5 w-5" />
        Géolocalisation incluse
      </label>
      <div className="sm:col-span-2">
        <Message resultat={resultat} />
      </div>
      <Button type="submit" disabled={enCours} className="min-h-11 sm:col-span-2">
        Enregistrer les infos
      </Button>
    </form>
  )
}

// Annulation : en deux temps, pour ne pas la déclencher par erreur.
export function BoutonAnnulerEpreuve({ eventId }: { eventId: string }) {
  const [confirmer, setConfirmer] = useState(false)
  const [resultat, action, enCours] = useActionState<Resultat | null, FormData>(annulerEpreuveAction, null)
  if (resultat?.ok) return <p role="status" className="text-sm text-texte-discret">Épreuve annulée.</p>
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="eventId" value={eventId} />
      {!confirmer ? (
        <Button type="button" variant="outline" className="min-h-11" onClick={() => setConfirmer(true)}>
          Annuler l'épreuve
        </Button>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-sm">L'épreuve passera en annulée. Les engagements restent visibles.</p>
          <div className="flex gap-2">
            <Button type="submit" disabled={enCours} className="min-h-11 bg-etat-rouge">
              Confirmer l'annulation
            </Button>
            <Button type="button" variant="outline" className="min-h-11" onClick={() => setConfirmer(false)}>
              Garder l'épreuve
            </Button>
          </div>
        </div>
      )}
      <Message resultat={resultat} />
    </form>
  )
}

interface Choix {
  voitures: Array<{ id: string; nomCourt: string }>
  personnes: Array<{ id: string; prenom: string; nom: string }>
}

// Engager une voiture : voiture de course active, pilote et copilote parmi les personnes de la team.
export function FormulaireEngagement({ eventId, choix }: { eventId: string; choix: Choix }) {
  const [resultat, action, enCours] = useActionState<Resultat | null, FormData>(engagerVoitureAction, null)
  if (choix.voitures.length === 0) {
    return (
      <p className="text-sm text-texte-discret">
        Aucune voiture de course active. Crée-la depuis l'app Voiture, puis reviens engager l'épreuve.
      </p>
    )
  }
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-3">
      <input type="hidden" name="eventId" value={eventId} />
      <Champ id="vehicleId" libelle="Voiture">
        <select id="vehicleId" name="vehicleId" required className={CHAMP}>
          {choix.voitures.map((voiture) => (
            <option key={voiture.id} value={voiture.id}>
              {voiture.nomCourt}
            </option>
          ))}
        </select>
      </Champ>
      <Champ id="piloteId" libelle="Pilote">
        <select id="piloteId" name="piloteId" className={CHAMP} defaultValue="">
          <option value="">Aucun</option>
          {choix.personnes.map((personne) => (
            <option key={personne.id} value={personne.id}>
              {personne.prenom} {personne.nom}
            </option>
          ))}
        </select>
      </Champ>
      <Champ id="copiloteId" libelle="Copilote">
        <select id="copiloteId" name="copiloteId" className={CHAMP} defaultValue="">
          <option value="">Aucun</option>
          {choix.personnes.map((personne) => (
            <option key={personne.id} value={personne.id}>
              {personne.prenom} {personne.nom}
            </option>
          ))}
        </select>
      </Champ>
      <div className="sm:col-span-3">
        <Message resultat={resultat} />
      </div>
      <Button type="submit" disabled={enCours} className="min-h-11 sm:col-span-3">
        Engager la voiture
      </Button>
    </form>
  )
}

const MODES = Object.entries(LIBELLE_MODE_PAIEMENT).map(([valeur, libelle]) => ({ valeur, libelle }))

// Paiement : montant prérempli avec le montant dû (en euros). Le statut se met à jour seul.
export function FormulairePaiement({ entryId, montantDu, personnes }: { entryId: string; montantDu: number | null; personnes: Choix["personnes"] }) {
  const [resultat, action, enCours] = useActionState<Resultat | null, FormData>(enregistrerPaiementAction, null)
  const aujourdhui = new Date().toISOString().slice(0, 10)
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="entryId" value={entryId} />
      <Champ id="payeLe" libelle="Date du paiement">
        <Input id="payeLe" name="payeLe" type="date" required defaultValue={aujourdhui} className={CHAMP} />
      </Champ>
      <Champ id="mode" libelle="Mode de paiement">
        <select id="mode" name="mode" required className={CHAMP} defaultValue="virement">
          {MODES.map((mode) => (
            <option key={mode.valeur} value={mode.valeur}>
              {mode.libelle}
            </option>
          ))}
        </select>
      </Champ>
      <Champ id="montant" libelle="Montant payé (€)">
        <Input id="montant" name="montant" inputMode="decimal" required defaultValue={montantDu === null ? "" : String(montantDu / 100)} className={CHAMP} />
      </Champ>
      <Champ id="payeurPersonId" libelle="Payeur">
        <select id="payeurPersonId" name="payeurPersonId" className={CHAMP} defaultValue="">
          <option value="">Non précisé</option>
          {personnes.map((personne) => (
            <option key={personne.id} value={personne.id}>
              {personne.prenom} {personne.nom}
            </option>
          ))}
        </select>
      </Champ>
      <div className="sm:col-span-2">
        <Message resultat={resultat} />
      </div>
      <Button type="submit" disabled={enCours} className="min-h-11 sm:col-span-2">
        Enregistrer le paiement
      </Button>
    </form>
  )
}

interface Inscription {
  concurrentNom: string | null
  montantDu: number | null
  listeEngagesPubliee: boolean
  remarques: string | null
}

// Inscription de l'engagement : seulement les champs que le formulaire porte (montants inclus).
export function FormulaireInscription({ entryId, inscription }: { entryId: string; inscription: Inscription }) {
  const [resultat, action, enCours] = useActionState<Resultat | null, FormData>(modifierInscriptionAction, null)
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="entryId" value={entryId} />
      <Champ id="concurrentNom" libelle="Concurrent (association)">
        <Input id="concurrentNom" name="concurrentNom" defaultValue={inscription.concurrentNom ?? ""} className={CHAMP} />
      </Champ>
      <Champ id="montantDu" libelle="Montant dû (€)">
        <Input id="montantDu" name="montantDu" inputMode="decimal" defaultValue={euros(inscription.montantDu)} className={CHAMP} />
      </Champ>
      <label className="flex min-h-11 items-center gap-2 sm:col-span-2">
        <input type="checkbox" name="listeEngagesPubliee" defaultChecked={inscription.listeEngagesPubliee} className="h-5 w-5" />
        Liste des engagés publiée
      </label>
      <Champ id="remarques" libelle="Remarques">
        <Input id="remarques" name="remarques" defaultValue={inscription.remarques ?? ""} className={CHAMP} />
      </Champ>
      <div className="sm:col-span-2">
        <Message resultat={resultat} />
      </div>
      <Button type="submit" disabled={enCours} className="min-h-11 sm:col-span-2">
        Enregistrer l'inscription
      </Button>
    </form>
  )
}

export function FormulaireSpeciale({ eventId }: { eventId: string }) {
  const [resultat, action, enCours] = useActionState<Resultat | null, FormData>(ajouterSpecialeAction, null)
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-4">
      <input type="hidden" name="eventId" value={eventId} />
      <Champ id="numero" libelle="N°">
        <Input id="numero" name="numero" inputMode="numeric" required className={CHAMP} />
      </Champ>
      <Champ id="nom" libelle="Nom">
        <Input id="nom" name="nom" required maxLength={200} className={CHAMP} />
      </Champ>
      <Champ id="longueurKm" libelle="Longueur (km)">
        <Input id="longueurKm" name="longueurKm" inputMode="decimal" className={CHAMP} />
      </Champ>
      <Champ id="nbPassages" libelle="Passages">
        <Input id="nbPassages" name="nbPassages" inputMode="numeric" className={CHAMP} />
      </Champ>
      <div className="sm:col-span-4">
        <Message resultat={resultat} />
      </div>
      <Button type="submit" disabled={enCours} className="min-h-11 sm:col-span-4">
        Ajouter la spéciale
      </Button>
    </form>
  )
}

export function FormulaireProgramme({ eventId, specialesIds }: { eventId: string; specialesIds: Array<{ id: string; nom: string }> }) {
  const [resultat, action, enCours] = useActionState<Resultat | null, FormData>(ajouterProgrammeAction, null)
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="eventId" value={eventId} />
      <Champ id="type" libelle="Étape">
        <select id="type" name="type" required className={CHAMP} defaultValue="depart">
          {Object.entries(LIBELLE_TYPE_PROGRAMME).map(([valeur, libelle]) => (
            <option key={valeur} value={valeur}>
              {libelle}
            </option>
          ))}
        </select>
      </Champ>
      <Champ id="heurePrevue" libelle="Heure prévue">
        <Input id="heurePrevue" name="heurePrevue" type="datetime-local" className={CHAMP} />
      </Champ>
      <Champ id="stageId" libelle="Spéciale">
        <select id="stageId" name="stageId" className={CHAMP} defaultValue="">
          <option value="">Aucune</option>
          {specialesIds.map((stage) => (
            <option key={stage.id} value={stage.id}>
              {stage.nom}
            </option>
          ))}
        </select>
      </Champ>
      <Champ id="lieu" libelle="Lieu">
        <Input id="lieu" name="lieu" className={CHAMP} />
      </Champ>
      <div className="sm:col-span-2">
        <Message resultat={resultat} />
      </div>
      <Button type="submit" disabled={enCours} className="min-h-11 sm:col-span-2">
        Ajouter au programme
      </Button>
    </form>
  )
}
