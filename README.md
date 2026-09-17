# Ducktective

Six décors, cinq petits canards en plastique à retrouver dans chacun :
30 canards au total.

1. Le salon douillet : coussin à soulever.
2. L'atelier à jouets : manivelle pour déplacer un bac métallique.
3. La serre au clair de lune : feuillage à écarter.
4. Le grenier des souvenirs : toit mansardé en bois, charpente apparente,
   deux lucarnes, chaise à bascule, échelle, quatre valises ouvrables,
   vieux coffres et drap à retirer.
5. La bibliothèque des secrets : étagère pivotante qui ouvre un véritable
   passage vers une petite pièce cachée, livres et coin lecture.
6. Le labyrinthe des canards perdus : couloirs de pierre, torches animées,
   six impasses, levier levant une dalle et cinq cachettes réparties entre
   des branches éloignées.

## Lancer le jeu

Depuis le dossier `Ducktective` (en conservant `js/`, `css/` et `assets/` ensemble) :

```sh
python3 -m http.server 8765
```

Ouvrir http://localhost:8765/findduck.html dans un navigateur de bureau récent.
Three.js 0.160.0 est chargé depuis jsDelivr ; les textures et modèles sont locaux.
Tous les chemins locaux sont relatifs : le dossier complet peut être déplacé
sans modifier le code. Le fichier d'entrée reste `findduck.html` pour conserver
les liens existants ; le titre de l'onglet et le menu affichent « Ducktective ».
Ouvrir le jeu via un serveur HTTP, pas en double-cliquant sur le fichier HTML.
Après une mise à jour, faire un rechargement forcé (`Cmd + Maj + R` sur Mac).
Dans le menu principal, « Choisir un niveau » permet de commencer directement
dans l'un des six décors. La partie continue ensuite vers les niveaux suivants.

## Commandes par défaut

- `Z Q S D` : déplacement ; souris : regard.
- Maintenir `Ctrl` : s'accroupir (déplacement plus lent). Il est possible de passer
  sous les établis, mais pas de se relever à travers un meuble.
- `E` : manipuler l'objet visé, à moins de 3,5 mètres : rangements,
  coussin, manivelle, feuillage, drap, valises, étagère, levier et lanterne.
- Clic gauche : ramasser uniquement le canard visé et visible, à moins de 3,5 mètres.
- `Échap` : pause. Les six touches et la sensibilité sont configurables depuis
  le menu initial ou le menu pause, et sauvegardées localement.

Chaque niveau possède deux rangements (un tiroir et un placard ou petit coffre)
contenant chacun un canard. Les trois autres se cachent dans le décor.
Chaque niveau propose aussi une mécanique spécifique masquant l'un des
canards : il faut la manipuler avant de pouvoir ramasser ce canard.
Une lanterne peut être allumée ou éteinte dans chaque décor.
Les objets mobiles arrêtent leur mouvement lorsque le joueur les gêne :
reculer un peu puis relancer l'interaction. `E` ne ramasse jamais de canard.
Les canards ont été réduits de 10 % supplémentaires. Les cachettes demandent
de contourner le mobilier, regarder derrière les livres ou fouiller le feuillage.
Sous la table du salon, il faut s'accroupir et regarder de côté. Dans les
rangements, du linge plié masque partiellement le canard décalé dans un coin.
Le labyrinthe ne possède plus d'emblèmes signalant les cachettes.

## Organisation

- `findduck.html` : menus et interface.
- `css/style.css` : présentation de l'interface.
- `js/game.js` : niveaux, mouvement, réglages et progression.
- `js/extra-levels.js` : décors et cachettes des niveaux 4 à 6.
- `js/attic.js` : architecture spécifique du grenier, textures procédurales
  de planches et de tapis, lucarnes et objets anciens.
- `js/maze.js` : génération déterministe du labyrinthe connecté et choix des impasses.
- `js/models.js` : objets détaillés, végétation, chargement des modèles GLB.
- `js/exploration-models.js` : coussin, tissus drapés, bac, valises articulées,
  feuillage mobile, lanternes et matériaux usés procéduraux.
