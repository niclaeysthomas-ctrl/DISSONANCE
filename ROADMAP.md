# Feuille de route — le carnet de DISSONANCE

L'idée : que chaque étape soit utilisable le jour où elle sort, et qu'aucune
n'oblige à tout refaire derrière. On avance dans l'ordre, on s'arrête quand
ça suffit.

---

## ✅ Étape 0 — Les bases (en ligne)

Ce qui marche déjà : paroles avec accords à la syllabe, parties et indications
scéniques, transposition et capo à l'affichage, diagrammes de guitare calculés,
défilement automatique, métronome, setlists ordonnées, impression A4, partage
par lien, répertoire commun versionné, hors-ligne complet, installable.

---

## ✅ Étape 1 — S'enregistrer dans l'app

*En ligne.* Le navigateur sait enregistrer le micro, on n'a eu besoin de personne.

- Bouton **micro** sur une chanson : décompte de 4 temps, vumètre, puis ça tourne.
- Plusieurs prises par chanson, datées, renommables, supprimables.
- Lecteur : lecture / pause, position, **vitesse ralentie** sans changer la
  hauteur (pour repiquer un passage).
- Enregistrer **avec le métronome** dans le casque.
- Tout reste sur l'appareil (IndexedDB) : ça marche hors-ligne, rien n'est
  envoyé nulle part.

**À savoir :** environ **1 Mo par minute**. Le navigateur accepte facilement
plusieurs centaines de Mo — soit des heures de prises. Mais comme les paroles :
c'est sur ton téléphone, donc à exporter de temps en temps.

---

## ✅ Étape 2 — Importer et ranger l'audio

*En ligne.*

- Déposer un fichier existant (`.m4a`, `.mp3`, `.wav`) depuis le téléphone ou
  l'ordi : la maquette du studio, un enregistrement de répète.
- Étiqueter chaque piste : *idée · maquette · répète · live · référence*.
- Un lecteur qui **reste en bas de l'écran** pendant qu'on lit les paroles.
- Des **repères** calés sur les parties : sauter directement au refrain.

---

## ✅ Étape 3 — Faire circuler l'audio, sans serveur

*En ligne.* L'export d'une piste en fichier, et la **version de référence**
déposée dans `audio/` : elle s'affiche en tête des pistes de la chanson, se lit
en ligne, et le bouton ⤓ la range sur l'appareil pour la cave de répète.

- **Exporter une prise** en fichier : ça part dans la conversation du groupe.
- **Version de référence dans le dépôt** : une ou deux par chanson, en format
  léger, commitées comme les paroles. Tout le monde les a dans l'app, même
  hors-ligne, et les corrections suivent.

**Les limites, franchement :** le dépôt est public, donc une référence déposée
là est écoutable par n'importe qui. Et il y a un plafond (~1 Go en tout). Donc
oui pour les versions abouties qu'on assume, non pour les brouillons.

---

## ☁️ Étape 4 — La vraie synchronisation (seulement si besoin)

Pour que les prises de chacun arrivent automatiquement chez les autres, il faut
un endroit où les déposer. C'est la seule étape qui demande un compte et un peu
d'argent.

- **Stockage privé** (Cloudflare R2, Supabase) : chacun enregistre, tout le
  monde reçoit. Quelques euros par mois à notre échelle, et un accès privé —
  plus rien de public.
- **Ou rien** : on reste au fichier envoyé à la main.

Mon conseil : ne pas y toucher avant d'avoir vécu avec les étapes 1 à 3, qui
sont maintenant toutes en ligne. Il y a de bonnes chances que ça suffise.

---

## 🎸 Étape 5 — Le confort de musicien

Premier lot en ligne :

- ✅ **Accordeur** intégré. Détection par autocorrélation, avec le garde-fou
  qui compte : on retient la période la plus courte parmi les sommets
  équivalents, sinon l'octave du dessous est lue à la place de la note.
  Juste au cent près sur les six cordes à vide.
- ✅ **Mode scène** : plus que les paroles, en grand, l'écran qui reste allumé
  (Wake Lock) et une barre flottante pour le défilement.
- ✅ **Partage d'une setlist** par lien : elle part avec ses chansons et son
  ordre.

Reste à faire :

- **Minutage de setlist** : la durée totale du concert se calcule toute seule.
- **Qui fait quoi** : voix, solos, chœurs, notés sur la chanson.
- **Historique** : revoir une version précédente d'un texte.
- **Export PDF** du répertoire entier, pour le classeur.

---

## Ce qu'il faudra trancher en chemin

1. **Le dépôt reste-t-il public ?** Aujourd'hui oui, c'est ce qui rend Pages
   gratuit. Un dépôt privé est possible, mais il faut alors héberger l'app
   ailleurs.
2. **Les prises doivent-elles se synchroniser**, ou l'envoi à la main suffit ?
   C'est la question qui décide de l'étape 4.
3. **Qui tient le répertoire** et valide ce qui y entre.
