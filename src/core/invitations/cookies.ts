// Secret d'une invitation mémorisé pendant la connexion : l'invité se connecte, puis
// l'acceptation reprend. Court, et à usage unique (accepteeAt).
export const COOKIE_INVITATION = "er_invitation"
export const DUREE_COOKIE_INVITATION_SECONDES = 10 * 60