- `js/exploration.js` : installation des six mécaniques et des lanternes.
- `js/environment.js` : lumières, vent, rideaux animés, gouttes sur les vitres,
  rayons lumineux et lucioles.
- `js/interactions.js` : rangements et objets manipulables, animations,
  collisions et visée avec occlusion.
- `assets/` : modèles et textures ; voir `assets/CREDITS.md` pour les licences.

Le rendu utilise des matériaux PBR, une occlusion ambiante SSAO, des ombres
2048 px, un bloom discret et de l'eau ondulante aux reflets d'environnement.
Le salon est éclairé au soleil couchant, l'atelier utilise des accents froids
et chauds, et la serre dispose d'un environnement de réflexion nocturne dédié.
Le grenier utilise une lumière chaude de lucarne, la bibliothèque des globes
suspendus, et le labyrinthe une ambiance nocturne avec des torches vacillantes.
Le grenier possède sa propre architecture (murs bas à 2,55 m, faîtage à 6,40 m)
et un éclairage de fin de journée, contrairement à la serre vitrée nocturne.
Ses plantes et sa chaise moderne ont été remplacées par des antiquités.
Ses murs sont réunis en un seul maillage pour limiter les appels de rendu.
La nouvelle passe de détail ajoute des doublures, sangles, poignées, coutures
et ferrures aux valises, des tissus à relief, du métal rayé et du cuir patiné.
Les lanternes diffusent une lumière chaude avec des ombres locales ; les rideaux
ondulent en conservant leur attache haute. Dans la serre, 96 gouttes animées
glissent sur les vitres, en un seul maillage instancié.

## Vérification

Les vues `?preview=1&level=0` à `?preview=1&level=5` servent à inspecter les
six décors. `?settings=1` ouvre les paramètres. Les fonctions de test navigateur
ne sont exposées qu'avec `?test=1` et ne sont pas activées pendant une partie normale.

Tests réalisés dans Chrome : chargement des GLB, accessibilité et collecte des
30 canards, occlusion des rangements fermés, douze animations de rangement,
collisions des portes, portée de prise, accroupissement, passage sous un établi,
pause, boutons des paramètres et persistance des raccourcis.
Sélection des six niveaux depuis le menu, conservation du choix après les
paramètres, lancement direct du labyrinthe et bilan adapté à une partie courte.
Pour le labyrinthe : connexion des 97 cases praticables, collisions contre les
murs et parcours physiques depuis le départ jusqu'aux cinq branches de cachettes.
Après la réduction et le renforcement des cachettes : trente parcours physiques
jusqu'aux positions de prise et trente collectes vérifiés, avec contrôle des
lignes de visée vers le corps et la tête depuis chacun des six points de départ.
Après la refonte du grenier : architecture distincte, deux lucarnes, trente
parcours et collectes revérifiés, ainsi que la progression des niveaux 4 à 6.
Après l'ajout des mécaniques : six canards verrouillés avant manipulation,
six mécanismes animés, quatre valises et six lanternes contrôlables vérifiés ;
trente parcours physiques et collectes revérifiés une fois les objets ouverts.
Les points d'interaction ont été contrôlés dans la zone accessible depuis le
départ avant ouverture, en laissant libre le volume balayé par les objets.
La touche `E` et le clic réel ont été testés sur les six mécaniques ; le
mouvement des rideaux et des 96 gouttes a été contrôlé sans erreur de rendu.
Après déplacement dans `html/jeux/find duck/Ducktective/` et renommage :
chargement des six niveaux depuis l'URL complète (y compris l'espace dans
`find duck`), modèles GLB, textures, styles et modules vérifiés sans erreur HTTP,
JavaScript ou de rendu. Les touches et la sensibilité restent sauvegardées
avec la clé historique, même après le changement de nom du jeu.
