# Test de John : lot 5 (Équipe)

Pour John. Où : l'app dev, team **« Team d'essai dev »** (https://elsass-racing-dev.theelsassisch.com). Ne pas tester sur la production.

Ce test ne vaut que lorsque la 5.2 est sur dev, après le feu vert de l'orchestrateur (voir `documentation/JOURNAL.md`). Il couvre tout Équipe : l'équipe en cartes, la fiche personne, les licences et équipements, les disponibilités, le vivier, la prochaine épreuve, les binômes, et la lecture des licences dans « Prêt pour l'épreuve ? ».

Chaque étape dit ce que tu fais, puis ce que tu dois voir. Si ce n'est pas ce qui est écrit, note l'écran et ce que tu vois, et envoie-le-moi.

## Avant de commencer

- Connecte-toi en responsable.
- Ouvre **Équipe** depuis le QG. Le menu de l'app (sous le titre) mène à **L'équipe**, **Prochaine épreuve**, **Binômes** et **Vivier**.

## Étape 1 : l'équipe en cartes

1. Tu dois voir une carte par personne de la team : initiales, prénom et nom, rôles, pastilles « Licence : … » et « Équipement : … » (le mot et la couleur ensemble ; « à compléter » si rien n'est saisi), et la réponse pour la prochaine épreuve.
2. Sous le nom, le **palier** (Rookie, Confirmé…) et une petite barre vers le palier suivant, avec les chiffres **Épreuves** et **Arrivées**. Une personne neuve est Rookie, barre vide.
3. Clique sur les filtres **Pilote**, **Copilote**, **Assistance**, **Bénévole** : seules les personnes de ce rôle restent. **Tous** les rappelle.
4. Un ancien membre (si la team en a un) n'est plus sur les cartes. Le bouton **Anciens membres** ouvre un tiroir avec son nom : son lien mène à sa fiche, et sa fiche garde son historique.

## Étape 2 : créer une personne

1. Clique sur **Nouvelle personne**. Le tiroir demande prénom, nom et rôle habituel. Remplis « Léa » « Test » « Assistance », puis **Ajouter la personne**.
2. Tu arrives sur sa fiche, onglet **Profil**. La case **Afficher mes paliers et trophées dans l'équipe** est cochée par défaut. Les rôles et le début dans le sport auto se modifient avec **Modifier le profil**.
3. Onglet **Statistiques** : « 5 épreuves avant Confirmé », avec la barre. Le taux d'arrivée et le meilleur classement affichent « — » (pas encore d'épreuve).
4. Revient à **L'équipe** : la carte de Léa est là.
5. Depuis le bouton **+** du QG, choisis **Personne** : le tiroir de création s'ouvre directement.

## Étape 3 : licence, ASA, document, casque

1. Sur la fiche de Léa, onglet **Licences**, clique sur **Ajouter une licence** : type « Licence FFSA régionale », numéro, et une date **Valable jusqu'au** dans le passé ou dans le futur.
2. Champ **ASA** : la liste ne contient que les contacts de la team de catégorie ASA. Sans contact ASA, l'aide dit « Aucune ASA parmi les contacts de la team. ». Choisis-en un si tu en as un, sinon « Aucune ».
3. Champ **Document de la licence** : envoie une photo ou un PDF. Sur la licence, « Voir le document de la licence » ouvre le fichier dans un nouvel onglet.
4. La licence apparaît avec son état (valide, à renouveler ou expiré), sa date et son ASA. Une date passée donne « expiré » sur la carte (« Licence : expiré »), et le mot se lit même sans la couleur.
5. Onglet **Équipement** : **Ajouter un équipement**, type « Casque », marque, et une fin d'homologation. Le casque apparaît.

## Étape 4 : disponibilité

1. Onglet **Disponibilités** : la prochaine épreuve de la saison est affichée, avec la réponse actuelle.
2. Clique sur **Répondre**, choisis **Vient**, **Enregistrer ma réponse**. La réponse s'affiche, et la carte de Léa sur L'équipe dit « Prochaine épreuve : vient ».

## Étape 5 : le vivier

1. Menu de l'app, **Vivier**. Clique sur **Ajouter au vivier** : personne Léa, **Rôle recherché** « Logistique », intérêt, source, dernier contact et notes au besoin, puis **Ajouter**.
2. L'entrée apparaît : « Recherché : Logistique · Intérêt : … ». **Modifier** et **Retirer** sont là. Le vivier ne donne aucun droit : rien n'apparaît dans une autre app.

## Étape 6 : prochaine épreuve

1. Menu de l'app, **Prochaine épreuve** : le nom et la date de l'épreuve. Quatre listes de présence (Viennent, Peut-être, Ne viennent pas, Sans réponse) avec leurs compteurs, dont Léa dans « Viennent ».
2. **Équipage** : pilote et copilote tels que choisis dans Saison, avec **Voir l'engagement** (lien vers Saison). S'il n'y a pas d'engagement, le texte le dit.
3. **Affecter une personne** : Léa, rôle d'épreuve « Logistique », **Affecter**. Une ligne apparaît avec « Logistique » et une tâche liée « Logistique · à faire ».
4. Clique sur **Marquer fait** : la tâche passe à « Logistique · fait » et se barre. **Rouvrir** la remet à faire.
5. **Retirer** enlève l'affectation et sa tâche de la liste. Le pilote et le copilote ne s'affectent pas ici : ils se choisissent dans Saison.

## Étape 7 : binômes

1. Menu de l'app, **Binômes** : un binôme par pilote et copilote engagés ensemble, avec leurs chiffres (épreuves, arrivées…).
2. Sur la fiche d'un pilote ou d'un copilote, l'onglet **Binômes** existe ; sur la fiche de Léa (assistance), il n'existe pas.

## Étape 8 : l'assistance ne gère pas le dossier d'un autre

1. Ouvre une fenêtre privée, connecte-toi avec un compte **assistance** de la team (lien d'invitation ou compte de test).
2. Dans **Équipe**, ouvre la fiche de Léa. L'onglet **Ressenti** n'existe pas.
3. Onglet **Licences**, clique sur **Modifier** : le tiroir dit « Tu ne peux gérer que ton propre dossier. », et le bouton **Enregistrer** est grisé.

## Étape 9 : « Prêt pour l'épreuve ? » suit les licences et les homologations

1. Dans **Saison**, ouvre l'épreuve de la team et un engagement dont le **pilote** a une licence saisie dans Équipe (étape 3).
2. Le panneau « Prêt pour l'épreuve ? » montre les points **Licences** et **Homologations** : **réglé** si le pilote et le copilote ont une licence et un équipement homologué valables le jour de l'épreuve.
3. Modifie la licence du pilote pour qu'elle expire avant l'épreuve (onglet Licences dans Équipe) : le point **Licences** repasse **ouvert**, avec la phrase « Licence de … expire le … ». Le lien **Régler** mène à la fiche de la personne dans Équipe (onglet Licences), pas à Saison.
4. Un pilote sans aucune licence saisie : **ouvert**, « Licence de … non renseignée ».
5. L'indice de préparation de l'engagement tient compte de ces deux points tant qu'Équipe est activée pour la team.

## Étape 10 : « Prêt pour l'épreuve ? » suit les papiers de Voiture

1. Dans **Voiture**, ouvre la fiche du véhicule de l'engagement de l'étape 9, onglet **Papiers**, et ajoute une assurance dont la fin tombe avant l'épreuve.
2. Dans **Saison**, le panneau de cet engagement montre **Papiers** **ouvert**, avec la phrase « Assurance expire le … ». **Régler** mène à l'onglet Papiers de la fiche du véhicule.
3. Ajoute une assurance valable après l'épreuve : le point **Papiers** repasse **réglé** au retour dans Saison. Un papier sans date de fin ne bloque jamais.

## Étape 11 : Documents, le coffre-fort

1. Menu du QG, tuile **Documents** : trois compteurs (**Expirés ou à 7 jours**, **À 60 jours**, **À jour**) et une carte par dossier. Les sept dossiers types sont là une seule fois, même si tu crées plusieurs documents d'un coup.
2. Bouton **Document** : crée un document **Statuts de l'association**, type **Statuts de l'association**, dossier **Association**, avec un PDF. La carte **Association** affiche **1 sur 3**.
3. Crée un document **Assurance de l'association** dans **Assurances**, avec une date de validité dans cinq jours : le compteur **Expirés ou à 7 jours** passe à 1, et la fiche dit « Expire dans 5 jours ».
4. Ouvre les **Statuts**, clique sur **Remplacer le fichier**, ajoute une photo avec un commentaire : la fiche montre **Version 2** et l'aperçu de la photo. **Historique des versions (2)** liste la version 1, et son lien ouvre encore le PDF.
5. Clique sur **Archiver** dans la fiche des Statuts : la carte **Association** passe à **0 sur 3**, et le document apparaît dans **Archivés (1)** du dossier.
6. Ouvre une fenêtre privée avec un compte **assistance**. Le coffre ne montre ni **Association** ni **Assurances** ; le bouton **Dossier** n'existe pas, **Document** oui.
7. Avec ce compte, crée un document **Attestation de l'assistance** dans **Attestations** : il apparaît, et lui seul le voit.
8. Depuis ton compte, ouvre l'assurance, **Partager avec un membre**, choisis la personne de l'assistance (niveau **Lecture**). Dans la fenêtre privée, recharge le coffre : **Assurances** apparaît, et la fiche de l'assurance s'ouvre.
9. Sur téléphone (ou en réduisant la fenêtre à 360 px), le coffre, la liste d'un dossier et la fiche se lisent sans défilement horizontal, et les boutons se touchent au doigt.

## Étape 12 : Documents, échéances, tous les fichiers, partages

1. Crée (ou modifie) un document **Assurance de l'association** avec une date de validité dans vingt jours. Ouvre le QG, puis la **Boîte d'actions** : une action **Renouveler Assurance de l'association : expire le …** est là. Clique sur **Reporter d'une semaine** : elle disparaît de la boîte.
2. Menu de **Documents** : **Échéances**. Le document et la **Carte grise** de la Saxo sont dans **Bientôt**, avec leur bouton (**Renouveler**, **Ouvrir dans Voiture**). Le bouton **Renouveler** ouvre la fiche avec le tiroir d'ajout de fichier.
3. Ajoute un fichier, puis dans **Modifier**, mets une date de validité dans un an. L'échéance passe dans **À jour (1)** (le groupe se déplie dans un tiroir), et la boîte n'affiche plus l'action.
4. Menu **Tous les fichiers** : le justificatif d'une dépense Budget apparaît, avec son nom, son badge **Budget**, son rôle **Justificatif**, et un lien vers la fiche de la dépense. Les filtres **Application**, **Rôle** et **Ajouté par** changent l'adresse et la liste ; la pagination garde les filtres.
5. Sur la fiche d'un document, **Partager par lien** : destinataire **Préfecture**, durée **7 jours**. Le lien s'affiche une seule fois, avec **Copier le lien**. Ouvre-le dans une fenêtre privée : le titre et la validité s'affichent, et **Ouvrir le fichier** donne le fichier. Dans **Partages** (menu), le lien compte **1 ouverture**.
6. Dans **Partages**, **Révoquer** puis **Révoquer le lien** : le lien passe en **Révoqué** (grisé). Recharge le lien dans la fenêtre privée : « Ce lien n'est plus valable. », sans autre détail.
7. Avec un compte **assistance** : le menu de Documents n'a pas **Partages**, et la fiche d'un de ses documents n'a pas **Partager par lien**.

## Ce qui n'est pas encore là

- Photo des personnes (les initiales tiennent lieu de photo pour l'instant).
- Statistiques après un résultat validé : à vérifier quand la prochaine épreuve sera jouée.
- Trophées affichés pour les personnes déjà présentes avant ce lot : leur choix n'a pas changé (seul le défaut des nouvelles personnes est coché).
- Recherche globale dans les documents : pas encore branchée à l'index.
- Alertes d'échéance vers le QG : les actions viennent avec les check-lists (5.7).
- Nom de la personne qui a déposé une version quand son compte n'a pas de fiche : affiché « Un membre ».
