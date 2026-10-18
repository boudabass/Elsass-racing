import { notFound } from "next/navigation"

import { contexteQg } from "@/core/qg/donnees"
import { exigerAcces } from "@/core/droits/garde-serveur"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { sauverAssociation, sauverIdentite, inviterMembre, renvoyerInvitationAction, annulerInvitationAction, changerRole, retirerMembre } from "../actions"
import { lireEquipe, listerInvitationsEnAttente, listerMembres, listerPersonnesLibres } from "../lectures-serveur"
import { estRubriqueEquipe, RUBRIQUES_EQUIPE } from "../rubriques"
import { ApercuCouleurs } from "./apercu-couleurs"
import { ChampLogo } from "./champ-logo"
import { Apps, Droits, JourEpreuve } from "./droits-apps"

const DISCIPLINES = [
  { valeur: "rallye", libelle: "Rallye" },
  { valeur: "slalom", libelle: "Slalom" },
  { valeur: "course_de_cote", libelle: "Course de côte" },
  { valeur: "circuit", libelle: "Circuit" },
  { valeur: "autre", libelle: "Autre" },
]
const FUSEAUX = ["Europe/Paris", "Europe/Berlin", "Europe/Brussels", "Europe/Madrid", "Europe/Rome", "Europe/London"]
const ROLES = [
  { valeur: "responsable", libelle: "Responsable" },
  { valeur: "equipage", libelle: "Équipage" },
  { valeur: "assistance", libelle: "Assistance" },
  { valeur: "invite", libelle: "Invité" },
]

// Une rubrique de la team : « Modifiable par » en tête, et les champs désactivés, avec la
// raison, pour qui n'a pas le niveau de gestion.
export async function RubriqueEquipe({ chemin, messageOk, erreur }: { chemin: string; messageOk: boolean; erreur?: string }) {
  if (!estRubriqueEquipe(chemin)) notFound()
  const { contexte } = await contexteQg()
  const { niveau } = await exigerAcces("settings", "lecture")
  const peutModifier = niveau === "gestion"
  const raison = "Réservé au responsable de la team."

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="titre-rallye text-2xl">{RUBRIQUES_EQUIPE.find((r) => r.chemin === chemin)?.libelle}</h2>
        <p className="text-sm text-texte-discret">Modifiable par : {peutModifier ? "toi" : "le responsable"}</p>
      </div>

      {messageOk && <p role="status" className="rounded-md border border-bordure bg-surface px-4 py-2">Enregistré.</p>}
      {erreur && (
        <p role="alert" className="rounded-md border border-etat-rouge bg-surface px-4 py-2 text-etat-rouge">
          {erreur}
        </p>
      )}

      {chemin === "identite" && <Identite contexte={contexte} peutModifier={peutModifier} raison={raison} />}
      {chemin === "association" && <Association contexte={contexte} peutModifier={peutModifier} raison={raison} />}
      {chemin === "membres" && <Membres contexte={contexte} peutModifier={peutModifier} raison={raison} />}
      {chemin === "droits" && <Droits contexte={contexte} peutModifier={peutModifier} raison={raison} />}
      {chemin === "apps" && <Apps contexte={contexte} peutModifier={peutModifier} raison={raison} />}
    </section>
  )
}

type Contexte = Awaited<ReturnType<typeof contexteQg>>["contexte"]

