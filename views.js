/* views.js — routeur et écrans. */
(function () {
  'use strict';
  var K = window.Carnet, C = window.Chords;
  var state = K.state, esc = K.esc, toast = K.toast, clamp = K.clamp;
  var app = document.getElementById('app');
  var Vues = window.Vues = window.Vues || {};
  var route = { nom: 'bib', params: {} };
  var ctxSet = null;   // setlist en cours de lecture

  /* ------------------------------------------------------------- préférences */

  function appliquerReglages() {
    var r = state.reglages;
    document.documentElement.dataset.theme = r.theme;
    document.documentElement.style.setProperty('--taille', r.taille + 'px');
  }

  /* ------------------------------------------------------------- routeur */

  function parseHash() {
    var h = location.hash.replace(/^#/, '') || '/';
    var q = {};
    var qi = h.indexOf('?');
    if (qi !== -1) {
      h.slice(qi + 1).split('&').forEach(function (p) {
        var kv = p.split('=');
        q[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || '');
      });
      h = h.slice(0, qi);
    }
    var seg = h.split('/').filter(Boolean);
    if (!seg.length) return { nom: 'bib', params: q };
    var m = { s: 'chanson', e: 'editeur', l: 'setlist', i: 'import' }[seg[0]];
    if (m) {
      var brut = seg.slice(1).join('/');
      try { q.id = decodeURIComponent(brut); } catch (e) { q.id = brut; }
      return { nom: m, params: q };
    }
    if (seg[0] === 'sets') return { nom: 'setlists', params: q };
    if (seg[0] === 'reglages') return { nom: 'reglages', params: q };
    if (seg[0] === 'aide') return { nom: 'aide', params: q };
    if (seg[0] === 'nouveau') return { nom: 'editeur', params: { id: 'new' } };
    return { nom: 'bib', params: q };
  }

  function naviguer() {
    arreterDefilement();
    arreterMetronome();
    route = parseHash();
    (Vues[route.nom] || Vues.bib)();
    majTopbar();
    if (!route.params.gardePos) window.scrollTo(0, 0);
  }

  function majTopbar() {
    var back = document.getElementById('btn-back');
    back.hidden = route.nom === 'bib';
    back.onclick = function () {
      if (history.length > 1) history.back(); else location.hash = '#/';
    };
    document.getElementById('topnav').innerHTML = route.nom === 'bib'
      ? '<a class="tbtn" href="#/sets">Setlists</a>' +
        '<a class="tbtn" href="#/reglages" title="Réglages">⚙</a>'
      : '';
  }

  function go(h) { location.hash = h; }

  /* ------------------------------------------------------------- bibliothèque */

  var filtre = { q: '', tag: '', onglet: 'tout' };

  function vueBib() {
    var mes = state.chansons.slice();
    var grp = K.groupe.slice();
    var tags = {};
    mes.concat(grp).forEach(function (s) { (s.tags || []).forEach(function (t) { tags[t] = 1; }); });

    var liste = filtre.onglet === 'mes' ? mes : filtre.onglet === 'groupe' ? grp : mes.concat(grp);
    if (filtre.onglet === 'fav') liste = mes.concat(grp).filter(function (s) { return s.favori; });
    var q = filtre.q.trim().toLowerCase();
    if (q) liste = liste.filter(function (s) {
      return ((s.titre || '') + ' ' + (s.auteur || '') + ' ' + (s.tags || []).join(' ') + ' ' + (s.contenu || '')).toLowerCase().indexOf(q) !== -1;
    });
    if (filtre.tag) liste = liste.filter(function (s) { return (s.tags || []).indexOf(filtre.tag) !== -1; });
    liste.sort(function (a, b) { return (a.titre || '').localeCompare(b.titre || '', 'fr'); });

    var h = '';
    h += '<div class="rechbar">' +
      '<input id="rech" type="search" placeholder="Chercher un titre, une parole, un tag…" value="' + esc(filtre.q) + '" autocomplete="off">' +
      '<a class="btn primaire" href="#/nouveau">+ Chanson</a>' +
      '</div>';

    h += '<div class="onglets">' + [
      ['tout', 'Tout', mes.length + grp.length],
      ['mes', 'Mes chansons', mes.length],
      ['groupe', 'Répertoire du groupe', grp.length],
      ['fav', 'Favoris', mes.concat(grp).filter(function (s) { return s.favori; }).length]
    ].map(function (o) {
      return '<button class="onglet' + (filtre.onglet === o[0] ? ' actif' : '') + '" data-onglet="' + o[0] + '">' +
        esc(o[1]) + ' <span class="pastille">' + o[2] + '</span></button>';
    }).join('') + '</div>';

    var tagList = Object.keys(tags).sort(function (a, b) { return a.localeCompare(b, 'fr'); });
    if (tagList.length) {
      h += '<div class="tags-filtre">' + tagList.map(function (t) {
        return '<button class="tag' + (filtre.tag === t ? ' actif' : '') + '" data-tag="' + esc(t) + '">' + esc(t) + '</button>';
      }).join('') + (filtre.tag ? '<button class="tag effacer" data-tag="">× filtre</button>' : '') + '</div>';
    }

    if (!liste.length) {
      h += vide(
        state.chansons.length || K.groupe.length ? 'Rien ne correspond.' : 'Ton carnet est vide.',
        state.chansons.length || K.groupe.length ? 'Essaie un autre mot, ou enlève le filtre.' :
          'Commence par <a href="#/nouveau">écrire une chanson</a>, ou jette un œil à <a href="#/aide">la syntaxe</a>.'
      );
    } else {
      h += '<ul class="liste">' + liste.map(carte).join('') + '</ul>';
    }

    if (state.setlists.length) {
      h += '<h2 class="sect">Setlists</h2><ul class="liste compacte">' + state.setlists.map(function (l) {
        return '<li><a href="#/l/' + l.id + '"><span class="t">' + esc(l.nom) + '</span>' +
          '<span class="m">' + l.chansons.length + ' titre' + (l.chansons.length > 1 ? 's' : '') +
          (l.date ? ' · ' + esc(l.date) : '') + '</span></a></li>';
      }).join('') + '</ul>';
    }

    app.innerHTML = h;

    var rech = document.getElementById('rech');
    rech.oninput = function () {
      filtre.q = rech.value;
      var pos = rech.selectionStart;
      vueBib();
      var r2 = document.getElementById('rech');
      r2.focus(); r2.setSelectionRange(pos, pos);
    };
    app.querySelectorAll('[data-onglet]').forEach(function (b) {
      b.onclick = function () { filtre.onglet = b.dataset.onglet; vueBib(); };
    });
    app.querySelectorAll('[data-tag]').forEach(function (b) {
      b.onclick = function () { filtre.tag = b.dataset.tag; vueBib(); };
    });
    app.querySelectorAll('[data-fav]').forEach(function (b) {
      b.onclick = function (ev) {
        ev.preventDefault(); ev.stopPropagation();
        var s = K.trouver(b.dataset.fav);
        if (!s) return;
        s.favori = !s.favori;
        if (K.estGroupe(s)) { favorisGroupe(s.id, s.favori); } else { s.maj = Date.now(); }
        K.save(); vueBib();
      };
    });
  }

  function carte(s) {
    var meta = [];
    if (s.auteur) meta.push(esc(s.auteur));
    if (s.cle) meta.push('en ' + esc(s.cle));
    if (s.capo) meta.push('capo ' + s.capo);
    if (s.bpm) meta.push(s.bpm + ' bpm');
    return '<li><a href="#/s/' + encodeURIComponent(s.id) + '">' +
      '<span class="t">' + esc(s.titre || 'Sans titre') +
      (K.estGroupe(s) ? ' <span class="badge">groupe</span>' : '') + '</span>' +
      (meta.length ? '<span class="m">' + meta.join(' · ') + '</span>' : '') +
      '</a><button class="fav' + (s.favori ? ' on' : '') + '" data-fav="' + esc(s.id) + '" title="Favori" aria-label="Favori">' +
      (s.favori ? '★' : '☆') + '</button></li>';
  }

  // Les chansons du groupe sont en lecture seule : on garde juste le favori à part.
  function favorisGroupe(id, on) {
    state.reglages.favGroupe = state.reglages.favGroupe || {};
    if (on) state.reglages.favGroupe[id] = 1; else delete state.reglages.favGroupe[id];
  }

  function vide(titre, sous) {
    return '<div class="empty"><p class="big">' + titre + '</p><p class="sub">' + sous + '</p></div>';
  }

  /* ------------------------------------------------------------- chanson */

  function vueChanson() {
    var s = K.trouver(route.params.id);
    if (!s) { app.innerHTML = vide('Chanson introuvable.', '<a href="#/">Retour au carnet</a>'); return; }
    if (route.params.set) {
      var l = state.setlists.filter(function (x) { return x.id === route.params.set; })[0];
      ctxSet = l ? { liste: l, i: l.chansons.indexOf(s.id) } : null;
    } else ctxSet = null;

    var capoVue = !!state.reglages.capoVue && s.capo > 0;
    var steps = (s.transpose || 0) - (capoVue ? s.capo : 0);
    var cle = s.cle ? C.transposeKey(s.cle, steps) : '';

    var meta = [];
    if (s.auteur) meta.push(esc(s.auteur));
    if (cle) meta.push('<b>' + esc(cle) + '</b>');
    if (s.capo) meta.push('capo ' + s.capo);
    if (s.bpm) meta.push(s.bpm + ' bpm');

    var h = '';
    h += '<div class="titre-ch">' +
      '<h1>' + esc(s.titre || 'Sans titre') + (K.estGroupe(s) ? ' <span class="badge">groupe</span>' : '') + '</h1>' +
      (meta.length ? '<p class="meta">' + meta.join(' · ') + '</p>' : '') + '</div>';

    h += '<div class="barre" id="barre">' +
      '<div class="grp"><button class="b" data-act="tr-" title="Baisser d’un demi-ton">−</button>' +
      '<button class="b val" data-act="tr0" title="Remettre à zéro">' + (s.transpose > 0 ? '+' : '') + (s.transpose || 0) + '</button>' +
      '<button class="b" data-act="tr+" title="Monter d’un demi-ton">+</button></div>' +
      (s.capo ? '<button class="b' + (capoVue ? ' actif' : '') + '" data-act="capo" title="Afficher les accords tels qu’on les joue avec le capo">capo ' + s.capo + '</button>' : '') +
      '<button class="b' + (state.reglages.diagrammes ? ' actif' : '') + '" data-act="dia" title="Diagrammes d’accords">⌗</button>' +
      '<div class="grp"><button class="b" data-act="aa-" title="Réduire le texte">A−</button>' +
      '<button class="b" data-act="aa+" title="Agrandir le texte">A+</button></div>' +
      '<button class="b" data-act="scroll" title="Défilement automatique">▶ défiler</button>' +
      (s.bpm ? '<button class="b" data-act="metro" title="Métronome">♩ ' + s.bpm + '</button>' : '') +
      '<div class="grow"></div>' +
      (K.estGroupe(s)
        ? '<button class="b" data-act="copier-local" title="Copier dans mes chansons">Copier</button>'
        : '<a class="b" href="#/e/' + encodeURIComponent(s.id) + '">Éditer</a>') +
      '<button class="b" data-act="menu" title="Plus">⋯</button>' +
      '</div>';

    h += '<div class="vitesse" id="vitesse" hidden>' +
      '<label>Vitesse <input type="range" min="1" max="10" value="' + state.reglages.vitesse + '" id="rng-vitesse"></label>' +
      '<span id="val-vitesse">' + state.reglages.vitesse + '</span></div>';

    var accords = K.accordsUtilises(s, steps);
    if (state.reglages.diagrammes && accords.length) {
      h += '<div class="diagrammes">' + accords.map(function (a) { return C.diagram(a); }).join('') + '</div>';
    }

    h += '<article class="chanson" id="corps">' + K.rendu(s, steps) + '</article>';

    if (ctxSet && ctxSet.i >= 0) {
      var l2 = ctxSet.liste, i = ctxSet.i;
      h += '<nav class="setnav">' +
        (i > 0 ? '<a class="b" href="#/s/' + encodeURIComponent(l2.chansons[i - 1]) + '?set=' + l2.id + '">← précédent</a>' : '<span></span>') +
        '<a class="b" href="#/l/' + l2.id + '">' + esc(l2.nom) + ' · ' + (i + 1) + '/' + l2.chansons.length + '</a>' +
        (i < l2.chansons.length - 1 ? '<a class="b" href="#/s/' + encodeURIComponent(l2.chansons[i + 1]) + '?set=' + l2.id + '">suivant →</a>' : '<span></span>') +
        '</nav>';
    }

    app.innerHTML = h;
    brancherBarre(s, steps);
  }

  function brancherBarre(s, steps) {
    function refaire() { vueChanson(); }
    var actions = {
      'tr-': function () { s.transpose = clamp((s.transpose || 0) - 1, -11, 11); marquer(s); refaire(); },
      'tr+': function () { s.transpose = clamp((s.transpose || 0) + 1, -11, 11); marquer(s); refaire(); },
      'tr0': function () { s.transpose = 0; marquer(s); refaire(); },
      'capo': function () { state.reglages.capoVue = !state.reglages.capoVue; K.save(); refaire(); },
      'dia': function () { state.reglages.diagrammes = !state.reglages.diagrammes; K.save(); refaire(); },
      'aa-': function () { state.reglages.taille = clamp(state.reglages.taille - 1, 12, 34); K.save(); appliquerReglages(); },
      'aa+': function () { state.reglages.taille = clamp(state.reglages.taille + 1, 12, 34); K.save(); appliquerReglages(); },
      'scroll': basculerDefilement,
      'metro': function () { basculerMetronome(s.bpm); },
      'copier-local': function () {
        var copie = K.nouvelleChanson(Object.assign(K.nettoyer(s), { titre: s.titre }));
        state.chansons.push(copie); K.save();
        toast('Copiée dans tes chansons.');
        go('#/s/' + encodeURIComponent(copie.id));
      },
      'menu': function () { menuChanson(s, steps); }
    };
    app.querySelectorAll('[data-act]').forEach(function (b) {
      b.onclick = function () { (actions[b.dataset.act] || function () {})(); };
    });
    var rng = document.getElementById('rng-vitesse');
    if (rng) rng.oninput = function () {
      state.reglages.vitesse = +rng.value;
      document.getElementById('val-vitesse').textContent = rng.value;
      K.save();
    };
  }

  function marquer(s) { if (!K.estGroupe(s)) s.maj = Date.now(); K.save(); }

  /* ------------------------------------------------------------- menu chanson */

  function menuChanson(s, steps) {
    var items = [
      ['partager', 'Partager un lien'],
      ['texte', 'Copier le texte (WhatsApp…)'],
      ['fichier', 'Télécharger (.txt)'],
      ['imprimer', 'Imprimer / PDF'],
      ['dupliquer', 'Dupliquer'],
      ['figer', 'Figer la transposition (' + (steps > 0 ? '+' : '') + steps + ')'],
      ['proposer', 'Proposer au répertoire du groupe']
    ];
    if (!K.estGroupe(s)) items.push(['supprimer', 'Supprimer']);

    var feuille = document.createElement('div');
    feuille.className = 'feuille';
    feuille.innerHTML = '<div class="voile"></div><div class="menu">' +
      '<p class="mt">' + esc(s.titre || 'Sans titre') + '</p>' +
      items.map(function (i) {
        return '<button data-m="' + i[0] + '"' + (i[0] === 'supprimer' ? ' class="danger"' : '') + '>' + esc(i[1]) + '</button>';
      }).join('') + '<button class="annuler" data-m="">Annuler</button></div>';
    document.body.appendChild(feuille);
    function fermer() { feuille.remove(); }
    feuille.querySelector('.voile').onclick = fermer;

    feuille.querySelectorAll('[data-m]').forEach(function (b) {
      b.onclick = async function () {
        var a = b.dataset.m;
        fermer();
        if (a === 'partager') {
          var url = await K.lienPartage({ v: 1, chansons: [K.nettoyer(s)] });
          var r = await K.partager(s.titre, 'Paroles et accords : ' + (s.titre || ''), url);
          if (r === 'copie') toast('Lien copié — colle-le dans la conversation du groupe.');
          if (r === 'echec') prompt('Copie ce lien :', url);
        } else if (a === 'texte') {
          var ok = await K.copier(K.versTexte(s));
          toast(ok ? 'Texte copié.' : 'Copie impossible.');
        } else if (a === 'fichier') {
          K.telecharger((s.titre || 'chanson').replace(/[\/\\:*?"<>|]/g, '-') + '.txt', K.versTexte(s), 'text/plain');
        } else if (a === 'imprimer') {
          window.print();
        } else if (a === 'dupliquer') {
          var c = K.nouvelleChanson(Object.assign(K.nettoyer(s), { titre: (s.titre || 'Sans titre') + ' (copie)' }));
          state.chansons.push(c); K.save(); go('#/e/' + c.id);
        } else if (a === 'figer') {
          if (!steps) { toast('Rien à figer.'); return; }
          var flats = C.prefersFlats(s.cle, steps);
          var cible = K.estGroupe(s) ? K.nouvelleChanson(Object.assign(K.nettoyer(s), { titre: s.titre })) : s;
          cible.contenu = figer(cible.contenu, steps, flats);
          cible.cle = cible.cle ? C.transposeKey(cible.cle, steps) : '';
          cible.transpose = 0;
          if (K.estGroupe(s)) { state.chansons.push(cible); }
          K.save();
          toast('Accords réécrits dans le texte.');
          go('#/s/' + encodeURIComponent(cible.id));
          naviguer();
        } else if (a === 'proposer') {
          proposerAuGroupe(s);
        } else if (a === 'supprimer') {
          if (!confirm('Supprimer « ' + (s.titre || 'Sans titre') + ' » ? C’est définitif sur cet appareil.')) return;
          state.chansons = state.chansons.filter(function (x) { return x.id !== s.id; });
          state.setlists.forEach(function (l) { l.chansons = l.chansons.filter(function (x) { return x !== s.id; }); });
          K.state.chansons = state.chansons;
          K.save(); toast('Supprimée.'); go('#/');
        }
      };
    });
  }

  function figer(texte, steps, flats) {
    return String(texte || '').split('\n').map(function (l) {
      if (l.indexOf('[') !== -1) {
        return l.replace(/\[([^\]]*)\]/g, function (_, c) {
          return '[' + c.split(/(\s+)/).map(function (p) {
            return /\s/.test(p) ? p : C.transposeToken(p, steps, flats);
          }).join('') + ']';
        });
      }
      var t = l.trim();
      if (!t || t[0] === '#' || t[0] === '>') return l;
      var mots = t.split(/\s+/);
      if (mots.length <= 10 && mots.every(function (m) { return C.isChord(m) || m === '|' || m === '%'; })) {
        return l.replace(/\S+/g, function (m) { return C.transposeToken(m, steps, flats); });
      }
      return l;
    }).join('\n');
  }

  async function proposerAuGroupe(s) {
    var json = JSON.stringify(K.nettoyer(s), null, 2);
    if (K.depot) {
      var url = 'https://github.com/' + K.depot.owner + '/' + K.depot.repo + '/issues/new' +
        '?title=' + encodeURIComponent('Répertoire : ' + (s.titre || 'nouvelle chanson')) +
        '&body=' + encodeURIComponent('À ajouter dans `repertoire.json` :\n\n```json\n' + json + '\n```\n');
      if (url.length < 7000) { window.open(url, '_blank', 'noopener'); return; }
    }
    var ok = await K.copier(json);
    toast(ok ? 'JSON copié — colle-le dans repertoire.json.' : 'Copie impossible.');
  }

  /* ------------------------------------------------------------- défilement & métronome */

  var defil = { on: false, raf: 0, acc: 0 };

  function basculerDefilement() {
    defil.on ? arreterDefilement() : demarrerDefilement();
  }
  function demarrerDefilement() {
    defil.on = true; defil.acc = 0;
    var v = document.getElementById('vitesse'); if (v) v.hidden = false;
    majBoutonDefil();
    var tick = function () {
      if (!defil.on) return;
      defil.acc += state.reglages.vitesse * 0.09;
      if (defil.acc >= 1) {
        var d = Math.floor(defil.acc); defil.acc -= d;
        var avant = window.scrollY;
        window.scrollBy(0, d);
        if (window.scrollY === avant) { arreterDefilement(); return; }
      }
      defil.raf = requestAnimationFrame(tick);
    };
    defil.raf = requestAnimationFrame(tick);
  }
  function arreterDefilement() {
    if (!defil.on) return;
    defil.on = false;
    cancelAnimationFrame(defil.raf);
    majBoutonDefil();
  }
  function majBoutonDefil() {
    var b = app.querySelector('[data-act="scroll"]');
    if (!b) return;
    b.textContent = defil.on ? '⏸ pause' : '▶ défiler';
    b.classList.toggle('actif', defil.on);
  }

  var metro = { ctx: null, timer: 0, on: false, bpm: 0, next: 0, beat: 0 };

  function basculerMetronome(bpm) {
    if (metro.on) { arreterMetronome(); return; }
    bpm = clamp(parseInt(bpm, 10) || 100, 30, 260);
    try { metro.ctx = metro.ctx || new (window.AudioContext || window.webkitAudioContext)(); }
    catch (e) { toast('Pas de son disponible.'); return; }
    if (metro.ctx.state === 'suspended') metro.ctx.resume();
    metro.on = true; metro.bpm = bpm; metro.beat = 0; metro.next = metro.ctx.currentTime + 0.1;
    metro.timer = setInterval(function () {
      while (metro.next < metro.ctx.currentTime + 0.15) {
        clic(metro.next, metro.beat % 4 === 0);
        pulse((metro.next - metro.ctx.currentTime) * 1000);
        metro.next += 60 / metro.bpm;
        metro.beat++;
      }
    }, 25);
    var b = app.querySelector('[data-act="metro"]');
    if (b) b.classList.add('actif');
  }
  function clic(t, fort) {
    var o = metro.ctx.createOscillator(), g = metro.ctx.createGain();
    o.frequency.value = fort ? 1600 : 1000;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(fort ? 0.5 : 0.28, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    o.connect(g); g.connect(metro.ctx.destination);
    o.start(t); o.stop(t + 0.08);
  }
  function pulse(delai) {
    setTimeout(function () {
      var b = app.querySelector('[data-act="metro"]');
      if (!b) return;
      b.classList.add('bat');
      setTimeout(function () { b.classList.remove('bat'); }, 90);
    }, Math.max(0, delai));
  }
  function arreterMetronome() {
    if (!metro.on) return;
    metro.on = false;
    clearInterval(metro.timer);
    var b = app.querySelector('[data-act="metro"]');
    if (b) b.classList.remove('actif');
  }

  Vues.bib = vueBib;
  Vues.chanson = vueChanson;

  window.VuesInternes = { naviguer: naviguer, appliquerReglages: appliquerReglages, vide: vide, go: go,
    route: function () { return route; }, carte: carte, app: app };
})();
