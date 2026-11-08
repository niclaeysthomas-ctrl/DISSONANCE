/* chords.js — théorie : lecture des accords, transposition, diagrammes guitare.
   Aucune dépendance. Tout est exposé sur window.Chords. */
(function () {
  'use strict';

  var SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  var FLAT  = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
  var PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

  // Tonalités qui s'écrivent naturellement en bémols.
  var FLAT_KEYS = ['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Dm', 'Gm', 'Cm', 'Fm', 'Bbm', 'Ebm'];

  // Un accord : racine + suffixe (+ basse éventuelle). Le suffixe n'est jamais réécrit.
  var RE_CHORD = /^([A-G])([#b]?)([^\/\s]*)(?:\/([A-G])([#b]?))?$/;
  // Suffixes acceptés : m, m7, maj7, 7, sus4, add9, m7b5, dim7, aug, 6/9…
  var RE_SUFFIX = /^(?:maj|Maj|M|Δ|min|m|-|dim|°|aug|\+|ø)?(?:13|11|9|7|6|5|4|2)?(?:(?:sus|add|no)(?:13|11|9|7|6|5|4|2)?|[b#](?:13|11|9|6|5)|maj7|M7|6\/9|\/9|9|7|\(|\))*$/;

  function pitch(letter, accidental) {
    var p = PC[letter];
    if (accidental === '#') p += 1;
    if (accidental === 'b') p -= 1;
    return ((p % 12) + 12) % 12;
  }

  function parse(token) {
    if (!token) return null;
    var m = RE_CHORD.exec(token.trim());
    if (!m) return null;
    var suffix = m[3] || '';
    // Sans ce filtre, « Amour » ou « Dans » passeraient pour des accords.
    if (suffix && !RE_SUFFIX.test(suffix)) return null;
    return {
      root: pitch(m[1], m[2]),
      rootText: m[1] + (m[2] || ''),
      flat: m[2] === 'b',
      suffix: suffix,
      bass: m[4] ? pitch(m[4], m[5]) : null,
      bassFlat: m[5] === 'b',
      text: token.trim()
    };
  }

  function isChord(token) { return !!parse(token); }

  function spell(pc, useFlats) {
    return (useFlats ? FLAT : SHARP)[((pc % 12) + 12) % 12];
  }

  function transposeToken(token, steps, useFlats) {
    var c = parse(token);
    if (!c) return token;
    if (!steps) return token;
    var flats = (useFlats === undefined) ? c.flat : useFlats;
    var out = spell(c.root + steps, flats) + c.suffix;
    if (c.bass !== null) out += '/' + spell(c.bass + steps, (useFlats === undefined) ? c.bassFlat : useFlats);
    return out;
  }

  function transposeKey(key, steps) {
    if (!key) return key;
    var minor = /m$/.test(key) && !/maj/.test(key);
    var base = minor ? key.slice(0, -1) : key;
    var c = parse(base);
    if (!c) return key;
    var target = spell(c.root + steps, c.flat);
    var name = target + (minor ? 'm' : '');
    // Si la tonalité d'arrivée s'écrit plus simplement en bémols, on la réécrit.
    var alt = spell(c.root + steps, true) + (minor ? 'm' : '');
    if (FLAT_KEYS.indexOf(alt) !== -1) name = alt;
    return name;
  }

  function prefersFlats(key, steps) {
    if (!key) return false;
    return FLAT_KEYS.indexOf(transposeKey(key, steps || 0)) !== -1;
  }

  /* ---------- Diagrammes guitare (accordage standard) ---------- */

  // Positions ouvertes de référence, cordes de la 6e à la 1re. -1 = corde étouffée.
  var OPEN = {
    'C':      [-1, 3, 2, 0, 1, 0],
    'C7':     [-1, 3, 2, 3, 1, 0],
    'Cmaj7':  [-1, 3, 2, 0, 0, 0],
    'C6':     [-1, 3, 2, 2, 1, 0],
    'Cadd9':  [-1, 3, 2, 0, 3, 0],
    'D':      [-1, -1, 0, 2, 3, 2],
    'Dm':     [-1, -1, 0, 2, 3, 1],
    'D7':     [-1, -1, 0, 2, 1, 2],
    'Dm7':    [-1, -1, 0, 2, 1, 1],
    'Dmaj7':  [-1, -1, 0, 2, 2, 2],
    'Dsus4':  [-1, -1, 0, 2, 3, 3],
    'Dsus2':  [-1, -1, 0, 2, 3, 0],
    'D6':     [-1, -1, 0, 2, 0, 2],
    'G':      [3, 2, 0, 0, 3, 3],
    'G7':     [3, 2, 0, 0, 0, 1],
    'Gmaj7':  [3, 2, 0, 0, 0, 2],
    'G6':     [3, 2, 0, 0, 0, 0],
    'Gsus4':  [3, 3, 0, 0, 1, 3],
    'B7':     [-1, 2, 1, 2, 0, 2],
    'A7':     [-1, 0, 2, 0, 2, 0],
    'E7':     [0, 2, 0, 1, 0, 0],
    'F':      [1, 3, 3, 2, 1, 1]
  };

  // Formes mobiles. Décalages par rapport à la case du barré.
  var SHAPE_E = { // fondamentale sur la corde de mi grave
    maj:  [0, 2, 2, 1, 0, 0],
    min:  [0, 2, 2, 0, 0, 0],
    dom7: [0, 2, 0, 1, 0, 0],
    m7:   [0, 2, 0, 0, 0, 0],
    maj7: [0, 2, 1, 1, 0, 0],
    sus4: [0, 2, 2, 2, 0, 0],
    sus2: [0, 2, 4, 4, 0, 0],
    six:  [0, 2, 2, 1, 2, 0],
    m6:   [0, 2, 2, 0, 2, 0],
    nine: [0, 2, 0, 1, 0, 2],
    five: [0, 2, 2, -1, -1, -1]
  };
  var SHAPE_A = { // fondamentale sur la corde de la
    maj:  [-1, 0, 2, 2, 2, 0],
    min:  [-1, 0, 2, 2, 1, 0],
    dom7: [-1, 0, 2, 0, 2, 0],
    m7:   [-1, 0, 2, 0, 1, 0],
    maj7: [-1, 0, 2, 1, 2, 0],
    sus4: [-1, 0, 2, 2, 3, 0],
    sus2: [-1, 0, 2, 2, 0, 0],
    six:  [-1, 0, 2, 2, 2, 2],
    m6:   [-1, 0, 2, 2, 1, 2],
    nine: [-1, 0, 2, 0, 2, 0],
    five: [-1, 0, 2, -1, -1, -1],
    dim:  [-1, 0, 1, 2, 1, -1],
    m7b5: [-1, 0, 1, 0, 1, -1],
    aug:  [-1, 0, 3, 2, 2, 1]
  };

  // Du suffixe écrit vers une famille de formes.
  function family(suffix) {
    var s = (suffix || '').replace(/\s/g, '');
    if (s === '') return { k: 'maj', exact: true };
    if (/^(m|min|-)$/.test(s)) return { k: 'min', exact: true };
    if (/^(maj7|M7|Δ7?|maj)$/.test(s)) return { k: 'maj7', exact: true };
    if (/^(m7|min7|-7)$/.test(s)) return { k: 'm7', exact: true };
    if (/^7$/.test(s)) return { k: 'dom7', exact: true };
    if (/^(sus4|sus)$/.test(s)) return { k: 'sus4', exact: true };
    if (/^sus2$/.test(s)) return { k: 'sus2', exact: true };
    if (/^6$/.test(s)) return { k: 'six', exact: true };
    if (/^(m6|min6)$/.test(s)) return { k: 'm6', exact: true };
    if (/^9$/.test(s)) return { k: 'nine', exact: true };
    if (/^5$/.test(s)) return { k: 'five', exact: true };
    if (/^(dim7?|°7?)$/.test(s)) return { k: 'dim', exact: true };
    if (/^(m7b5|ø|half)$/.test(s)) return { k: 'm7b5', exact: true };
    if (/^(aug|\+)$/.test(s)) return { k: 'aug', exact: true };
    // Approximations : on retombe sur la base entendue.
    if (/^m/.test(s)) return { k: /7/.test(s) ? 'm7' : 'min', exact: false };
    if (/maj/.test(s)) return { k: 'maj7', exact: false };
    if (/^(7|9|11|13)/.test(s)) return { k: 'dom7', exact: false };
    return { k: 'maj', exact: false };
  }

  function shift(shape, fret) {
    return shape.map(function (f) { return f < 0 ? -1 : f + fret; });
  }

  /** Renvoie { frets:[6], base:n, exact:bool, name } ou null. */
  function fingering(token) {
    var c = parse(token);
    if (!c) return null;
    var fam = family(c.suffix);
    var canonical = spell(c.root, c.flat) + c.suffix;
    var alt = spell(c.root, !c.flat) + c.suffix;

    if (OPEN[canonical]) return { frets: OPEN[canonical], exact: true, name: c.text };
    if (OPEN[alt]) return { frets: OPEN[alt], exact: true, name: c.text };

    var candidates = [];
    var fE = ((c.root - 4) % 12 + 12) % 12;   // mi grave = 4
    var fA = ((c.root - 9) % 12 + 12) % 12;   // la = 9
    if (SHAPE_E[fam.k]) candidates.push({ frets: shift(SHAPE_E[fam.k], fE), fret: fE });
    if (SHAPE_A[fam.k]) candidates.push({ frets: shift(SHAPE_A[fam.k], fA), fret: fA });
    if (!candidates.length) return null;

    // On privilégie la position la plus basse sur le manche.
    candidates.sort(function (a, b) { return a.fret - b.fret; });
    var best = candidates[0];
    return { frets: best.frets, exact: fam.exact, name: c.text };
  }

  /** Diagramme SVG d'un accord, prêt à injecter. Corde de mi grave à gauche. */
  function diagram(token, opts) {
    opts = opts || {};
    var f = opts.frets ? { frets: opts.frets, exact: opts.exact !== false, name: token } : fingering(token);
    var w = opts.width || 92, H = 112, pad = 12, top = 38;
    var head = '<svg class="dia" viewBox="0 0 ' + w + ' ' + H + '" width="' + w + '" height="' + H +
      '" role="img" aria-label="Accord ' + esc(token) + '">';
    var label = '<text x="' + (w / 2) + '" y="13" class="dia-name" text-anchor="middle">' + esc(token) + '</text>';
    if (!f) return head + label + '<text x="' + (w / 2) + '" y="72" class="dia-x" text-anchor="middle">?</text></svg>';

    var frets = f.frets;
    var joues = frets.filter(function (x) { return x > 0; });
    var min = joues.length ? Math.min.apply(null, joues) : 1;
    var max = joues.length ? Math.max.apply(null, joues) : 1;
    var start = (max <= 4) ? 1 : min;          // fenêtre de 4 cases
    var gw = w - pad * 2, gh = H - top - 12;
    var cw = gw / 5, rh = gh / 4;
    var x = function (i) { return pad + cw * i; };            // i = 0 → mi grave
    var y = function (fr) { return top + rh * (fr - start + 0.5); };
    var s = head + label;

    if (start === 1) s += '<rect x="' + (pad - 0.6) + '" y="' + (top - 3.4) + '" width="' + (gw + 1.2) + '" height="3.4" class="dia-nut"/>';
    else s += '<text x="' + (pad - 4) + '" y="' + (y(start) + 3.5) + '" class="dia-fret" text-anchor="end">' + start + '</text>';

    for (var r = 0; r <= 4; r++) s += '<line x1="' + pad + '" y1="' + (top + rh * r) + '" x2="' + (pad + gw) + '" y2="' + (top + rh * r) + '" class="dia-line"/>';
    for (var i = 0; i < 6; i++) s += '<line x1="' + x(i) + '" y1="' + top + '" x2="' + x(i) + '" y2="' + (top + gh) + '" class="dia-line"/>';

    // Un barré : plusieurs cordes sur la case la plus basse, rien d'ouvert entre les deux.
    var barre = null;
    var sur = [];
    for (var k = 0; k < 6; k++) if (frets[k] === min) sur.push(k);
    var premiere = -1;
    for (var q = 0; q < 6; q++) if (frets[q] >= 0) { premiere = q; break; }
    // L'index ne barre que s'il part de la corde grave jouée : c'est ce qui
    // distingue un vrai barré (F, Bm) d'un accord ouvert à trois doigts (D, B7).
    if (min > 0 && sur.length >= 2 && sur[sur.length - 1] - sur[0] >= 2 &&
        premiere >= 0 && frets[premiere] === min) {
      var a = sur[0], b = sur[sur.length - 1], ok = true;
      for (var n = a; n <= b; n++) if (frets[n] < min) ok = false;
      if (ok) barre = { fret: min, de: a, a: b };
    }
    if (barre) {
      s += '<rect x="' + (x(barre.de) - 4.6) + '" y="' + (y(barre.fret) - 4.6) + '" width="' +
        (cw * (barre.a - barre.de) + 9.2) + '" height="9.2" rx="4.6" class="dia-dot"/>';
    }

    for (var j = 0; j < 6; j++) {
      var fr = frets[j];
      if (fr < 0) s += '<text x="' + x(j) + '" y="' + (top - 8) + '" class="dia-x" text-anchor="middle">×</text>';
      else if (fr === 0) s += '<circle cx="' + x(j) + '" cy="' + (top - 11) + '" r="3.2" class="dia-open"/>';
      else if (!(barre && fr === barre.fret && j >= barre.de && j <= barre.a)) {
        s += '<circle cx="' + x(j) + '" cy="' + y(fr) + '" r="5" class="dia-dot"/>';
      }
    }
    if (!f.exact) s += '<text x="' + (w - 4) + '" y="13" class="dia-approx" text-anchor="end">≈</text>';
    return s + '</svg>';
  }


  /* ---------- plusieurs positions, et les notes qu'on entend ---------- */

  var CORDES = [4, 9, 2, 7, 11, 4];   // mi la ré sol si mi, de la 6e à la 1re
  var FR = { C: 'Do', D: 'Ré', E: 'Mi', F: 'Fa', G: 'Sol', A: 'La', B: 'Si' };

  /** « A#m7 » → « La♯ ». */
  function nomFr(pc, bemols) {
    var n = spell(pc, bemols);
    return FR[n[0]] + (n[1] === '#' ? '♯' : n[1] === 'b' ? '♭' : '');
  }

  /** Les notes réellement jouées par une position, de la plus grave à l'aiguë. */
  function notesDe(frets, bemols) {
    var vues = [], out = [];
    for (var i = 0; i < 6; i++) {
      if (frets[i] < 0) continue;
      var pc = (CORDES[i] + frets[i]) % 12;
      if (vues.indexOf(pc) !== -1) continue;
      vues.push(pc);
      out.push(nomFr(pc, bemols));
    }
    return out;
  }

  /** Jusqu'à trois façons de plaquer l'accord, de la plus basse à la plus haute. */
  function positions(token) {
    var c = parse(token);
    if (!c) return [];
    var fam = family(c.suffix);
    var out = [];
    var vus = [];
    function pousser(frets, etiquette, rang) {
      var cle = frets.join(',');
      if (vus.indexOf(cle) !== -1) return;
      vus.push(cle);
      out.push({ frets: frets, etiquette: etiquette, exact: fam.exact, rang: rang });
    }

    var canonique = spell(c.root, c.flat) + c.suffix;
    var autre = spell(c.root, !c.flat) + c.suffix;
    if (OPEN[canonique]) pousser(OPEN[canonique], 'position de base', -1);
    else if (OPEN[autre]) pousser(OPEN[autre], 'position de base', -1);

    var fE = ((c.root - 4) % 12 + 12) % 12;
    var fA = ((c.root - 9) % 12 + 12) % 12;
    if (SHAPE_E[fam.k]) {
      pousser(shift(SHAPE_E[fam.k], fE),
        fE === 0 ? 'position ouverte' : 'barré case ' + fE + ', forme de mi', fE);
    }
    if (SHAPE_A[fam.k]) {
      pousser(shift(SHAPE_A[fam.k], fA),
        fA === 0 ? 'position ouverte' : 'barré case ' + fA + ', forme de la', fA);
    }
    out.sort(function (a, b) { return a.rang - b.rang; });
    return out.slice(0, 3);
  }

  function esc(t) {
    return String(t).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  window.Chords = {
    parse: parse, isChord: isChord, spell: spell,
    transposeToken: transposeToken, transposeKey: transposeKey, prefersFlats: prefersFlats,
    fingering: fingering, diagram: diagram, positions: positions, notesDe: notesDe, nomFr: nomFr,
    SHARP: SHARP, FLAT: FLAT
  };
})();
