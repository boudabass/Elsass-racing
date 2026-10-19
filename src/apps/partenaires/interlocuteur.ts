// Interlocuteur d'un partenaire ou d'un prospect : deux champs, Prénom et Nom (brief 3.14, point 2). Ils vont ensemble,
// ou ils sont tous les deux vides (pas d'interlocuteur). Une saisie d'un seul des deux est refusée, avec la raison.
// La règle est ici, sans base, pour être testée à part des actions.

export type SaisieInterlocuteur = { ok: true; personne: { prenom: string; nom: string } | null } | { ok: false; message: string }

export function interlocuteurSaisi(prenom: string, nom: string): SaisieInterlocuteur {
  const prenomNet = prenom.trim()
  const nomNet = nom.trim()
  if (prenomNet === "" && nomNet === "") return { ok: true, personne: null }
  if (prenomNet === "") return { ok: false, message: "Indiquez aussi le prénom de l'interlocuteur, ou laissez les deux champs vides." }
  if (nomNet === "") return { ok: false, message: "Indiquez aussi le nom de l'interlocuteur, ou laissez les deux champs vides." }
  return { ok: true, personne: { prenom: prenomNet, nom: nomNet } }
}
