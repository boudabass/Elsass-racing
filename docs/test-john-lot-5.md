# Test de John : lot 5 (Équipe)

Pour John. Où : l'app dev, team **« Team d'essai dev »** (https://elsass-racing-dev.theelsassisch.com). Ne pas tester sur la production.

Ce test ne vaut que lorsque la 5.2 est sur dev, après le feu vert de l'orchestrateur (voir `documentation/JOURNAL.md`). Pour l'instant : l'accueil de l'équipe, la fiche personne, et la lecture des licences et homologations dans « Prêt pour l'épreuve ? ». Les écrans Prochaine épreuve, Binômes et Vivier arrivent après ton retour sur ces deux écrans.

Chaque étape dit ce que tu fais, puis ce que tu dois voir. Si ce n'est pas ce qui est écrit, note l'écran et ce que tu vois, et envoie-le-moi.

## Avant de commencer

- Connecte-toi en responsable.
- Ouvre **Équipe** depuis le QG.

## Étape 1 : l'équipe en cartes

1. Tu dois voir une carte par personne de la team : initiales, prénom et nom, rôles, pastilles « Licence : … » et « Équipement : … » (le mot et la couleur ensemble ; « à compléter » si rien n'est saisi), et la réponse pour la prochaine épreuve.
2. Clique sur les filtres **Pilote**, **Copilote**, **Assistance**, **Bénévole** : seules les personnes de ce rôle restent. **Tous** les rappelle.
3. Un ancien membre (si la team en a un) n'est plus sur les cartes. Le bouton **Anciens membres** ouvre un tiroir avec son nom : son lien mène à sa fiche, et sa fiche garde son historique.

## Étape 2 : créer une personne

1. Clique sur **Nouvelle personne**. Le tiroir demande prénom, nom et rôle habituel. Remplis « Léa » « Test » « Assistance », puis **Ajouter la personne**.
2. Tu arrives sur sa fiche, onglet **Profil**. Les rôles et le début dans le sport auto se modifient avec **Modifier le profil**.
3. Revient à **L'équipe** : la carte de Léa est là.

## Étape 3 : licence et casque

1. Sur la fiche de Léa, onglet **Licences**, clique sur **Ajouter une licence** : type « Licence FFSA régionale », numéro, et une date **Valable jusqu'au** dans le passé ou dans le futur.
2. La licence apparaît avec son état (valide, à renouveler ou expiré) et sa date. Une date passée donne « expiré » sur la carte (« Licence : expiré »), et le mot se lit même sans la couleur.
3. Onglet **Équipement** : **Ajouter un équipement**, type « Casque », marque, et une fin d'homologation. Le casque apparaît.

## Étape 4 : disponibilité

1. Onglet **Disponibilités** : la prochaine épreuve de la saison est affichée, avec la réponse actuelle.
2. Clique sur **Répondre**, choisis **Vient**, **Enregistrer ma réponse**. La réponse s'affiche, et la carte de Léa sur L'équipe dit « Prochaine épreuve : vient ».

## Étape 5 : l'assistance ne gère pas le dossier d'un autre

1. Ouvre une fenêtre privée, connecte-toi avec un compte **assistance** de la team (lien d'invitation ou compte de test).
2. Dans **Équipe**, ouvre la fiche de Léa. L'onglet **Ressenti** n'existe pas.
3. Onglet **Licences**, clique sur **Modifier** : le tiroir dit « Tu ne peux gérer que ton propre dossier. », et le bouton **Enregistrer** est grisé.

## Étape 6 : « Prêt pour l'épreuve ? » suit les licences et les homologations

1. Dans **Saison**, ouvre l'épreuve de la team et un engagement dont le **pilote** a une licence saisie dans Équipe (étape 3).
2. Le panneau « Prêt pour l'épreuve ? » montre les points **Licences** et **Homologations** : **réglé** si le pilote et le copilote ont une licence et un équipement homologué valables le jour de l'épreuve.
3. Modifie la licence du pilote pour qu'elle expire avant l'épreuve (onglet Licences dans Équipe) : le point **Licences** repasse **ouvert**, avec la phrase « Licence de … expire le … ». Le lien **Régler** mène à la page de l'engagement dans Saison ; la correction se fait dans Équipe (la fiche de la personne, onglet Licences).
4. Un pilote sans aucune licence saisie : **ouvert**, « Licence de … non renseignée ».
5. L'indice de préparation de l'engagement tient compte de ces deux points tant qu'Équipe est activée pour la team.

## Ce qui n'est pas encore là

- Photo des personnes (les initiales tiennent lieu de photo pour l'instant).
- Document joint à une licence ou à un équipement.
- Statistiques après un résultat validé : à vérifier quand la prochaine épreuve sera jouée.
- Prochaine épreuve (présence, affectations, tâches), Binômes, Vivier, bouton **+** du menu : écrans suivants.
