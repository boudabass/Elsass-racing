# Test de John : lot 4 (Garage)

Pour John. Où : l'app dev, team **« Team d'essai dev »** (https://elsass-racing-dev.theelsassisch.com). Ne pas tester sur la production.

Le lot 4 est déployé sur dev après le run de vérification du 25/10 (voir `documentation/JOURNAL.md`). Le test suit l'ordre des choses dans une vraie semaine de team : atelier, pièces, pneus, casse, plan, équipements.

Chaque étape dit ce que tu fais, puis ce que tu dois voir. Si ce n'est pas ce qui est écrit, note l'écran et ce que tu vois, et envoie-le-moi.

## Avant de commencer

- Connecte-toi en responsable.
- Ouvre le **Garage** depuis le QG. La Saxo de la team est là, mais son atelier n'est pas encore préparé.

## Étape 1 : préparer l'atelier de la Saxo (4.3e)

1. Dans l'atelier, clique sur **Préparer l'atelier**.
2. Tu dois voir les organes de la voiture : moteur, embrayage, freins, amortisseurs, pneus, etc. Chacun a sa pièce d'origine, montée sans durée de vie.
3. Le texte « Renseigne la durée de vie de : » doit apparaître. C'est normal : rien n'est encore suivi en zone verte, orange ou rouge.
4. Clique sur un organe (par exemple les freins). Sa fiche s'ouvre.

## Étape 2 : réparer, remplacer, choisir où part l'ancienne pièce (4.3e)

1. Sur la fiche des freins, clique sur **Réparer**. Écris « Plaquettes avant : contrôle » dans « Ce qui est réparé ». Enregistre.
2. Tu dois voir la réparation dans **Travaux**.
3. Reviens sur la fiche des freins, clique sur **Remplacer**.
4. Choisis le motif de dépose (usure) et ce que devient l'ancienne pièce (par exemple « En réserve »). Ne laisse rien vide : les deux choix sont obligatoires quand une pièce est posée.
5. Enregistre. La pièce posée doit être la nouvelle, et l'ancienne doit partir où tu as choisi.

## Étape 3 : intervention rapide et commande (4.3)

1. Dans le bouton **+** du Garage, ouvre **Intervention** (si tu ne le trouves pas, dis-le-moi).
2. Choisis la Saxo, un organe occupé, et une pièce en stock si tu en as une.
3. Enregistre. Tu dois voir l'intervention dans Travaux, et la pièce posée sur la fiche de l'organe.
4. Menu **Commandes** : **Nouvelle commande**. Fournisseur, une ligne « Plaquettes avant », type Freins, 2 pièces à 12,50 €. Enregistre.
5. Clique sur **Marquer expédiée**, puis sur **Recevoir**.
6. Tu dois voir deux pièces reçues, en stock.
7. Va dans **Budget**, puis **À confirmer**. Une proposition « Pièces achetées (Garage) » de 25,00 € doit être là. Confirme-la.
8. Elle disparaît de « À confirmer » et doit apparaître dans les mouvements.

## Étape 4 : pneus et casse (4.4)

1. Menu **Pneus** du Garage : ajoute un train, puis monte-le sur l'organe Pneus. Saisis l'usure.
2. Dans **Saison**, ouvre une épreuve passée de la Saxo (ou une épreuve de test), onglet **Résultats**.
3. Saisis le résultat avec le statut **Abandon**, la cause et une spéciale d'abandon. Enregistre.
4. Un autre membre doit valider. Si tu es le seul responsable sur dev, dis-le-moi : je t'indiquerai comment le faire valider.
5. Menu **Casses** du Garage : la fiche de la casse est là, « À compléter ». Choisis le type, écris la cause, coche l'organe touché. Chaque organe affiche sa position comme dans l'atelier : tu dois voir « Freins · avant gauche », « Freins · arrière droit », etc., et jamais deux « Freins » identiques. Si un organe apparaît sans position alors qu'il en a une à l'atelier, dis-le-moi.
6. Clique sur **Ouvrir une réparation**. Le lien **Voir la réparation liée** doit mener à la réparation dans Travaux.

## Étape 5 : plan avant épreuve et zone rouge (4.5)

1. Menu **Plan avant épreuve** du Garage. Une ligne par organe, avec « Maintenant » et « Après l'épreuve ».
2. Va dans **Saison**, ouvre la prochaine épreuve de la Saxo, onglet **Prêt pour l'épreuve ?**.
3. Si un organe est en zone rouge, un bloc **À surveiller, sans effet sur l'indice** doit apparaître, sous les points.
4. L'indice de préparation (le pourcentage) ne doit pas bouger à cause de ce bloc.

## Étape 6 : équipements de la team (4.6)

1. Menu **Équipements** du Garage : tes équipements, par catégorie (remorque, outillage, levage, assistance, stand).
2. Clique sur **+** (en haut à droite), puis **Équipement**. Ajoute un équipement avec un contrôle dans moins de 30 jours. Il doit apparaître en « bientôt ».
3. Ouvre un équipement, clique sur **Modifier**, change une valeur, puis **Retirer** sur un équipement de test. Il disparaît de la liste.

## Passage avec un compte assistance (si tu en as un sur dev)

1. Connecte-toi avec un compte **assistance**.
2. Ouvre le Garage : tu dois voir l'atelier, le stock et le plan, **sans aucun prix ni valeur**.
3. Les boutons d'écriture, s'ils sont là, sont désactivés, et une phrase dit pourquoi.
4. Si tu n'as pas de compte assistance sur dev, dis-le-moi : je t'indiquerai comment en inviter un. Ne bloque pas le test pour ça.

## Ce que tu me renvoies

- Les étapes qui ont marché, avec un mot chacune.
- Pour chaque étape bloquée : l'écran, ce que tu as cliqué, ce que tu as vu. Une capture d'écran suffit.
- Tout texte qui te semble technique, ou qui dit « à changer » ou « à faire » pour un organe sans ordre.
