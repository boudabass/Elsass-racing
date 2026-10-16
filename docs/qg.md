# Le QG

Enveloppe commune de l'espace connecté : `src/app/(app)/`. Le layout charge une fois les données de la requête (`src/core/qg/donnees.ts`, mis en cache par requête) et les passe en props. Aucune requête dans les composants.

## Composants (`src/components/qg/`)

- `barre-haute.tsx` : logo, saison, prochaine épreuve et compte à rebours, boîte d'actions, recherche, mode terrain, menu (déconnexion).
- `navigation.tsx` : colonne d'icônes sur PC, barre basse à quatre emplacements sur téléphone.
- `grille-qg.tsx` : une tuile par app visible. Badge d'actions, pastille d'alerte, ligne d'état.
- `boite-actions.tsx` et `conteneur-boite.tsx` : liste des actions (formulaires serveur), panneau latéral.
- `bouton-prochaine-etape.tsx` : bouton flottant, avec le pourquoi ou le compte à rebours.
- `bouton-plus.tsx` et `entrees-plus.ts` : menu « + », filtré par le rôle, entrées désactivées avec leur raison.
- `bandeau-terrain.tsx` : proposition du mode terrain le jour d'une épreuve.
- `raccourci-recherche.tsx` : Ctrl+K vers la recherche.
- `ecran-vide.tsx` : écran générique pour une page sans contenu.

## Pages

- `/qg` : la grille des apps visibles.
- `/apps/[cle]` : écran générique « arrive bientôt », ou refus d'accès avec la raison, ou 404 pour une clé inconnue.
- `/recherche?q=…` : recherche plein texte (`core_search_index`), filtrée par les apps visibles.

## Actions (`src/core/actions/formulaires.ts`)

`deciderAction`, `reporterAction` (passent par la garde), `basculerTerrainAction`, `refuserBandeauTerrainAction`. Les redirections sont faites hors des blocs `try`, pour que les erreurs reviennent au QG en clair.

## Cookies

| Nom | Contenu | Durée | Rôle |
|---|---|---|---|
| `er_terrain` | `1` ou `0` | 30 jours | Mode terrain actif |
| `er_bandeau_terrain` | date AAAA-MM-JJ | 1 jour | Bandeau « jour d'épreuve » refusé pour la journée |

Préférences non sensibles : pas de signature. Le mode terrain migrera vers les préférences de membre en 1.10.

## Thème

Tokens dans `src/app/globals.css` : clair par défaut sur `:root`, sombre avec la classe `dark` (thème par défaut de l'app, via next-themes). Les couleurs de team sont calculées côté serveur (`src/core/theme/variables.ts`) et injectées sur `<html>` ; elles sont éclaircies ou assombries pour atteindre un contraste de 4,5:1 sur le fond (`contraste.ts`). Les états (vert, orange, rouge) ne prennent jamais la couleur de la team.

Polices : Barlow (texte) et Barlow Condensed (titres, chiffres), via `next/font/google`.

## Données de démonstration

`pnpm donnees:koehling` : les données réelles de la team Koehling (véhicule, deux membres, saison 2026, neuf épreuves, engagements). Idempotent.
