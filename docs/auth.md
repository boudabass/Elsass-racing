# Authentification

## Flux

1. L'utilisateur saisit son adresse sur `/connexion`. Le compte est créé s'il n'existe pas.
2. Le serveur crée deux jetons : un lien (secret de 32 octets, valable 15 minutes) et un code à 6 chiffres (valable 10 minutes). Seuls leurs hachages SHA-256 sont stockés.
3. Un seul mail part, contenant le lien `/connexion/lien?t=…` et le code.
4. Tout jeton ouvert antérieur du même compte est invalidé.
5. Le lien est consommé par `GET /connexion/lien` : jeton marqué utilisé, cookie de session posé, redirection.
6. Le code est saisi sur `/connexion` : même consommation, même résultat.
7. Un jeton ne sert qu'une fois. Un second clic sur le même lien renvoie vers `/connexion?erreur=lien`.
8. Après 5 demandes par 15 minutes (par adresse IP et adresse e-mail), les demandes sont refusées.
9. Après 5 codes faux en 10 minutes pour une même adresse, les codes sont refusés pendant la fenêtre.
10. La session (`er_session`, JWT signé, 30 jours) pointe vers un appareil en base. Supprimer l'appareil coupe la session : le middleware vérifie la signature, les pages et actions vérifient l'appareil.

Team courante : cookie `er_team` (signé). Il est revérifié à chaque requête, contre l'adhésion active. Si le compte n'a qu'une team active, elle est choisie à la connexion.

## Cookies

| Nom | Contenu | Durée | Attributs |
|---|---|---|---|
| `er_session` | `userId`, `deviceId` | 30 jours | httpOnly, sameSite lax, secure hors développement |
| `er_team` | `teamId` | 30 jours | httpOnly, sameSite lax, secure hors développement |

## Variables d'environnement

Aucune valeur n'est documentée ici : voir `.env.example`.

| Variable | Obligatoire | Rôle |
|---|---|---|
| `DATABASE_URL` | oui | Connexion PostgreSQL |
| `SESSION_SECRET` | oui | Signature des sessions, 32 caractères minimum (refus sinon) |
| `APP_URL` | non (défaut `http://localhost:3000`) | Adresse publique, base du lien envoyé par mail |
| `SMTP_HOST` | non hors production | Serveur SMTP sortant. Absent hors production : le mail s'affiche dans la console |
| `SMTP_PORT` | non (défaut 587) | Port SMTP. 465 : TLS direct. Autres : STARTTLS imposé |
| `SMTP_USER` | non | Identifiant SMTP |
| `SMTP_PASSWORD` | non | Mot de passe SMTP. Un `$` doit être écrit `\$` (Next interprète les `$` comme des variables) |
| `MAIL_FROM` | non (défaut `Elsass Racing <info@theelsassisch.com>`) | Expéditeur |

En production, `SMTP_HOST` absent fait échouer le premier envoi : il n'y a jamais de repli console.

## Créer une team

```bash
pnpm team:creer --nom "Nom de la team" --slug nom-de-la-team --email adresse@exemple.fr
```

Crée la team, le compte, l'adhésion responsable active, et les 11 apps du catalogue. Refuse si le slug existe déjà.
