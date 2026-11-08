/* conversion.js — lire une feuille d'accords écrite « à l'ancienne » (les accords
   sur une ligne, les paroles en dessous) et la ramener au format du carnet.
   Devine aussi la tonalité d'un texte. */
(function () {
  'use strict';
  var C = window.Chords;

  var SEPARATEURS = ['|', '||', ':|', '|:', '%', '/', '-', '–'];
  var REPETITION = /^\(?\s*(?:x\s*\d+|\d+\s*x)\s*\)?$/i;

  function estAccord(mot) {
    return C.isChord(mot) || SEPARATEURS.indexOf(mot) !== -1 || REPETITION.test(mot);
  }

  /** Une ligne faite uniquement d'accords (et de barres de mesure). */
  function ligneAccords(l) {
    var t = l.trim();
    if (!t) return false;
    if (t.indexOf('[') !== -1) return false;          // déjà au bon format
    var mots = t.split(/\s+/);
    if (mots.length > 14) return false;
    var vrais = 0;
    for (var i = 0; i < mots.length; i++) {
      if (!estAccord(mots[i])) return false;
      if (C.isChord(mots[i])) vrais++;
    }
    return vrais > 0;
  }

  function ligneParoles(l) {
    var t = l.trim();
    return !!t && !ligneAccords(t) && t[0] !== '#' && t[0] !== '>';
  }

  var PARTIES = /^(couplet|refrain|pont|intro|outro|intro\.|solo|final|pre[\s-]?refrain|verse|chorus|bridge|interlude|instrumental)\b/i;

  /** « [Chorus] », « Refrain :», « COUPLET 2 » → un titre de partie. */
  function titreDePartie(l) {
    var t = l.trim();
    var crochets = /^\[([^\]]+)\]$/.exec(t);
    if (crochets && !C.isChord(crochets[1].trim())) return crochets[1].trim();
    if (PARTIES.test(t)) return t.replace(/\s*:\s*$/, '');
    if (/^[^a-z]{2,24}$/.test(t) && /[A-ZÀ-Ý]/.test(t) && !ligneAccords(t) && t.length < 24) {
      return t.replace(/\s*:\s*$/, '');   // une ligne courte tout en capitales
    }
    return null;
  }

  /** Place les accords d'une ligne dans les paroles du dessous, à la colonne. */
  function fusionner(accords, paroles) {
    var re = /\S+/g, m, items = [];
    while ((m = re.exec(accords)) !== null) {
      if (C.isChord(m[0])) items.push({ col: m.index, tok: m[0] });
    }
    if (!items.length) return paroles;
    var res = paroles;
    var fin = paroles.length;
    // De droite à gauche : les colonnes déjà calculées restent valables.
    for (var i = items.length - 1; i >= 0; i--) {
      var c = Math.min(items[i].col, fin);
      res = res.slice(0, c) + '[' + items[i].tok + ']' + res.slice(c);
    }
    return res;
  }

  var RE_CAPO = /^capo\s*:?\s*(\d{1,2})/i;
  var RE_CLE = /^(?:tonalit[ée]|key|ton)\s*:?\s*([A-G][#b]?m?)\s*$/i;
  var RE_BPM = /^(?:tempo|bpm)\s*:?\s*(\d{2,3})/i;

  /**
   * Convertit une feuille collée.
   * → { texte, meta: {capo, cle, bpm}, converties, parties }
   */
  function convertirFeuille(brut) {
    var lignes = String(brut || '').replace(/\r/g, '').replace(/\t/g, '    ').split('\n');
    var sortie = [], meta = {}, converties = 0, parties = 0;
    var i = 0;

    // En-tête : on ramasse capo, tonalité et tempo s'ils traînent en haut.
    while (i < lignes.length && i < 8) {
      var t = lignes[i].trim();
      var m;
      if ((m = RE_CAPO.exec(t))) { meta.capo = parseInt(m[1], 10); i++; continue; }
      if ((m = RE_CLE.exec(t))) { meta.cle = m[1]; i++; continue; }
      if ((m = RE_BPM.exec(t))) { meta.bpm = m[1]; i++; continue; }
      break;
    }

    for (; i < lignes.length; i++) {
      var l = lignes[i];
      var nu = l.trim();

      if (!nu) { sortie.push(''); continue; }

      var titre = titreDePartie(l);
      if (titre) { sortie.push('## ' + titre); parties++; continue; }

      if (REPETITION.test(nu)) { sortie.push('> ' + nu.replace(/[()]/g, '')); continue; }

      if (ligneAccords(l)) {
        var suivante = lignes[i + 1];
        if (suivante !== undefined && ligneParoles(suivante) && !titreDePartie(suivante)) {
          sortie.push(fusionner(l, suivante.replace(/\s+$/, '')));
          converties++;
          i++;                       // la ligne de paroles est consommée
          continue;
        }
        sortie.push(nu.replace(/\s+/g, '  '));   // grille seule : on la garde
        continue;
      }

      sortie.push(l.replace(/\s+$/, ''));
    }

    // Pas plus de deux lignes vides d'affilée.
    var propre = [], vides = 0;
    sortie.forEach(function (l2) {
      if (l2 === '') { vides++; if (vides > 1) return; } else vides = 0;
      propre.push(l2);
    });

    return {
      texte: propre.join('\n').replace(/^\n+/, '').replace(/\n+$/, ''),
      meta: meta, converties: converties, parties: parties
    };
  }

  /** Est-ce que ça ressemble à une feuille à convertir ? */
  function ressembleAUneFeuille(brut) {
    var lignes = String(brut || '').replace(/\r/g, '').split('\n');
    var paires = 0;
    for (var i = 0; i < lignes.length - 1; i++) {
      if (ligneAccords(lignes[i]) && ligneParoles(lignes[i + 1])) paires++;
    }
    return paires >= 2;
  }

  /* ---------------------------------------------------------- tonalité */

  var MAJEUR = [[0, 'M'], [2, 'm'], [4, 'm'], [5, 'M'], [7, 'M'], [9, 'm'], [11, 'd']];
  var MINEUR = [[0, 'm'], [2, 'd'], [3, 'M'], [5, 'm'], [7, 'm'], [8, 'M'], [10, 'M'],
                [7, 'M']];   // le V majeur, très courant en mineur

  function famille(suffixe) {
    var s = suffixe || '';
    if (/^(m|min|-)(?!aj)/.test(s)) return 'm';
    if (/^(dim|°|m7b5|ø)/.test(s)) return 'd';
    return 'M';
  }

  /** Devine la tonalité d'après les accords employés. */
  function devinerTonalite(contenu) {
    var toks = [];
    String(contenu || '').replace(/\[([^\]]*)\]/g, function (_, a) {
      a.split(/\s+/).forEach(function (x) { if (C.isChord(x)) toks.push(x); });
      return '';
    });
    String(contenu || '').split('\n').forEach(function (l) {
      var t = l.trim();
      if (!t || t.indexOf('[') !== -1 || t[0] === '#' || t[0] === '>') return;
      var mots = t.split(/\s+/);
      if (mots.length <= 12 && mots.every(estAccord)) {
        mots.forEach(function (x) { if (C.isChord(x)) toks.push(x); });
      }
    });
    if (toks.length < 2) return null;

    var accords = toks.map(function (t) {
      var c = C.parse(t);
      return { pc: c.root, f: famille(c.suffix) };
    });
    var premier = accords[0], dernier = accords[accords.length - 1];

    var meilleur = null;
    for (var tonique = 0; tonique < 12; tonique++) {
      [['M', MAJEUR], ['m', MINEUR]].forEach(function (mode) {
        var table = mode[1], score = 0;
        accords.forEach(function (a) {
          var ok = table.some(function (d) {
            return ((tonique + d[0]) % 12) === a.pc && d[1] === a.f;
          });
          score += ok ? 1 : -0.6;        // un accord hors tonalité coûte
        });
        // Une chanson commence et finit volontiers sur sa tonique.
        if (dernier.pc === tonique && dernier.f === mode[0]) score += 2.2;
        if (premier.pc === tonique && premier.f === mode[0]) score += 1.4;
        if (!meilleur || score > meilleur.score) {
          meilleur = { score: score, tonique: tonique, mode: mode[0] };
        }
      });
    }
    if (!meilleur || meilleur.score < accords.length * 0.5) return null;

    var bemols = [1, 3, 5, 8, 10].indexOf(meilleur.tonique) !== -1 &&
      (meilleur.mode === 'm' ? [2, 7, 10].indexOf(meilleur.tonique) === -1 : true);
    return C.spell(meilleur.tonique, bemols) + (meilleur.mode === 'm' ? 'm' : '');
  }

  window.Conversion = {
    convertirFeuille: convertirFeuille,
    ressembleAUneFeuille: ressembleAUneFeuille,
    devinerTonalite: devinerTonalite,
    ligneAccords: ligneAccords,
    fusionner: fusionner
  };
})();
