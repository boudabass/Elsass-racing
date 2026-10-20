import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ActionDirecte } from "@/components/formulaire/action-directe"
import { ListeFiche } from "@/components/formulaire/liste-fiche"
import { TiroirAction } from "@/components/formulaire/tiroir"
import { libelleRole } from "@/core/auth/libelles"
import type { ContexteTeam } from "@/core/contexte"
import { appsVisibles } from "@/core/sdk/apps-serveur"
import { CHAMP } from "@/lib/classes-formulaire"
import { prisma } from "@/lib/prisma"
import { adhesionsDuCompte, listerAppareils, listerExports, listerNotifications, listerSuppressions } from "../personnelles-serveur"
import { ludiqueEffectif } from "../regles-personnelles"
import { prefsMembre, ludiqueAfficheDansLaTeam } from "../preferences-serveur"
import {
  annulerSuppression,
  demanderExport,
  demanderSuppression,
  quitterTeam,
  reinitialiserDecouvertes,
  revoquerAppareil,
  sauverAffichage,
  sauverLudiqueEquipe,
  sauverNotifications,
  sauverTelephone,
} from "../actions-personnelles"

const dateCourte = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" })

const LIBELLE_THEME = { sombre: "Sombre", clair: "Clair", systeme: "Selon le système" } as const
const LIBELLE_TAILLE = { normale: "Normale", grande: "Grande" } as const
const LIBELLE_LUDIQUE = { comme_la_team: "Comme la team", oui: "Toujours", non: "Jamais" } as const

// Mention d'attente standard : un libellé court, et la raison en clair.
function Bientot({ raison }: { raison: string }) {
  return (
    <span className="inline-flex flex-col text-sm text-texte-discret">
      <span className="font-medium">Bientôt</span>
      <span>{raison}</span>
    </span>
  )
}

function EnTete({ titre, modifiablePar }: { titre: string; modifiablePar: string }) {
  return (
    <div className="flex flex-col gap-1">
      <h2 className="titre-rallye text-2xl">{titre}</h2>
      <p className="text-sm text-texte-discret">Modifiable par : {modifiablePar}</p>
    </div>
  )
}

