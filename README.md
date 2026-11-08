# DISSONANCE — paroles & accords

Le carnet de chansons de DISSONANCE. Les paroles, les accords au bon endroit, la
transposition en un clic, les setlists de répèt' et de concert. Ça marche sur
téléphone, ça s'installe comme une app, et **ça fonctionne sans réseau** — parce
que les caves de répétition n'ont jamais eu de 4G.

👉 **[Ouvrir le carnet](https://niclaeysthomas-ctrl.github.io/carnet-accords/)**

## Pour les copains du groupe

1. Ouvre le lien ci-dessus sur ton téléphone.
2. Menu du navigateur → **« Ajouter à l'écran d'accueil »**. Voilà, c'est une app.
3. Écris tes chansons. Elles restent sur ton téléphone, personne d'autre n'y touche.
4. Pour en envoyer une : menu **⋯** → **Partager un lien**. La chanson entière
   tient dans l'adresse — celui qui clique l'ajoute à son carnet d'un bouton.
   Pas de compte, pas d'inscription, rien.

> **Important :** envoyer le lien de l'app ne partage *pas* tes chansons. Elles
> restent sur ton téléphone. Pour que tout le groupe les voie, il faut les
> mettre dans le répertoire commun — c'est expliqué dans l'app, onglet
> **Mode d'emploi → Partager au groupe**.

## Écrire une chanson

Quatre règles, et c'est tout :

```
## Couplet 1
[Am]Le texte va comme ça, [F]l'accord tombe sur la syllabe
[C]où tu le places dans la [G]ligne

## Refrain
> doucement, voix seule la première fois
[F]Refrain [C]refrain [G]refrain

## Pont
Am  F  C  G
```

| Syntaxe | Effet |
|---|---|
| `[Am]` | Un accord, collé à la syllabe où il tombe |
| `## Refrain` | Un titre de partie |
| `> doucement` | Une indication pour le groupe (nuance, arrangement) |
| `Am  F  C  G` | Une ligne d'accords seuls — reconnue toute seule |

L'aide est aussi dans l'app, en haut de l'écran : **Mode d'emploi**. Elle a deux
onglets — *Écrire une chanson* pour la syntaxe, et *Partager au groupe* pour
savoir qui voit quoi. Tout ce qui est expliqué ici est là-bas aussi, pour que
personne n'ait besoin de passer par GitHub.

## Ce qu'il y a dedans

- **Transposition** à la volée (− / +), sans toucher au texte ; « Figer » dans le
  menu ⋯ réécrit les accords pour de bon.
- **Capo** : bascule entre les accords qui *sonnent* et ceux que tu *plaques*.
- **Diagrammes de guitare** calculés pour n'importe quel accord, positions
  ouvertes quand elles existent, barrés sinon. **Clique un accord** dans les
  paroles : jusqu'à trois façons de le plaquer, et les notes en clair.
- **Défilement automatique** à vitesse réglable, pour jouer sans lâcher
  l'instrument.
- **Métronome** au tempo de la chanson.
- **Setlists** ordonnées, avec précédent / suivant pendant le concert,
  **minutage** du set, notes de la soirée, partage par lien, et **impression**
  en classeur (page de garde + un morceau par page).
- **Pistes audio** : enregistrement au micro (décompte de 4 temps, clic du
  métronome en option, vumètre), import de fichiers, étiquettes, repères posés
  dans la prise, lecture ralentie **sans changer la hauteur**.
- **Version de référence** par chanson, déposée dans [`audio/`](audio/) :
  tout le groupe l'entend dans l'app, et peut la garder hors-ligne.
- **Accordeur** intégré : il écoute la corde et dit de combien tu es à côté.
- **Mode scène** : paroles en grand, écran qui ne s'éteint pas.
- **Impression** propre en A4 pour les pupitres.
- **Hors-ligne** complet, et **export / import** en `.json` pour les sauvegardes.

## Le répertoire du groupe

Les chansons communes vivent dans [`repertoire.json`](repertoire.json), versionné
ici. Elles apparaissent dans l'app sous l'onglet **Répertoire du groupe**, en
lecture seule — chacun peut en faire sa copie pour la bidouiller dans son coin.

Trois façons d'en ajouter une :

- depuis l'app : menu **⋯** → **Proposer au répertoire du groupe** (ça ouvre une
  issue GitHub toute remplie, il n'y a plus qu'à envoyer) ;
- directement sur GitHub : éditer `repertoire.json` dans le navigateur et faire
  une pull request ;
- en local : modifier le fichier et pousser.

Le format d'une entrée :

```json
{
  "id": "un-identifiant-unique",
  "titre": "Le titre",
  "auteur": "Qui l'a écrite",
  "cle": "Am",
  "bpm": "92",
  "capo": 0,
  "tags": ["concert", "nouvelle"],
  "contenu": "## Couplet 1\n[Am]Les paroles avec les [F]accords"
}
```

Attention aux `\n` : dans du JSON, les retours à la ligne s'écrivent comme ça.

## Et les pistes audio ?

Au même endroit, en pire : dans le navigateur (IndexedDB), et **pas dans
l'export `.json`** — ce sont des fichiers, pas du texte. Pour garder une prise,
il faut l'exporter une par une (menu ⋯ de la piste). Compter ~1 Mo la minute.

## Où sont mes chansons ?

Dans le navigateur de ton téléphone (`localStorage`), pas sur un serveur. Donc :

- personne d'autre ne les voit tant que tu ne partages pas ;
- si tu vides les données du navigateur, elles partent avec ;
- **exporte de temps en temps** : Réglages → *Exporter tout (.json)*.

## Faire tourner l'app en local

Aucune dépendance, aucun build. Un serveur statique suffit :

```bash
python3 -m http.server 8000
```

Puis `http://localhost:8000`. (En `file://` le service worker ne se lance pas,
le reste fonctionne.)

## Sous le capot

HTML, CSS et JavaScript, sans framework ni dépendance — pour que ça soit encore
réparable dans cinq ans.

| Fichier | Rôle |
|---|---|
| `chords.js` | Lecture des accords, transposition, calcul des diagrammes |
| `app.js` | Données, sauvegarde, analyse du texte, rendu, partage |
| `views.js` | Routeur, bibliothèque, écran de lecture, défilement, métronome |
| `views2.js` | Éditeur, setlists, réglages, aide, import |
| `audio.js` | Pistes : stockage IndexedDB, enregistrement micro, formats |
| `views3.js` | Panneau des pistes, enregistreur, lecteur, fiche d'accord |
| `accordeur.js` | Détection de hauteur et écran de l'accordeur |
| `boot.js` | Démarrage, répertoire du groupe, service worker |
| `repertoire.json` | Le répertoire partagé |
| `audio/` | Les versions de référence du groupe |

## Mettre l'app à jour

Les fichiers sont appelés avec un `?v=` dans `index.html`, et `sw.js` porte le
même numéro. **Les deux doivent rester synchronisés** : c'est ce qui fait que
le groupe reçoit vraiment la nouvelle version au lieu de garder l'ancienne en
cache. Un changement de code = on monte le numéro aux deux endroits.

## La suite

Ce qui est prévu, et dans quel ordre : [ROADMAP.md](ROADMAP.md) — enregistrement
audio, pistes attachées aux chansons, accordeur, mode scène.

## Licence

MIT — voir [LICENSE](LICENSE). Le code est libre ; les chansons que vous y
mettez restent les vôtres.