async function Identite({ contexte, peutModifier, raison }: { contexte: Contexte; peutModifier: boolean; raison: string }) {
  const equipe = await lireEquipe(contexte)
  return (
    <div className="flex flex-col gap-8">
      <form action={sauverIdentite} className="flex max-w-xl flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="nom">Nom de la team</Label>
          <Input id="nom" name="nom" defaultValue={equipe.nom} disabled={!peutModifier} required />
        </div>
        <ChampLogo valeur={equipe.logoFileId} disabled={!peutModifier} />
        <ApercuCouleurs
          couleurPrincipale={equipe.couleurPrincipale ?? "#D7141A"}
          couleurSecondaire={equipe.couleurSecondaire ?? "#F4F3F1"}
          nomTeam={equipe.nom}
          logoFileId={equipe.logoFileId}
          disabled={!peutModifier}
        />
        <div className="flex flex-col gap-2">
          <Label htmlFor="discipline">Discipline principale</Label>
          <select id="discipline" name="discipline" defaultValue={equipe.disciplinePrincipale ?? "rallye"} disabled={!peutModifier} className="cible-tactile rounded-md border border-bordure-champ bg-surface px-3">
            {DISCIPLINES.map((d) => (
              <option key={d.valeur} value={d.valeur}>{d.libelle}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="fuseau">Fuseau horaire</Label>
          <select id="fuseau" name="fuseau" defaultValue={equipe.fuseau} disabled={!peutModifier} className="cible-tactile rounded-md border border-bordure-champ bg-surface px-3">
            {FUSEAUX.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>
        <p className="text-sm text-texte-discret">Langue : français</p>
        {peutModifier ? (
          <button type="submit" className="cible-tactile w-fit rounded-md bg-marque px-5 py-2 font-medium text-marque-texte hover:opacity-90">Enregistrer</button>
        ) : (
          <p className="text-sm text-texte-discret">{raison}</p>
        )}
      </form>
      <JourEpreuve contexte={contexte} peutModifier={peutModifier} raison={raison} />
    </div>
  )
}

async function Association({ contexte, peutModifier, raison }: { contexte: Contexte; peutModifier: boolean; raison: string }) {
  const equipe = await lireEquipe(contexte)
  return (
    <form action={sauverAssociation} className="flex max-w-xl flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="associationNom">Nom de l'association</Label>
        <Input id="associationNom" name="associationNom" defaultValue={equipe.associationNom ?? ""} disabled={!peutModifier} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="formeJuridique">Forme juridique</Label>
        <Input
          id="formeJuridique"
          name="formeJuridique"
          placeholder="Par exemple : association de droit local d'Alsace-Moselle"
          defaultValue={equipe.formeJuridique ?? ""}
          disabled={!peutModifier}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="associationRna">Numéro d'inscription</Label>
        <Input
          id="associationRna"
          name="associationRna"
          aria-describedby="associationRna-aide"
          defaultValue={equipe.associationRna ?? ""}
          disabled={!peutModifier}
        />
        <p id="associationRna-aide" className="text-sm text-texte-discret">
          RNA, ou numéro du registre des associations du tribunal en Alsace-Moselle
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="associationSiege">Siège</Label>
        <Input id="associationSiege" name="associationSiege" defaultValue={equipe.associationSiege ?? ""} disabled={!peutModifier} />
      </div>
      <fieldset className="flex flex-col gap-4 rounded-lg border border-bordure p-4">
        <legend className="px-1 font-medium">Signataire des conventions</legend>
        <div className="flex flex-col gap-2">
          <Label htmlFor="signataireNom">Nom</Label>
          <Input id="signataireNom" name="signataireNom" defaultValue={equipe.signataireNom ?? ""} disabled={!peutModifier} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="signataireQualite">Qualité</Label>
          <Input
            id="signataireQualite"
            name="signataireQualite"
            placeholder="Par exemple : président, représentant habilité"
            defaultValue={equipe.signataireQualite ?? ""}
            disabled={!peutModifier}
          />
        </div>
      </fieldset>
      {peutModifier ? (
        <button type="submit" className="cible-tactile w-fit rounded-md bg-marque px-5 py-2 font-medium text-marque-texte hover:opacity-90">Enregistrer</button>
      ) : (
        <p className="text-sm text-texte-discret">{raison}</p>
      )}
    </form>
  )
}

async function Membres({ contexte, peutModifier, raison }: { contexte: Contexte; peutModifier: boolean; raison: string }) {
  const [membres, invitations, libres] = await Promise.all([
    listerMembres(contexte),
    listerInvitationsEnAttente(contexte),
    listerPersonnesLibres(contexte),
  ])
  const dernierResponsable = membres.filter((m) => m.role === "responsable" && m.statut === "actif").length <= 1

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <h2 className="titre-rallye text-2xl">Membres</h2>
        <ul className="flex flex-col gap-2">
          {membres.map((m) => (
            <li key={m.id} className="flex flex-col gap-2 rounded-md border border-bordure bg-surface p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium">{m.nom}</span>
                <span className="text-sm text-texte-discret">{m.email}</span>
              </div>
              <p className="text-sm text-texte-discret">
                {ROLES.find((r) => r.valeur === m.role)?.libelle ?? m.role} · dernière connexion : {m.derniereConnexion ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "short" }).format(m.derniereConnexion) : "jamais"}
              </p>
              {peutModifier && (
                <div className="flex flex-wrap items-center gap-2">
                  <form action={changerRole} className="flex items-center gap-2">
                    <input type="hidden" name="membershipId" value={m.id} />
                    <select name="role" defaultValue={m.role} className="cible-tactile rounded-md border border-bordure-champ bg-fond px-2">
                      {ROLES.map((r) => (
                        <option key={r.valeur} value={r.valeur}>{r.libelle}</option>
                      ))}
                    </select>
                    <button type="submit" className="cible-tactile rounded-md border border-bordure px-3 hover:bg-surface-2">Changer le rôle</button>
                  </form>
                  <form action={retirerMembre}>
                    <input type="hidden" name="membershipId" value={m.id} />
                    <button type="submit" className="cible-tactile rounded-md border border-bordure px-3 text-etat-rouge hover:bg-surface-2">Retirer</button>
                  </form>
                  {dernierResponsable && m.role === "responsable" && (
                    <span className="text-xs text-texte-discret">Nomme d&apos;abord un autre responsable pour retirer celui-ci.</span>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="titre-rallye text-2xl">Invitations en attente</h2>
        {invitations.length === 0 && <p className="text-texte-discret">Aucune invitation en attente.</p>}
        <ul className="flex flex-col gap-2">
          {invitations.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-bordure bg-surface p-3">
              <span>
                {i.email} · {ROLES.find((r) => r.valeur === i.role)?.libelle ?? i.role} · expire dans {i.joursRestants} j
              </span>
              {peutModifier && (
                <span className="flex gap-2">
                  <form action={renvoyerInvitationAction}>
                    <input type="hidden" name="invitationId" value={i.id} />
                    <button type="submit" className="cible-tactile rounded-md border border-bordure px-3 hover:bg-surface-2">Renvoyer</button>
                  </form>
                  <form action={annulerInvitationAction}>
                    <input type="hidden" name="invitationId" value={i.id} />
                    <button type="submit" className="cible-tactile rounded-md border border-bordure px-3 hover:bg-surface-2">Annuler</button>
                  </form>
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex max-w-xl flex-col gap-3">
        <h2 className="titre-rallye text-2xl">Inviter</h2>
        {peutModifier ? (
          <form action={inviterMembre} className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Adresse e-mail</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="telephone">Téléphone</Label>
              <Input id="telephone" name="telephone" disabled placeholder="Bientôt : les invitations par SMS arrivent plus tard" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="role">Rôle</Label>
              <select id="role" name="role" defaultValue="equipage" className="cible-tactile rounded-md border border-bordure-champ bg-surface px-3">
                {ROLES.map((r) => (
                  <option key={r.valeur} value={r.valeur}>{r.libelle}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="personneId">Personne de la team (sans compte)</Label>
              <select id="personneId" name="personneId" defaultValue="" className="cible-tactile rounded-md border border-bordure-champ bg-surface px-3">
                <option value="">Nouvelle personne</option>
                {libres.map((p) => (
                  <option key={p.id} value={p.id}>{p.prenom} {p.nom}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input name="prenom" placeholder="Prénom (si nouvelle personne)" />
              <Input name="nom" placeholder="Nom (si nouvelle personne)" />
            </div>
            <button type="submit" className="cible-tactile w-fit rounded-md bg-marque px-5 py-2 font-medium text-marque-texte hover:opacity-90">Envoyer l&apos;invitation</button>
          </form>
        ) : (
          <p className="text-sm text-texte-discret">{raison}</p>
        )}
      </div>
    </div>
  )
}
