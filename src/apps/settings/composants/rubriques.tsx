import { notFound } from "next/navigation"

import { contexteQg } from "@/core/qg/donnees"
import { exigerAcces } from "@/core/droits/garde-serveur"
import { ActionDirecte } from "@/components/formulaire/action-directe"
import { ListeFiche } from "@/components/formulaire/liste-fiche"
import { TiroirAction } from "@/components/formulaire/tiroir"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CHAMP } from "@/lib/classes-formulaire"

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

// Une rubrique de la team : « Modifiable par » en tête. Chaque bloc se lit en fiche ; « Modifier » ouvre un tiroir.
// Pour qui n'a pas le niveau de gestion, la fiche reste lisible et la raison est écrite.
export async function RubriqueEquipe({ chemin }: { chemin: string }) {
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
  const principale = equipe.couleurPrincipale ?? "#D7141A"
  const secondaire = equipe.couleurSecondaire ?? "#F4F3F1"
  const discipline = equipe.disciplinePrincipale ?? "rallye"
  return (
    <div className="flex flex-col gap-8">
      <ListeFiche
        titre="La team"
        lignes={[
          ["Nom", equipe.nom],
          ["Discipline principale", DISCIPLINES.find((d) => d.valeur === discipline)?.libelle ?? discipline],
          ["Fuseau horaire", equipe.fuseau],
          ["Langue", "Français"],
          ["Couleurs", `${principale} et ${secondaire}`],
          ["Logo", equipe.logoFileId ? "Ajouté" : "Aucun"],
        ]}
      />
      {peutModifier ? (
        <TiroirAction libelle="Modifier l'identité" titre="Identité de la team" action={sauverIdentite} libelleBouton="Enregistrer">
          <div className="flex flex-col gap-2">
            <Label htmlFor="nom">Nom de la team</Label>
            <Input id="nom" name="nom" defaultValue={equipe.nom} required />
          </div>
          <ChampLogo valeur={equipe.logoFileId} />
          <ApercuCouleurs
            couleurPrincipale={principale}
            couleurSecondaire={secondaire}
            nomTeam={equipe.nom}
            logoFileId={equipe.logoFileId}
          />
          <div className="flex flex-col gap-2">
            <Label htmlFor="discipline">Discipline principale</Label>
            <select id="discipline" name="discipline" defaultValue={discipline} className={CHAMP}>
              {DISCIPLINES.map((d) => (
                <option key={d.valeur} value={d.valeur}>{d.libelle}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="fuseau">Fuseau horaire</Label>
            <select id="fuseau" name="fuseau" defaultValue={equipe.fuseau} className={CHAMP}>
              {FUSEAUX.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>
        </TiroirAction>
      ) : (
        <p className="text-sm text-texte-discret">{raison}</p>
      )}
      <JourEpreuve contexte={contexte} peutModifier={peutModifier} raison={raison} />
    </div>
  )
}

async function Association({ contexte, peutModifier, raison }: { contexte: Contexte; peutModifier: boolean; raison: string }) {
  const equipe = await lireEquipe(contexte)
  return (
    <div className="flex flex-col gap-8">
      <ListeFiche
        titre="L'association"
        lignes={[
          ["Nom", equipe.associationNom ?? "Non renseigné"],
          ["Forme juridique", equipe.formeJuridique ?? "Non renseignée"],
          ["Numéro d'inscription", equipe.associationRna ?? "Non renseigné"],
          ["Siège", equipe.associationSiege ?? "Non renseigné"],
        ]}
      />
      <ListeFiche
        titre="Signataire des conventions"
        lignes={[
          ["Nom", equipe.signataireNom ?? "Non renseigné"],
          ["Qualité", equipe.signataireQualite ?? "Non renseignée"],
        ]}
      />
      {peutModifier ? (
        <TiroirAction libelle="Modifier l'association" titre="Association et signataire" action={sauverAssociation} libelleBouton="Enregistrer">
          <div className="flex flex-col gap-2">
            <Label htmlFor="associationNom">Nom de l'association</Label>
            <Input id="associationNom" name="associationNom" defaultValue={equipe.associationNom ?? ""} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="formeJuridique">Forme juridique</Label>
            <Input
              id="formeJuridique"
              name="formeJuridique"
              placeholder="Par exemple : association de droit local d'Alsace-Moselle"
              defaultValue={equipe.formeJuridique ?? ""}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="associationRna">Numéro d'inscription</Label>
            <Input id="associationRna" name="associationRna" aria-describedby="associationRna-aide" defaultValue={equipe.associationRna ?? ""} />
            <p id="associationRna-aide" className="text-sm text-texte-discret">
              RNA, ou numéro du registre des associations du tribunal en Alsace-Moselle
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="associationSiege">Siège</Label>
            <Input id="associationSiege" name="associationSiege" defaultValue={equipe.associationSiege ?? ""} />
          </div>
          <fieldset className="flex flex-col gap-4 rounded-lg border border-bordure p-4">
            <legend className="px-1 font-medium">Signataire des conventions</legend>
            <div className="flex flex-col gap-2">
              <Label htmlFor="signataireNom">Nom</Label>
              <Input id="signataireNom" name="signataireNom" defaultValue={equipe.signataireNom ?? ""} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="signataireQualite">Qualité</Label>
              <Input
                id="signataireQualite"
                name="signataireQualite"
                placeholder="Par exemple : président, représentant habilité"
                defaultValue={equipe.signataireQualite ?? ""}
              />
            </div>
          </fieldset>
        </TiroirAction>
      ) : (
        <p className="text-sm text-texte-discret">{raison}</p>
      )}
    </div>
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
                  <TiroirAction libelle="Changer le rôle" titre={`Rôle de ${m.nom}`} action={changerRole} libelleBouton="Enregistrer le rôle">
                    <input type="hidden" name="membershipId" value={m.id} />
                    <label className="flex flex-col gap-1 text-sm">
                      <span className="font-medium">Rôle</span>
                      <select name="role" defaultValue={m.role} className={CHAMP}>
                        {ROLES.map((r) => (
                          <option key={r.valeur} value={r.valeur}>{r.libelle}</option>
                        ))}
                      </select>
                    </label>
                  </TiroirAction>
                  <TiroirAction
                    libelle="Retirer"
                    titre="Retirer ce membre"
                    action={retirerMembre}
                    libelleBouton="Retirer"
                    libelleEnCours="Retrait…"
                    danger
                    question={`${m.nom} ne fera plus partie de la team. Son historique reste.`}
                  >
                    <input type="hidden" name="membershipId" value={m.id} />
                  </TiroirAction>
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
                <span className="flex flex-wrap gap-2">
                  <ActionDirecte libelle="Renvoyer" action={renvoyerInvitationAction} champs={{ invitationId: i.id }} ok="Invitation renvoyée." />
                  <ActionDirecte libelle="Annuler" action={annulerInvitationAction} champs={{ invitationId: i.id }} ok="Invitation annulée." />
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="titre-rallye text-2xl">Inviter</h2>
        {peutModifier ? (
          <TiroirAction
            libelle="Inviter un membre"
            titre="Inviter un membre"
            action={inviterMembre}
            libelleBouton="Envoyer l'invitation"
            secondaire={false}
          >
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
              <select id="role" name="role" defaultValue="equipage" className={CHAMP}>
                {ROLES.map((r) => (
                  <option key={r.valeur} value={r.valeur}>{r.libelle}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="personneId">Personne de la team (sans compte)</Label>
              <select id="personneId" name="personneId" defaultValue="" className={CHAMP}>
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
          </TiroirAction>
        ) : (
          <p className="text-sm text-texte-discret">{raison}</p>
        )}
      </div>
    </div>
  )
}
