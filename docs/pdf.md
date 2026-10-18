# PDF

Outil commun pour produire des documents PDF côté serveur (brief 3.1b). Premier usage : le bilan de saison de Budget. Il servira aux bilans envoyés aux partenaires (3.7), à la convention générée (3.6), puis aux bulletins et au dossier de partenariat.

Code : `src/core/pdf/`. Bibliothèque : `@react-pdf/renderer` 4.9.0, en version exacte. Elle tourne en JavaScript, sans navigateur. `next.config.ts` la déclare dans `serverExternalPackages`.

## L'outil

- `document-team.tsx` : `DocumentTeam`, le document de base. Page A4 portrait, marges de 40 pt. En-tête : logo de la team (JPEG ou PNG seulement), nom, filet à la couleur de la team (rouge de l'app par défaut : `#b91c1c`). Pied de page sur chaque page : « Elsass Racing · date », « Page x sur y ».
- `composants.tsx` : `Titre`, `Intertitre`, `Paragraphe`, `ChiffresCles` (2 à 4 chiffres avec leur libellé), `Tableau` (colonnes en proportion, montants alignés à droite, ligne de total en gras, lignes zébrées très légères, une ligne jamais coupée entre deux pages).
- `rendu-serveur.ts` : `rendrePdf(element)` renvoie un `Buffer` ; `reponsePdf(octets, nomFichier)` renvoie une `Response` en `application/pdf`, avec `attachment`, `Cache-Control: no-store` et `X-Content-Type-Options: nosniff`.
- `logo-serveur.ts` : `lireLogoPourPdf(teamId, userId)` lit le logo par le service des fichiers (sans HTTP). Renvoie `null` si le logo est absent, en WebP ou SVG, ou introuvable sur le disque : le document sort alors sans logo, sans erreur.
- `texte.ts` : `textePdf(texte)`, voir « Espaces insécables ».
- `polices.ts` : enregistre les polices une fois, au chargement du module.
- `nom-fichier.ts` : `nomFichierPdf(parties)` fait un nom sans accents ni espaces, par exemple `bilan-koehling-racing-team-saison-2026.pdf`.

## Polices

Les polices de l'app, pour que le PDF ait la même allure que l'écran :

| Fichier (`public/polices-pdf/`) | Usage |
|---|---|
| `Barlow-Regular.ttf` (400) | texte |
| `Barlow-SemiBold.ttf` (600) | texte gras |
| `BarlowCondensed-Bold.ttf` (700) | titres |

Source : dépôt officiel `github.com/google/fonts`, dossiers `ofl/barlow` et `ofl/barlowcondensed`. Licence : SIL Open Font License 1.1, texte dans `OFL-Barlow.txt` et `OFL-BarlowCondensed.txt`, à côté des fichiers.

Le chemin part de `process.cwd()`. Le dossier `public/` est lisible par `next start` et copié dans l'image Docker (`COPY --from=builder /app/public`).

### Espaces insécables

`formatEuros` produit des espaces insécables. Barlow a le glyphe de U+00A0, mais pas celui de U+202F : sans correction, cette espace sortirait en carré ou en vide. `textePdf()` remplace U+00A0 et U+202F par une espace ordinaire. Le remplacement ne vaut que pour le PDF : l'écran n'est pas touché. Les composants (`Titre`, `Paragraphe`, `Tableau`, `ChiffresCles`) appliquent `textePdf()` tout seul ; le texte passé à `DocumentTeam` aussi.

## Limites

- Pas de logo WebP ni SVG dans un PDF : `lireLogoPourPdf` renvoie `null`, sans erreur. Pour un logo en SVG, il faudrait une version PNG ou JPEG.
- Coupure de mots désactivée (`registerHyphenationCallback`) : un mot long ne se coupe pas, il passe à la ligne.
- Les polices ne couvrent que le latin utilisé par l'app : un caractère hors de Barlow sort mal. Vérifier le glyphe avant d'ajouter un symbole.

## Ajouter un document

1. Écrire le composant dans `src/apps/<app>/pdf/<document>.tsx`, avec `DocumentTeam` et les composants communs. Le composant prend des données déjà lues, pas d'accès base.
2. Écrire la fonction de données pure, testée à part (comme `bilanSaison` dans `src/apps/budget/bilan.ts`).
3. Écrire la route : `export const dynamic = "force-dynamic"`, la garde de l'app (`accesEcran` ou `exigerAcces`, 403 sinon), les lectures, puis :
   ```ts
   const octets = await rendrePdf(createElement(MonDocument, { ... }))
   return reponsePdf(octets, nomFichierPdf(["mon-document", team.nom]))
   ```
   Une route `.ts` ne peut pas écrire de JSX : elle appelle `createElement`.
4. Tester : un test unitaire sur les données, et un test e2e qui vérifie l'en-tête `%PDF-` et le code de réponse.

## Tests

- `src/core/pdf/pdf.test.ts` : `textePdf`, et un rendu complet (en-tête `%PDF-`).
- `src/core/pdf/nom-fichier.test.ts` : noms de fichiers.
- `src/apps/budget/bilan.test.ts` : données du bilan.
- `e2e/budget-bilan.spec.ts` : téléchargement par le responsable, 403 pour l'assistance, saison vide, logo PNG dans le PDF, logo SVG sans logo.

`vitest.config.ts` active le runtime JSX automatique, pour que les tests puissent rendre les composants `.tsx`.

## Exemple

`docs/captures/bilan-saison-exemple.pdf` : bilan de la team de test préremplie, produit par `e2e/budget-bilan.spec.ts`. Il est régénéré à chaque suite e2e.
