"use client"

import { useActionState, type ReactNode } from "react"
import { useRouter } from "next/navigation"

import { FormulairePage } from "@/components/formulaire/formulaire-page"
import { Message } from "@/components/formulaire/message"
import { TiroirAction } from "@/components/formulaire/tiroir"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { LIBELLE_MODE_PAIEMENT, LIBELLE_TYPE_EPREUVE, LIBELLE_TYPE_PROGRAMME } from "@/apps/saison/libelles"
import { formatEuros } from "@/lib/euros"

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

// Formulaires de la fiche et du calendrier (brief 3.13b). Une saisie ouvre un tiroir ; la création d'épreuve reste sur sa
// page, qui finit comme un tiroir (barre du bas). Chaque écriture passe par une Server Action, et affiche le message
// français de la garde ou de la règle.

export { CHAMP } from "@/lib/classes-formulaire"
import { CHAMP } from "@/lib/classes-formulaire"

export { Message }

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
    <FormulairePage formulaireId="epreuve-formulaire" annulerHref="/apps/saison" libelleBouton="Ajouter l'épreuve" enCours={enCours}>
      <form id="epreuve-formulaire" action={action} className="flex flex-col gap-4">
        <Champ id="nom" libelle="Nom de l'épreuve">
          <Input id="nom" name="nom" required maxLength={200} className={CHAMP} />
        </Champ>
        <Champ id="dateDebut" libelle="Premier jour">
          <Input id="dateDebut" name="dateDebut" type="date" required className={CHAMP} />
        </Champ>
        <Champ id="dateFin" libelle="Dernier jour">
          <Input id="dateFin" name="dateFin" type="date" required className={CHAMP} />
        </Champ>
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
      </form>
    </FormulairePage>
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
  // Absents hors écriture (masquerMontants) : la fiche ne les affiche alors pas.
  tarifNormal?: number | null
  tarifLicencieAsa?: number | null
  geolocalisationIncluse: boolean
  nbSpeciales: number | null
  kmChronometresPrevus: string | null
  kmTotal: string | null
  lieuParcAssistance: string | null
  adresseEnvoiDossier: string | null
}

const euros = (centimes: number | null) => (centimes === null ? "" : String(centimes / 100))

const texte = (valeur: string | number | null | undefined) => (valeur === null || valeur === undefined || valeur === "" ? "—" : String(valeur))
const montant = (centimes: number | null | undefined) => (centimes === null || centimes === undefined ? "—" : formatEuros(centimes))

// Fiche en lecture des infos : tout ce que le formulaire porte, sans le formulaire. Les tarifs n'apparaissent que sous écriture.
export function FicheInfos({ valeurs }: { valeurs: InfosEpreuve }) {
  return (
    <dl className="grid gap-2 text-sm sm:grid-cols-2">
      <dt className="text-texte-discret">Lieu</dt>
      <dd>{texte(valeurs.lieu)}</dd>
      <dt className="text-texte-discret">Département</dt>
      <dd>{texte(valeurs.departement)}</dd>
      <dt className="text-texte-discret">Lien officiel</dt>
      <dd className="break-all">{texte(valeurs.lienOfficiel)}</dd>
      <dt className="text-texte-discret">Championnat</dt>
      <dd>{texte(valeurs.championnat)}</dd>
      <dt className="text-texte-discret">Engagements : ouverture</dt>
      <dd>{texte(valeurs.engagementsOuverture)}</dd>
      <dt className="text-texte-discret">Engagements : clôture</dt>
      <dd>{texte(valeurs.engagementsCloture)}</dd>
      {valeurs.tarifNormal !== undefined && (
        <>
          <dt className="text-texte-discret">Tarif normal</dt>
          <dd>{montant(valeurs.tarifNormal)}</dd>
        </>
      )}
      {valeurs.tarifLicencieAsa !== undefined && (
        <>
          <dt className="text-texte-discret">Tarif licencié ASA</dt>
          <dd>{montant(valeurs.tarifLicencieAsa)}</dd>
        </>
      )}
      <dt className="text-texte-discret">Nombre de spéciales</dt>
      <dd>{texte(valeurs.nbSpeciales)}</dd>
      <dt className="text-texte-discret">Km chronométrés prévus</dt>
      <dd>{texte(valeurs.kmChronometresPrevus)}</dd>
      <dt className="text-texte-discret">Km total</dt>
      <dd>{texte(valeurs.kmTotal)}</dd>
      <dt className="text-texte-discret">Parc d'assistance</dt>
      <dd>{texte(valeurs.lieuParcAssistance)}</dd>
      <dt className="text-texte-discret">Adresse d'envoi du dossier</dt>
      <dd>{texte(valeurs.adresseEnvoiDossier)}</dd>
      <dt className="text-texte-discret">Lien des résultats</dt>
      <dd className="break-all">{texte(valeurs.lienResultats)}</dd>
      <dt className="text-texte-discret">Géolocalisation incluse</dt>
      <dd>{valeurs.geolocalisationIncluse ? "Oui" : "Non"}</dd>
    </dl>
  )
}

// Infos de la fiche épreuve : la fiche se lit sur la page (FicheInfos), « Modifier les infos » ouvre ce tiroir (brief 3.13b).
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
  const v = valeurs
  return (
    <TiroirAction
      libelle="Modifier les infos"
      titre="Modifier les infos de l'épreuve"
      action={modifierInfosAction}
      libelleBouton="Enregistrer les infos"
      libelleEnCours="Enregistrement…"
    >
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
      <label className="flex min-h-11 items-center gap-2">
        <input type="checkbox" name="geolocalisationIncluse" defaultChecked={v?.geolocalisationIncluse ?? false} className="h-5 w-5" />
        Géolocalisation incluse
      </label>
    </TiroirAction>
  )
}

