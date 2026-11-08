/* app.js — Carnet : paroles & accords.
   Tout tient en local (localStorage) + un répertoire de groupe versionné dans le dépôt. */
(function () {
  'use strict';

  var VERSION = '1.3.0';
  var KEY = 'carnet.v1';
  var C = window.Chords;

  /* ------------------------------------------------------------------ outils */

  function $(sel, root) { return (root || document).querySelector(sel); }
  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  var toastTimer;
  function toast(msg) {
    var el = $('#toast');
    el.textContent = msg;
    el.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('on'); }, 2600);
  }

  function dateFr(ts) {
    if (!ts) return '';
    return new Date(ts).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  /* ------------------------------------------------------------------ état */

  var defaults = {
    chansons: [],
    setlists: [],
    reglages: { theme: 'auto', taille: 17, diagrammes: true, vitesse: 3 }
  };

  var state = load();
  var groupe = [];          // répertoire partagé (lecture seule)
  var depot = null;         // { owner, repo } si on tourne sur GitHub Pages

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return JSON.parse(JSON.stringify(defaults));
      var d = JSON.parse(raw);
      d.chansons = d.chansons || [];
      d.setlists = d.setlists || [];
      d.reglages = Object.assign({}, defaults.reglages, d.reglages || {});
      return d;
    } catch (e) {
      console.warn('Carnet : sauvegarde illisible', e);
      return JSON.parse(JSON.stringify(defaults));
    }
  }

  var saveTimer;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      try { localStorage.setItem(KEY, JSON.stringify(state)); }
      catch (e) { toast('Sauvegarde impossible : espace saturé ?'); }
    }, 120);
  }

  function nouvelleChanson(p) {
    return Object.assign({
      id: uid(), titre: '', auteur: '', cle: '', bpm: '', capo: 0,
      tags: [], transpose: 0, favori: false, contenu: '', maj: Date.now()
    }, p || {});
  }

  function toutes() { return state.chansons.concat(groupe); }
  function trouver(id) {
    var all = toutes();
    for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
    return null;
  }
  function estGroupe(s) { return !!s && s.id.indexOf('g:') === 0; }

  /* ------------------------------------------------------------------ lecture du texte */

  // Format : accords entre crochets dans les paroles, « ## » pour un titre de
  // partie, « > » pour une indication scénique. Une ligne d'accords seuls
  // (« Am F C G ») est reconnue toute seule.
  function analyser(texte) {
    var blocs = [];
    var lignes = String(texte || '').replace(/\r/g, '').split('\n');
    for (var i = 0; i < lignes.length; i++) {
      var l = lignes[i];
      var t = l.trim();
      if (!t) { blocs.push({ type: 'vide' }); continue; }
      var h = /^#{1,4}\s*(.+?)\s*#*$/.exec(t);
      if (h) { blocs.push({ type: 'partie', label: h[1] }); continue; }
      if (t[0] === '>') { blocs.push({ type: 'note', texte: t.slice(1).trim() }); continue; }
      if (t.indexOf('[') !== -1) { blocs.push({ type: 'ligne', paires: paires(l) }); continue; }
      var mots = t.split(/\s+/);
      var tousAccords = mots.length <= 10 && mots.every(function (m) { return C.isChord(m) || m === '|' || m === '%'; });
      if (tousAccords && mots.some(function (m) { return C.isChord(m); })) {
        blocs.push({ type: 'accords', mots: mots });
        continue;
      }
      blocs.push({ type: 'ligne', paires: [{ accord: null, texte: l }] });
    }
    return blocs;
  }

  function paires(ligne) {
    var out = [], re = /\[([^\]]*)\]/g, last = 0, m;
    while ((m = re.exec(ligne)) !== null) {
      var avant = ligne.slice(last, m.index);
      if (avant) {
        // Le texte revient à l'accord précédent s'il en attend encore.
        if (out.length && out[out.length - 1].accord !== null && out[out.length - 1].texte === '') {
          out[out.length - 1].texte = avant;
        } else {
          out.push({ accord: null, texte: avant });
        }
      }
      out.push({ accord: m[1].trim(), texte: '' });
      last = re.lastIndex;
    }
    var reste = ligne.slice(last);
    if (reste) {
      if (out.length && out[out.length - 1].accord !== null && out[out.length - 1].texte === '') out[out.length - 1].texte = reste;
      else out.push({ accord: null, texte: reste });
    }
    return out.length ? out : [{ accord: null, texte: ligne }];
  }

  function transposeAccord(tok, steps, flats) {
    return tok.split(/(\s+)/).map(function (p) {
      return /\s/.test(p) ? p : C.transposeToken(p, steps, flats);
    }).join('');
  }

  function rendu(chanson, steps) {
    var flats = C.prefersFlats(chanson.cle, steps);
    if (!chanson.cle) flats = undefined;
    var blocs = analyser(chanson.contenu);
    var html = '', ouvert = false;
    function fermer() { if (ouvert) { html += '</div>'; ouvert = false; } }

    blocs.forEach(function (b) {
      if (b.type === 'partie') {
        fermer();
        html += '<h3 class="partie">' + esc(b.label) + '</h3><div class="bloc">';
        ouvert = true;
      } else if (b.type === 'vide') {
        html += '<div class="saut"></div>';
      } else if (b.type === 'note') {
        html += '<p class="indic">' + esc(b.texte) + '</p>';
      } else if (b.type === 'accords') {
        html += '<p class="ligne accords-seuls">' + b.mots.map(function (m) {
          return C.isChord(m)
            ? '<span class="ch">' + esc(transposeAccord(m, steps, flats)) + '</span>'
            : '<span class="sep">' + esc(m) + '</span>';
        }).join(' ') + '</p>';
      } else {
        var aAccords = b.paires.some(function (p) { return p.accord !== null; });
        html += '<p class="ligne' + (aAccords ? '' : ' sans-accords') + '">' + b.paires.map(function (p) {
          var ch = p.accord === null ? '' : esc(transposeAccord(p.accord, steps, flats));
          var tx = p.texte === '' ? ' ' : esc(p.texte);
          return '<span class="paire"><span class="ch">' + ch + '</span><span class="tx">' + tx + '</span></span>';
        }).join('') + '</p>';
      }
    });
    fermer();
    return html || '<p class="indic">Chanson vide — ouvre l’éditeur pour écrire.</p>';
  }

  function accordsUtilises(chanson, steps) {
    var flats = C.prefersFlats(chanson.cle, steps);
    if (!chanson.cle) flats = undefined;
    var vus = [], out = [];
    analyser(chanson.contenu).forEach(function (b) {
      var toks = [];
      if (b.type === 'ligne') b.paires.forEach(function (p) { if (p.accord) toks = toks.concat(p.accord.split(/\s+/)); });
      if (b.type === 'accords') toks = b.mots;
      toks.forEach(function (t) {
        if (!C.isChord(t)) return;
        var v = C.transposeToken(t, steps, flats);
        if (vus.indexOf(v) === -1) { vus.push(v); out.push(v); }
      });
    });
    return out;
  }

  /* ------------------------------------------------------------------ texte brut / partage */

  function versTexte(s) {
    var l = [];
    l.push(s.titre || 'Sans titre');
    if (s.auteur) l.push(s.auteur);
    var meta = [];
    if (s.cle) meta.push('Tonalité : ' + s.cle);
    if (s.bpm) meta.push(s.bpm + ' bpm');
    if (s.capo) meta.push('Capo ' + s.capo);
    if (meta.length) l.push(meta.join(' · '));
    l.push('');
    l.push(s.contenu || '');
    return l.join('\n');
  }

  function b64url(bytes) {
    var bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function fromB64url(s) {
    s = s.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    var bin = atob(s), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  function nettoyer(s) {
    return { titre: s.titre, auteur: s.auteur, cle: s.cle, bpm: s.bpm, capo: s.capo, tags: s.tags, contenu: s.contenu };
  }

  async function empaqueter(data) {
    var json = JSON.stringify(data);
    if (window.CompressionStream) {
      try {
        var cs = new CompressionStream('deflate-raw');
        var buf = await new Response(new Blob([json]).stream().pipeThrough(cs)).arrayBuffer();
        return 'z' + b64url(new Uint8Array(buf));
      } catch (e) { /* on retombe sur le brut */ }
    }
    return 'p' + b64url(new TextEncoder().encode(json));
  }

  async function depaqueter(code) {
    var bytes = fromB64url(code.slice(1));
    if (code[0] === 'z') {
      var ds = new DecompressionStream('deflate-raw');
      var buf = await new Response(new Blob([bytes]).stream().pipeThrough(ds)).arrayBuffer();
      return JSON.parse(new TextDecoder().decode(buf));
    }
    return JSON.parse(new TextDecoder().decode(bytes));
  }

  async function lienPartage(data) {
    var code = await empaqueter(data);
    return location.origin + location.pathname + '#/i/' + code;
  }

  async function copier(texte) {
    try {
      await navigator.clipboard.writeText(texte);
      return true;
    } catch (e) {
      var ta = document.createElement('textarea');
      ta.value = texte; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e2) { ok = false; }
      document.body.removeChild(ta);
      return ok;
    }
  }

  async function partager(titre, texte, url) {
    if (navigator.share) {
      try { await navigator.share({ title: titre, text: texte, url: url }); return 'natif'; }
      catch (e) { if (e && e.name === 'AbortError') return 'annule'; }
    }
    return (await copier(url || texte)) ? 'copie' : 'echec';
  }

  function telecharger(nom, contenu, type) {
    var blob = new Blob([contenu], { type: type || 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nom;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  window.Carnet = {
    state: state, save: save, analyser: analyser, rendu: rendu, accordsUtilises: accordsUtilises,
    esc: esc, uid: uid, clamp: clamp, toast: toast, dateFr: dateFr, trouver: trouver, toutes: toutes,
    estGroupe: estGroupe, nouvelleChanson: nouvelleChanson, versTexte: versTexte, nettoyer: nettoyer,
    empaqueter: empaqueter, depaqueter: depaqueter, lienPartage: lienPartage, copier: copier,
    partager: partager, telecharger: telecharger, VERSION: VERSION,
    get groupe() { return groupe; },
    set groupe(v) { groupe = v; },
    get depot() { return depot; },
    set depot(v) { depot = v; }
  };
})();