// Notifications : par app visible, deux canaux (app, mail) et le regroupement. Push et SMS
// sont présents mais pas encore branchés. Lues ici, modifiées dans un tiroir.
export async function Notifications({ contexte }: { contexte: ContexteTeam }) {
  const apps = await appsVisibles(contexte)
  const lignes = await listerNotifications(contexte, apps)
  const prefs = await prefsMembre(contexte)
  const responsable = contexte.membership.role === "responsable"
  const heures =
    prefs.heuresCalmesDebut && prefs.heuresCalmesFin ? `de ${prefs.heuresCalmesDebut} à ${prefs.heuresCalmesFin}` : "non définies"

  return (
    <section className="flex flex-col gap-8">
      <EnTete titre="Notifications" modifiablePar="toi" />

      <section className="flex max-w-3xl flex-col gap-3">
        <h3 className="font-titre text-lg uppercase">Par app</h3>
        <ul className="flex flex-col gap-2">
          {lignes.map((ligne) => (
            <li key={ligne.appCle} className="flex flex-col gap-1 rounded-lg border border-bordure bg-surface p-4">
              <span className="font-medium">{ligne.nom}</span>
              <span className="text-sm text-texte-discret">
                Dans l'app : {ligne.app ? "oui" : "non"} · Par mail : {ligne.mail ? "oui" : "non"} ·{" "}
                {ligne.regroupement === "quotidien" ? "Un résumé par jour" : "Tout de suite"}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <div className="flex max-w-3xl flex-col gap-2 text-sm text-texte-discret">
        <p>Heures calmes : {heures}. Elles seront respectées dès que les notifications seront envoyées.</p>
        <p>Notification sur téléphone : <Bientot raison="Les notifications sur téléphone arrivent avec l'application mobile." /></p>
        <p>Notification par SMS : <Bientot raison="Les SMS arrivent plus tard." /></p>
      </div>

      <TiroirAction libelle="Modifier les notifications" titre="Notifications" action={sauverNotifications} libelleBouton="Enregistrer">
        {lignes.map((ligne) => (
          <fieldset key={ligne.appCle} className="flex flex-col gap-3 rounded-lg border border-bordure p-3">
            <legend className="px-1 font-medium">{ligne.nom}</legend>
            <label className="flex items-center gap-2">
              <input type="checkbox" name={`app_${ligne.appCle}`} value="1" defaultChecked={ligne.app} className="h-5 w-5" />
              <span>Dans l'app</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name={`mail_${ligne.appCle}`} value="1" defaultChecked={ligne.mail} className="h-5 w-5" />
              <span>Par mail</span>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Regroupement</span>
              <select name={`regroupement_${ligne.appCle}`} defaultValue={ligne.regroupement} className={CHAMP}>
                <option value="immediat">Tout de suite</option>
                <option value="quotidien">Un résumé par jour</option>
              </select>
            </label>
          </fieldset>
        ))}
        <fieldset className="grid grid-cols-2 gap-4">
          <legend className="mb-2 font-medium">Heures calmes</legend>
          <div className="flex flex-col gap-2">
            <Label htmlFor="heuresCalmesDebut">Début</Label>
            <Input id="heuresCalmesDebut" name="heuresCalmesDebut" type="time" defaultValue={prefs.heuresCalmesDebut ?? ""} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="heuresCalmesFin">Fin</Label>
            <Input id="heuresCalmesFin" name="heuresCalmesFin" type="time" defaultValue={prefs.heuresCalmesFin ?? ""} />
          </div>
        </fieldset>
      </TiroirAction>

      {responsable && (
        <section className="flex max-w-3xl flex-col gap-2 border-t border-bordure pt-6">
          <h3 className="font-semibold">Valeurs par défaut de la team</h3>
          <Bientot raison="Les valeurs par défaut de la team arrivent avec les notifications." />
        </section>
      )}
    </section>
  )
}

// Affichage : thème, taille du texte, mode terrain, ludique. Pour le responsable : le ludique
// de la team, et la réinitialisation des écrans d'accueil.
export async function Affichage({ contexte }: { contexte: ContexteTeam }) {
  const prefs = await prefsMembre(contexte)
  const equipeAffiche = await ludiqueAfficheDansLaTeam(contexte)
  const responsable = contexte.membership.role === "responsable"

  return (
    <section className="flex flex-col gap-8">
      <EnTete titre="Affichage" modifiablePar="toi" />

      <div className="flex max-w-xl flex-col gap-4">
        <ListeFiche
          titre="Mon affichage"
          lignes={[
            ["Thème", LIBELLE_THEME[prefs.theme]],
            ["Taille du texte", LIBELLE_TAILLE[prefs.tailleTexte]],
            ["Mode terrain", prefs.modeTerrain ? "Activé" : "Désactivé"],
            ["Trophées et paliers", LIBELLE_LUDIQUE[prefs.ludiqueAffiche]],
          ]}
        />
        <p className="text-sm text-texte-discret">
          {equipeAffiche
            ? "La team affiche les trophées et les paliers."
            : "La team a masqué les trophées et les paliers : tu ne peux pas les réafficher."}
        </p>
        <TiroirAction libelle="Modifier l'affichage" titre="Affichage" action={sauverAffichage} libelleBouton="Enregistrer">
          <div className="flex flex-col gap-2">
            <Label htmlFor="theme">Thème</Label>
            <select id="theme" name="theme" defaultValue={prefs.theme} className={CHAMP}>
              <option value="sombre">Sombre</option>
              <option value="clair">Clair</option>
              <option value="systeme">Selon le système</option>
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="tailleTexte">Taille du texte</Label>
            <select id="tailleTexte" name="tailleTexte" defaultValue={prefs.tailleTexte} className={CHAMP}>
              <option value="normale">Normale</option>
              <option value="grande">Grande</option>
            </select>
          </div>
          <label className="flex items-center gap-3">
            <input type="checkbox" name="modeTerrain" value="1" defaultChecked={prefs.modeTerrain} className="h-5 w-5" />
            <span>Mode terrain : gros boutons, pour le bord de route</span>
          </label>
          <div className="flex flex-col gap-2">
            <Label htmlFor="ludiqueAffiche">Trophées et paliers</Label>
            <select id="ludiqueAffiche" name="ludiqueAffiche" defaultValue={prefs.ludiqueAffiche} className={CHAMP}>
              <option value="comme_la_team">Comme la team</option>
              <option value="oui">Toujours</option>
              <option value="non">Jamais</option>
            </select>
          </div>
        </TiroirAction>
      </div>

      <section className="flex max-w-xl flex-col gap-2">
        <p className="text-sm text-texte-discret">Chaque app a un écran d'accueil à sa première ouverture. Tu peux le revoir.</p>
        <ActionDirecte
          libelle="Revoir les écrans d'accueil des apps"
          action={reinitialiserDecouvertes}
          ok="Les écrans reviendront à la prochaine ouverture de chaque app."
        />
      </section>

      {responsable && (
        <section className="flex max-w-xl flex-col gap-3 border-t border-bordure pt-6">
          <h3 className="font-semibold">Pour toute la team</h3>
          <p>Trophées et paliers pour toute la team : {equipeAffiche ? "affichés" : "masqués"}</p>
          <p className="text-sm text-texte-discret">
            {ludiqueEffectif(equipeAffiche, prefs.ludiqueAffiche) ? "Tu les vois." : "Tu ne les vois pas."} Si la team les masque, personne ne peut les réafficher.
          </p>
          <TiroirAction libelle="Modifier pour la team" titre="Trophées pour toute la team" action={sauverLudiqueEquipe} libelleBouton="Enregistrer">
            <label className="flex items-center gap-3">
              <input type="checkbox" name="ludiqueEquipe" value="1" defaultChecked={equipeAffiche} className="h-5 w-5" />
              <span>Afficher les trophées et les paliers pour toute la team</span>
            </label>
          </TiroirAction>
        </section>
      )}
    </section>
  )
}

// Appareils : mes appareils. Le responsable voit ceux de tous les membres de la team.
export async function Appareils({ contexte, appareilCourant }: { contexte: ContexteTeam; appareilCourant: string }) {
  const responsable = contexte.membership.role === "responsable"
  const appareils = await listerAppareils(contexte, appareilCourant, responsable)

  return (
    <section className="flex flex-col gap-6">
      <EnTete titre="Appareils" modifiablePar={responsable ? "toi, et le responsable pour les appareils de la team" : "toi"} />

      {appareils.length === 0 && <p className="text-texte-discret">Aucun appareil enregistré.</p>}
      <ul className="flex max-w-2xl flex-col gap-3">
        {appareils.map((appareil) => {
          const peutDeconnecter = appareil.estMien || responsable
          return (
            <li
              key={appareil.id}
              className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-surface p-4 ${
                appareil.estCetAppareil ? "border-marque" : "border-bordure"
              }`}
            >
              <div className="flex flex-col">
                <span className="font-medium">
                  {appareil.nom}
                  {appareil.estCetAppareil && <span className="ml-2 text-sm text-marque">Cet appareil</span>}
                </span>
                <span className="text-sm text-texte-discret">
                  {appareil.plateforme} · {responsable && !appareil.estMien ? `${appareil.proprietaire} · ` : ""}
                  Dernière activité : {dateCourte.format(appareil.derniereActivite)}
                </span>
              </div>
              {peutDeconnecter && (
                <TiroirAction
                  libelle={appareil.estCetAppareil ? "Me déconnecter d'ici" : "Déconnecter"}
                  titre={appareil.estCetAppareil ? "Me déconnecter d'ici" : "Déconnecter cet appareil"}
                  action={revoquerAppareil}
                  libelleBouton="Déconnecter"
                  libelleEnCours="Déconnexion…"
                  danger
                  question={
                    appareil.estCetAppareil
                      ? "Tu seras renvoyé à la connexion sur cet appareil."
                      : `${appareil.nom} sera déconnecté.`
                  }
                >
                  <input type="hidden" name="appareilId" value={appareil.id} />
                </TiroirAction>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

// Données et confidentialité : exports, suppression du compte, suppression de la team.
export async function Donnees({ contexte }: { contexte: ContexteTeam }) {
  const responsable = contexte.membership.role === "responsable"
  const exports = await listerExports(contexte, responsable)
  const suppressions = await listerSuppressions(contexte)
  const { email: emailDuCompte } = await prisma.coreUser.findUniqueOrThrow({
    where: { id: contexte.userId },
    select: { email: true },
  })

  return (
    <section className="flex flex-col gap-10">
      <EnTete titre="Données et confidentialité" modifiablePar="toi, et le responsable pour la team" />

      <p className="max-w-2xl text-texte-discret">Les données de la team sont hébergées en France.</p>

      <section className="flex max-w-2xl flex-col gap-3">
        <h3 className="font-semibold">Exporter mes données</h3>
        <div className="flex flex-wrap gap-3">
          <ActionDirecte libelle="Demander mes données" action={demanderExport} champs={{ perimetre: "personnel" }} ok="Demande enregistrée." />
          {responsable && (
            <ActionDirecte
              libelle="Demander l'export complet de la team"
              action={demanderExport}
              champs={{ perimetre: "equipe" }}
              ok="Demande enregistrée."
            />
          )}
        </div>
        <p className="text-sm text-texte-discret">Ta demande est enregistrée. Le fichier sera disponible ici.</p>
        {exports.length > 0 && (
          <ul className="flex flex-col gap-2 text-sm">
            {exports.map((e) => (
              <li key={e.id} className="rounded-md border border-bordure px-3 py-2">
                {e.perimetre === "equipe" ? "Export de la team" : "Mes données"} · {dateCourte.format(e.demandeeLe)} ·{" "}
                {libelleStatutExport(e.statut)}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex max-w-2xl flex-col gap-3 border-t border-bordure pt-6">
        <h3 className="font-semibold">Supprimer mon compte</h3>
        <p className="text-sm text-texte-discret">La suppression part après un délai de 30 jours. Tu peux l'annuler d'ici là.</p>
        <TiroirAction
          libelle="Demander la suppression du compte"
          titre="Supprimer mon compte"
          action={demanderSuppression}
          libelleBouton="Demander la suppression"
          danger
          question="La suppression part après un délai de 30 jours. Tu peux l'annuler d'ici là."
        >
          <input type="hidden" name="portee" value="compte" />
          <label className="flex flex-col gap-2 text-sm">
            <span>Tape ton adresse pour confirmer : {emailDuCompte}</span>
            <Input name="confirmation" placeholder="Ton adresse e-mail" autoComplete="off" />
          </label>
        </TiroirAction>
      </section>

      {responsable && (
        <section className="flex max-w-2xl flex-col gap-3 border-t border-bordure pt-6">
          <h3 className="font-semibold">Supprimer la team</h3>
          <p className="text-sm text-texte-discret">Un export automatique est préparé avant la suppression. Le délai de 30 jours est annulable.</p>
          <TiroirAction
            libelle="Demander la suppression de la team"
            titre="Supprimer la team"
            action={demanderSuppression}
            libelleBouton="Demander la suppression"
            danger
            question="Un export automatique est préparé avant la suppression. Le délai de 30 jours est annulable."
          >
            <input type="hidden" name="portee" value="team" />
            <label className="flex flex-col gap-2 text-sm">
              <span>Tape le nom de la team pour confirmer.</span>
              <Input name="confirmation" placeholder="Nom de la team" autoComplete="off" />
            </label>
          </TiroirAction>
        </section>
      )}

      {suppressions.length > 0 && (
        <section className="flex max-w-2xl flex-col gap-3">
          <h3 className="font-semibold">Demandes en cours</h3>
          <ul className="flex flex-col gap-2">
            {suppressions.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-bordure px-3 py-2">
                <span>
                  {s.portee === "compte" ? "Suppression du compte" : "Suppression de la team"} : purge prévue le{" "}
                  {dateCourte.format(s.purgePrevueAt)}
                </span>
                <ActionDirecte libelle="Annuler la demande" action={annulerSuppression} champs={{ demandeId: s.id }} ok="Demande annulée." />
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  )
}

function libelleStatutExport(statut: string): string {
  if (statut === "pret") return "prêt"
  if (statut === "en_cours") return "en préparation"
  if (statut === "erreur") return "en erreur"
  return "en attente"
}

// Mon compte : adresse en lecture seule, téléphone, teams et sortie d'une team.
export async function Compte({ contexte }: { contexte: ContexteTeam }) {
  const utilisateur = await prisma.coreUser.findUniqueOrThrow({
    where: { id: contexte.userId },
    select: { email: true, telephone: true },
  })
  const adhesions = await adhesionsDuCompte(contexte.userId)

  return (
    <section className="flex flex-col gap-8">
      <EnTete titre="Mon compte" modifiablePar="toi" />

      <div className="flex max-w-xl flex-col gap-4">
        <ListeFiche
          titre="Mes coordonnées"
          lignes={[
            ["Adresse e-mail", utilisateur.email],
            ["Téléphone", utilisateur.telephone ?? "Non renseigné"],
          ]}
        />
        <p className="text-sm text-texte-discret">Pour changer d'adresse, demande au responsable.</p>
        <TiroirAction libelle="Modifier le téléphone" titre="Téléphone" action={sauverTelephone} libelleBouton="Enregistrer">
          <div className="flex flex-col gap-2">
            <Label htmlFor="telephone">Téléphone</Label>
            <Input id="telephone" name="telephone" type="tel" autoComplete="tel" defaultValue={utilisateur.telephone ?? ""} placeholder="+33 6 00 00 00 00" />
          </div>
        </TiroirAction>
      </div>

      <section className="flex max-w-2xl flex-col gap-3 border-t border-bordure pt-6">
        <h3 className="font-semibold">Mes teams</h3>
        <ul className="flex flex-col gap-2">
          {adhesions.map((a) => (
            <li key={a.teamId} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-bordure bg-surface px-4 py-3">
              <span>
                <span className="font-medium">{a.teamNom}</span>{" "}
                <span className="text-sm text-texte-discret">{libelleRole(a.role)}</span>
              </span>
              <TiroirAction
                libelle="Quitter cette team"
                titre={`Quitter ${a.teamNom}`}
                action={quitterTeam}
                libelleBouton="Quitter la team"
                libelleEnCours="Sortie…"
                danger
                question="Tu n'auras plus accès à cette team. Ton historique et ta fiche restent."
              >
                <input type="hidden" name="teamId" value={a.teamId} />
              </TiroirAction>
            </li>
          ))}
        </ul>
        <p className="text-sm text-texte-discret">
          Quitter une team ne supprime ni ton historique ni ta fiche. Le dernier responsable doit d'abord nommer un autre responsable.
        </p>
      </section>
    </section>
  )
}