// Annulation : un tiroir de confirmation, pour ne pas la déclencher par erreur.
export function BoutonAnnulerEpreuve({ eventId }: { eventId: string }) {
  return (
    <TiroirAction
      libelle="Annuler l'épreuve"
      titre="Annuler l'épreuve"
      action={annulerEpreuveAction}
      libelleBouton="Confirmer l'annulation"
      libelleEnCours="Annulation…"
      danger
      question="L'épreuve passera en annulée. Les engagements restent visibles."
    >
      <input type="hidden" name="eventId" value={eventId} />
    </TiroirAction>
  )
}

interface Choix {
  voitures: Array<{ id: string; nomCourt: string }>
  personnes: Array<{ id: string; prenom: string; nom: string }>
}

// Engager une voiture : voiture de course active, pilote et copilote parmi les personnes de la team.
export function FormulaireEngagement({ eventId, choix }: { eventId: string; choix: Choix }) {
  if (choix.voitures.length === 0) {
    return (
      <p className="text-sm text-texte-discret">
        Aucune voiture de course active. Crée-la depuis l'app Voiture, puis reviens engager l'épreuve.
      </p>
    )
  }
  return (
    <TiroirAction libelle="Engager une voiture" titre="Engager une voiture" action={engagerVoitureAction} libelleBouton="Engager la voiture" libelleEnCours="Engagement…">
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
    </TiroirAction>
  )
}

const MODES = Object.entries(LIBELLE_MODE_PAIEMENT).map(([valeur, libelle]) => ({ valeur, libelle }))

// Paiement : montant prérempli avec le montant dû (en euros). Le statut se met à jour seul.
export function FormulairePaiement({ entryId, montantDu, personnes }: { entryId: string; montantDu: number | null; personnes: Choix["personnes"] }) {
  const aujourdhui = new Date().toISOString().slice(0, 10)
  return (
    <TiroirAction libelle="Enregistrer un paiement" titre="Enregistrer un paiement" action={enregistrerPaiementAction} libelleBouton="Enregistrer le paiement" libelleEnCours="Enregistrement…">
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
    </TiroirAction>
  )
}

interface Inscription {
  concurrentNom: string | null
  montantDu: number | null
  listeEngagesPubliee: boolean
  remarques: string | null
}

// Fiche en lecture de l'inscription (montants inclus, sous écriture seulement).
export function FicheInscription({ inscription }: { inscription: Inscription }) {
  return (
    <dl className="grid gap-2 text-sm sm:grid-cols-2">
      <dt className="text-texte-discret">Concurrent</dt>
      <dd>{texte(inscription.concurrentNom)}</dd>
      <dt className="text-texte-discret">Montant dû</dt>
      <dd>{montant(inscription.montantDu)}</dd>
      <dt className="text-texte-discret">Liste des engagés publiée</dt>
      <dd>{inscription.listeEngagesPubliee ? "Oui" : "Non"}</dd>
      <dt className="text-texte-discret">Remarques</dt>
      <dd>{texte(inscription.remarques)}</dd>
    </dl>
  )
}

// Inscription de l'engagement : seulement les champs que le formulaire porte (montants inclus). La fiche se lit sur la page (FicheInscription).
export function FormulaireInscription({ entryId, inscription }: { entryId: string; inscription: Inscription }) {
  return (
    <TiroirAction
      libelle="Modifier l'inscription"
      titre="Modifier l'inscription"
      action={modifierInscriptionAction}
      libelleBouton="Enregistrer l'inscription"
      libelleEnCours="Enregistrement…"
    >
      <input type="hidden" name="entryId" value={entryId} />
      <Champ id="concurrentNom" libelle="Concurrent (association)">
        <Input id="concurrentNom" name="concurrentNom" defaultValue={inscription.concurrentNom ?? ""} className={CHAMP} />
      </Champ>
      <Champ id="montantDu" libelle="Montant dû (€)">
        <Input id="montantDu" name="montantDu" inputMode="decimal" defaultValue={euros(inscription.montantDu)} className={CHAMP} />
      </Champ>
      <label className="flex min-h-11 items-center gap-2">
        <input type="checkbox" name="listeEngagesPubliee" defaultChecked={inscription.listeEngagesPubliee} className="h-5 w-5" />
        Liste des engagés publiée
      </label>
      <Champ id="remarques" libelle="Remarques">
        <Input id="remarques" name="remarques" defaultValue={inscription.remarques ?? ""} className={CHAMP} />
      </Champ>
    </TiroirAction>
  )
}

export function FormulaireSpeciale({ eventId }: { eventId: string }) {
  return (
    <TiroirAction libelle="Ajouter une spéciale" titre="Ajouter une spéciale" action={ajouterSpecialeAction} libelleBouton="Ajouter la spéciale" libelleEnCours="Ajout…">
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
    </TiroirAction>
  )
}

export function FormulaireProgramme({ eventId, specialesIds }: { eventId: string; specialesIds: Array<{ id: string; nom: string }> }) {
  return (
    <TiroirAction libelle="Ajouter au programme" titre="Ajouter au programme" action={ajouterProgrammeAction} libelleBouton="Ajouter au programme" libelleEnCours="Ajout…">
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
    </TiroirAction>
  )
}
