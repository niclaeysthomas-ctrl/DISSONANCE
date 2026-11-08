/* views2.js — éditeur, setlists, réglages, aide, import. */
(function () {
  'use strict';
  var K = window.Carnet, C = window.Chords, V = window.VuesInternes;
  var Vues = window.Vues = window.Vues || {};
  var state = K.state, esc = K.esc, toast = K.toast, clamp = K.clamp;
  var app = document.getElementById('app');
  var go = V.go, vide = V.vide;

  /* ------------------------------------------------------------- éditeur */

  Vues.editeur = function () {
    var p = V.route().params;
    var creation = p.id === 'new';
    var s = creation ? K.nouvelleChanson() : K.trouver(p.id);
    if (!s) { app.innerHTML = vide('Chanson introuvable.', '<a href="#/">Retour au carnet</a>'); return; }
    if (K.estGroupe(s)) {
      app.innerHTML = vide('Chanson du répertoire du groupe.',
        'Elle est en lecture seule ici. Ouvre-la et fais « Copier » pour en garder ta version.');
      return;
    }
    var brouillon = Object.assign({}, s, { tags: (s.tags || []).slice() });

    var h = '<form class="editeur" id="form-ed" autocomplete="off">' +
      '<input class="champ-titre" name="titre" placeholder="Titre de la chanson" value="' + esc(brouillon.titre) + '">' +
      '<div class="champs">' +
      champ('auteur', 'Auteur · paroles', brouillon.auteur, 'text', 'Qui l’a écrite ?') +
      champ('cle', 'Tonalité', brouillon.cle, 'text', 'Am, C, F#m…') +
      champ('bpm', 'Tempo', brouillon.bpm, 'number', 'bpm') +
      champ('capo', 'Capo', brouillon.capo || '', 'number', '0') +
      champ('duree', 'Durée', K.ecrireDuree(brouillon.duree), 'text', '3:45') +
      champ('tags', 'Tags', (brouillon.tags || []).join(', '), 'text', 'concert, nouvelle, à finir') +
      '</div>' +
      '<label class="champ"><span>Qui fait quoi</span>' +
      '<input name="roles" type="text" value="' + esc(brouillon.roles || '') + '" ' +
      'placeholder="chant : … · solo : … · chœurs : …"></label>' +
      '<div class="outils-ed">' +
      '<button type="button" class="b" data-ed="accord">[ accord ]</button>' +
      '<button type="button" class="b" data-ed="partie">## partie</button>' +
      '<button type="button" class="b" data-ed="indic">&gt; indication</button>' +
      '<button type="button" class="b" data-ed="feuille">Coller une feuille</button>' +
      '<button type="button" class="b" data-ed="tap">♩ taper le tempo</button>' +
      '<button type="button" class="b" data-ed="cle">Tonalité ?</button>' +
      '<div class="grow"></div>' +
      '<button type="button" class="b" data-ed="apercu">Aperçu</button>' +
      '<a class="b" href="#/aide" target="_self">Syntaxe ?</a>' +
      '</div>' +
      '<div class="palette" id="palette"></div>' +
      '<div class="prop" id="prop" hidden></div>' +
      '<div class="zone-ed">' +
      '<textarea id="ta" spellcheck="true" placeholder="## Couplet 1&#10;[Am]Écris ta première ligne [F]ici&#10;[C]et les accords entre [G]crochets">' + esc(brouillon.contenu) + '</textarea>' +
      '<div class="apercu" id="apercu" hidden></div>' +
      '</div>' +
      '<div class="actions-ed">' +
      '<button type="submit" class="btn primaire">Enregistrer</button>' +
      '<button type="button" class="btn" data-ed="annuler">Annuler</button>' +
      '<div class="grow"></div>' +
      (creation ? '' : '<button type="button" class="btn danger" data-ed="suppr">Supprimer</button>') +
      '</div></form>';

    app.innerHTML = h;
    var ta = document.getElementById('ta');
    var form = document.getElementById('form-ed');

    function lire() {
      var fd = new FormData(form);
      brouillon.titre = (fd.get('titre') || '').trim();
      brouillon.auteur = (fd.get('auteur') || '').trim();
      brouillon.cle = (fd.get('cle') || '').trim();
      brouillon.bpm = (fd.get('bpm') || '').toString().trim();
      brouillon.capo = parseInt(fd.get('capo'), 10) || 0;
      brouillon.duree = K.lireDuree(fd.get('duree'));
      brouillon.roles = (fd.get('roles') || '').trim();
      brouillon.tags = (fd.get('tags') || '').split(',').map(function (t) { return t.trim(); }).filter(Boolean);
      brouillon.contenu = ta.value;
    }

    function majPalette() {
      lire();
      var pal = document.getElementById('palette');
      var accords = diatoniques(brouillon.cle);
      pal.innerHTML = accords.length
        ? '<span class="pl">Accords de ' + esc(brouillon.cle) + ' :</span>' + accords.map(function (a) {
            return '<button type="button" class="pa" data-ins="' + esc(a) + '">' + esc(a) + '</button>';
          }).join('')
        : '<span class="pl">Indique une tonalité pour avoir les accords sous la main.</span>';
      pal.querySelectorAll('[data-ins]').forEach(function (b) {
        b.onclick = function () { inserer('[' + b.dataset.ins + ']'); };
      });
    }

    function inserer(txt, dedans) {
      var d = ta.selectionStart, f = ta.selectionEnd;
      var sel = ta.value.slice(d, f);
      var ins = txt.replace('§', sel);
      ta.value = ta.value.slice(0, d) + ins + ta.value.slice(f);
      var pos = d + (dedans !== undefined ? dedans : ins.length);
      ta.focus(); ta.setSelectionRange(pos, pos);
      majApercu();
    }

    function majApercu() {
      var ap = document.getElementById('apercu');
      if (ap.hidden) return;
      lire();
      ap.innerHTML = '<div class="chanson">' + K.rendu(brouillon, 0) + '</div>';
    }

    app.querySelectorAll('[data-ed]').forEach(function (b) {
      b.onclick = function () {
        var a = b.dataset.ed;
        if (a === 'accord') inserer('[§]', 1);
        else if (a === 'partie') inserer('\n## §\n', 4);
        else if (a === 'indic') inserer('\n> §\n', 3);
        else if (a === 'feuille') collerFeuille(ta, form, majApercu);
        else if (a === 'tap') taperTempo(b, form);
        else if (a === 'cle') {
          lire();
          var devine = window.Conversion && Conversion.devinerTonalite(brouillon.contenu);
          if (!devine) { toast('Pas assez d’accords pour trancher.'); return; }
          form.cle.value = devine;
          form.cle.dispatchEvent(new Event('input', { bubbles: true }));
          toast('Tonalité : ' + devine + '. Corrige si je me trompe.');
        }
        else if (a === 'apercu') {
          var ap = document.getElementById('apercu');
          ap.hidden = !ap.hidden;
          b.classList.toggle('actif', !ap.hidden);
          document.querySelector('.zone-ed').classList.toggle('double', !ap.hidden);
          majApercu();
        } else if (a === 'annuler') {
          history.length > 1 ? history.back() : go('#/');
        } else if (a === 'suppr') {
          if (!confirm('Supprimer « ' + (s.titre || 'Sans titre') + ' » ? C’est définitif sur cet appareil.')) return;
          state.chansons = state.chansons.filter(function (x) { return x.id !== s.id; });
          state.setlists.forEach(function (l) { l.chansons = l.chansons.filter(function (x) { return x !== s.id; }); });
          K.save(); toast('Supprimée.'); go('#/');
        }
      };
    });

    ta.addEventListener('input', majApercu);

    // Une feuille collée depuis ailleurs : on propose, on n'impose pas.
    ta.addEventListener('paste', function () {
      setTimeout(function () {
        majApercu();
        var prop = document.getElementById('prop');
        if (!window.Conversion || !Conversion.ressembleAUneFeuille(ta.value)) { prop.hidden = true; return; }
        prop.hidden = false;
        prop.innerHTML = '<span>On dirait une feuille d’accords à l’ancienne. La convertir ?</span>' +
          '<button type="button" class="b" id="prop-oui">Convertir</button>' +
          '<button type="button" class="b" id="prop-non">Laisser</button>';
        document.getElementById('prop-non').onclick = function () { prop.hidden = true; };
        document.getElementById('prop-oui').onclick = function () {
          appliquerConversion(Conversion.convertirFeuille(ta.value), ta, form);
          prop.hidden = true;
          majApercu();
        };
      }, 0);
    });
    form.addEventListener('input', function (e) {
      if (e.target.name === 'cle') majPalette();
    });

    // Tab insère une tabulation plutôt que de sortir du champ.
    ta.addEventListener('keydown', function (e) {
      if (e.key === 'Tab') { e.preventDefault(); inserer('    '); }
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); form.requestSubmit(); }
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      lire();
      if (!brouillon.titre && !brouillon.contenu.trim()) { toast('Rien à enregistrer.'); return; }
      brouillon.maj = Date.now();
      if (creation) state.chansons.push(brouillon);
      else Object.assign(s, brouillon);
      K.save();
      toast('Enregistré.');
      go('#/s/' + encodeURIComponent(brouillon.id));
    });

    majPalette();
  };


  /* ------------------------------------------------------------- coller une feuille */

  /** Applique une conversion au brouillon, en ne remplissant que les cases vides. */
  function appliquerConversion(res, ta, form) {
    ta.value = res.texte;
    if (res.meta.capo && !form.capo.value) form.capo.value = res.meta.capo;
    if (res.meta.bpm && !form.bpm.value) form.bpm.value = res.meta.bpm;
    if (res.meta.cle && !form.cle.value) form.cle.value = res.meta.cle;
    if (!form.cle.value) {
      var devine = Conversion.devinerTonalite(res.texte);
      if (devine) form.cle.value = devine;
    }
    form.cle.dispatchEvent(new Event('input', { bubbles: true }));
    var dit = [];
    if (res.converties) dit.push(res.converties + ' ligne' + (res.converties > 1 ? 's' : '') + ' d’accords replacée' + (res.converties > 1 ? 's' : ''));
    if (res.parties) dit.push(res.parties + ' partie' + (res.parties > 1 ? 's' : ''));
    toast(dit.length ? dit.join(', ') + '. Relis quand même.' : 'Rien à convertir ici.');
  }

  function collerFeuille(ta, form, majApercu) {
    var f = document.createElement('div');
    f.className = 'feuille';
    f.innerHTML = '<div class="voile"></div><div class="menu fiche large" style="text-align:left">' +
      '<p class="mt">Coller une feuille d’accords</p>' +
      '<p class="enr-txt">Le format courant : les accords sur une ligne, les paroles ' +
      'juste en dessous. Colle tel quel — les accords retombent sur la bonne syllabe.</p>' +
      '<textarea id="fe-brut" class="notes-set" placeholder="Am          F\nLa première ligne de la chanson"></textarea>' +
      '<div id="fe-apercu"></div>' +
      '<button class="btn primaire large" id="fe-ok" disabled>Convertir et insérer</button>' +
      '<button class="annuler" id="fe-non">Annuler</button></div>';
    document.body.appendChild(f);

    var brut = document.getElementById('fe-brut');
    var zone = document.getElementById('fe-apercu');
    var ok = document.getElementById('fe-ok');
    var fermer = function () { f.remove(); };
    f.querySelector('.voile').onclick = fermer;
    document.getElementById('fe-non').onclick = fermer;

    function rafraichir() {
      var t = brut.value;
      if (!t.trim()) { zone.innerHTML = ''; ok.disabled = true; return; }
      var res = Conversion.convertirFeuille(t);
      ok.disabled = false;
      zone.innerHTML = '<p class="fe-bilan">' +
        (res.converties ? res.converties + ' ligne(s) d’accords replacée(s)' : 'aucune ligne d’accords repérée') +
        (res.parties ? ' · ' + res.parties + ' partie(s)' : '') +
        (res.meta.capo ? ' · capo ' + res.meta.capo : '') +
        (res.meta.cle ? ' · en ' + esc(res.meta.cle) : '') + '</p>' +
        '<div class="chanson apercu-fe">' + K.rendu({ contenu: res.texte, cle: res.meta.cle || '' }, 0) + '</div>';
    }
    brut.addEventListener('input', rafraichir);
    brut.addEventListener('paste', function () { setTimeout(rafraichir, 0); });

    ok.onclick = function () {
      var res = Conversion.convertirFeuille(brut.value);
      if (ta.value.trim()) res.texte = ta.value.replace(/\s+$/, '') + '\n\n' + res.texte;
      appliquerConversion(res, ta, form);
      fermer();
      majApercu();
    };
    setTimeout(function () { brut.focus(); }, 50);
  }

  /** Quatre frappes en rythme valent mieux qu'un chiffre deviné. */
  var frappes = [];
  function taperTempo(bouton, form) {
    var t = Date.now();
    if (frappes.length && t - frappes[frappes.length - 1] > 2500) frappes = [];
    frappes.push(t);
    if (frappes.length < 2) { bouton.textContent = '♩ encore…'; return; }

    var ecarts = [];
    for (var i = 1; i < frappes.length; i++) ecarts.push(frappes[i] - frappes[i - 1]);
    ecarts = ecarts.slice(-6).sort(function (a, b) { return a - b; });
    var median = ecarts[Math.floor(ecarts.length / 2)];
    var bpm = Math.round(60000 / median);
    if (bpm < 30 || bpm > 260) { bouton.textContent = '♩ taper le tempo'; frappes = []; return; }
    form.bpm.value = bpm;
    bouton.textContent = '♩ ' + bpm + ' bpm';
  }

  function champ(nom, label, val, type, ph) {
    return '<label class="champ"><span>' + esc(label) + '</span>' +
      '<input name="' + nom + '" type="' + type + '" value="' + esc(val) + '" placeholder="' + esc(ph || '') + '"' +
      (type === 'number' ? ' inputmode="numeric"' : '') + '></label>';
  }

  // Les accords de la tonalité, pour les avoir à portée de clic.
  function diatoniques(cle) {
    var c = C.parse((cle || '').replace(/m$/, ''));
    if (!c) return [];
    var mineur = /m$/.test(cle || '');
    var degres = mineur
      ? [[0, 'm'], [2, 'dim'], [3, ''], [5, 'm'], [7, 'm'], [8, ''], [10, '']]
      : [[0, ''], [2, 'm'], [4, 'm'], [5, ''], [7, ''], [9, 'm'], [11, 'dim']];
    var flats = C.prefersFlats(cle, 0);
    return degres.map(function (d) { return C.spell(c.root + d[0], flats) + d[1]; });
  }

  /* ------------------------------------------------------------- setlists */

  Vues.setlists = function () {
    var h = '<div class="rechbar"><h1 class="h1">Setlists</h1><button class="btn primaire" id="new-set">+ Setlist</button></div>';
    if (!state.setlists.length) {
      h += vide('Pas encore de setlist.', 'Une setlist, c’est l’ordre des morceaux pour une répétition ou un concert.');
    } else {
      h += '<ul class="liste">' + state.setlists.map(function (l) {
        return '<li><a href="#/l/' + l.id + '"><span class="t">' + esc(l.nom) + '</span>' +
          '<span class="m">' + l.chansons.length + ' titre' + (l.chansons.length > 1 ? 's' : '') +
          (l.date ? ' · ' + esc(l.date) : '') + '</span></a></li>';
      }).join('') + '</ul>';
    }
    app.innerHTML = h;
    document.getElementById('new-set').onclick = function () {
      var nom = prompt('Nom de la setlist ?', 'Répétition du ' + new Date().toLocaleDateString('fr-FR'));
      if (!nom) return;
      var l = { id: K.uid(), nom: nom.trim(), date: '', chansons: [], notes: '' };
      state.setlists.push(l); K.save(); go('#/l/' + l.id);
    };
  };

  Vues.setlist = function () {
    var l = state.setlists.filter(function (x) { return x.id === V.route().params.id; })[0];
    if (!l) { app.innerHTML = vide('Setlist introuvable.', '<a href="#/sets">Toutes les setlists</a>'); return; }

    var mesure = minuter(l);
    var h = '<div class="titre-ch"><h1 contenteditable="true" id="nom-set">' + esc(l.nom) + '</h1>' +
      '<p class="meta"><input id="date-set" type="text" class="inline" placeholder="date ou lieu" value="' + esc(l.date || '') + '"></p>' +
      (l.chansons.length ? '<p class="meta">' + l.chansons.length + ' titre' + (l.chansons.length > 1 ? 's' : '') +
        (mesure.total ? ' · <b>' + (mesure.manquantes ? 'au moins ' : '') + K.dureeLongue(mesure.total) + '</b>' : '') +
        (mesure.manquantes ? ' · <span class="alerte">' + mesure.manquantes + ' sans durée</span>' : '') +
        '</p>' : '') +
      '</div>';

    if (!l.chansons.length) {
      h += vide('Setlist vide.', 'Ajoute des morceaux ci-dessous.');
    } else {
      h += '<ol class="setliste">' + l.chansons.map(function (id, i) {
        var s = K.trouver(id);
        var titre = s ? (s.titre || 'Sans titre') : 'Chanson supprimée';
        var d = s ? dureeDe(s) : null;
        var meta = s ? [
          s.cle ? 'en ' + s.cle : '', s.bpm ? s.bpm + ' bpm' : '', s.capo ? 'capo ' + s.capo : '',
          d ? (d.estimee ? '~' : '') + K.ecrireDuree(d.sec) : ''
        ].filter(Boolean).join(' · ') : '';
        return '<li><a class="t" href="#/s/' + encodeURIComponent(id) + '?set=' + l.id + '">' + esc(titre) +
          (meta ? ' <span class="m">' + esc(meta) + '</span>' : '') + '</a>' +
          '<span class="ord">' +
          '<button data-up="' + i + '"' + (i === 0 ? ' disabled' : '') + ' title="Monter">▲</button>' +
          '<button data-down="' + i + '"' + (i === l.chansons.length - 1 ? ' disabled' : '') + ' title="Descendre">▼</button>' +
          '<button data-del="' + i + '" title="Retirer">×</button></span></li>';
      }).join('') + '</ol>';
      h += '<p class="centre"><a class="btn primaire" href="#/s/' + encodeURIComponent(l.chansons[0]) + '?set=' + l.id + '">▶ Lancer la setlist</a></p>';
    }

    var dispo = K.toutes().filter(function (s) { return l.chansons.indexOf(s.id) === -1; })
      .sort(function (a, b) { return (a.titre || '').localeCompare(b.titre || '', 'fr'); });
    h += '<h2 class="sect">Ajouter</h2>';
    h += dispo.length
      ? '<ul class="liste compacte ajout">' + dispo.map(function (s) {
          return '<li><button data-add="' + esc(s.id) + '"><span class="t">' + esc(s.titre || 'Sans titre') +
            (K.estGroupe(s) ? ' <span class="badge">groupe</span>' : '') + '</span><span class="plus">+</span></button></li>';
        }).join('') + '</ul>'
      : '<p class="indic">Toutes tes chansons sont déjà dedans.</p>';

    h += '<h2 class="sect">Notes de la soirée</h2>' +
      '<textarea id="notes-set" class="notes-set" placeholder="qui annonce quoi, changements de guitare, à qui on dédie la dernière…">' +
      esc(l.notes || '') + '</textarea>';

    h += '<p class="centre"><button class="btn" id="impr-set">Imprimer la setlist</button> ' +
      '<button class="btn" id="part-set">Partager la setlist</button> ' +
      '<button class="btn danger" id="suppr-set">Supprimer la setlist</button></p>';
    app.innerHTML = h;

    var nom = document.getElementById('nom-set');
    nom.onblur = function () { l.nom = nom.textContent.trim() || 'Sans nom'; K.save(); };
    nom.onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); nom.blur(); } };
    var dt = document.getElementById('date-set');
    dt.onchange = function () { l.date = dt.value.trim(); K.save(); };

    app.querySelectorAll('[data-up]').forEach(function (b) {
      b.onclick = function () { var i = +b.dataset.up; echanger(l, i, i - 1); };
    });
    app.querySelectorAll('[data-down]').forEach(function (b) {
      b.onclick = function () { var i = +b.dataset.down; echanger(l, i, i + 1); };
    });
    app.querySelectorAll('[data-del]').forEach(function (b) {
      b.onclick = function () { l.chansons.splice(+b.dataset.del, 1); K.save(); Vues.setlist(); };
    });
    app.querySelectorAll('[data-add]').forEach(function (b) {
      b.onclick = function () { l.chansons.push(b.dataset.add); K.save(); Vues.setlist(); };
    });
    var notes = document.getElementById('notes-set');
    notes.onchange = function () { l.notes = notes.value; K.save(); };

    document.getElementById('impr-set').onclick = function () { imprimer(l); };

    document.getElementById('part-set').onclick = async function () {
      if (!l.chansons.length) { toast('Setlist vide.'); return; }
      // La setlist voyage avec ses chansons : sinon elle arrive vide chez l'autre.
      var dedans = l.chansons.map(K.trouver).filter(Boolean).map(K.nettoyer);
      var url = await K.lienPartage({ v: 1, setlist: { nom: l.nom, date: l.date }, chansons: dedans });
      if (url.length > 30000) { toast('Trop de morceaux pour un lien : passe par l’export .json.'); return; }
      var r = await K.partager(l.nom, 'Setlist : ' + l.nom, url);
      if (r === 'copie') toast('Lien copié — colle-le dans la conversation du groupe.');
      if (r === 'echec') prompt('Copie ce lien :', url);
    };

    document.getElementById('suppr-set').onclick = function () {
      if (!confirm('Supprimer la setlist « ' + l.nom + ' » ? Les chansons, elles, restent.')) return;
      state.setlists = state.setlists.filter(function (x) { return x.id !== l.id; });
      K.state.setlists = state.setlists;
      K.save(); go('#/sets');
    };
  };


  /** La durée d'un morceau : celle qu'on a saisie, sinon la plus longue prise. */
  function dureeDe(s) {
    if (s.duree) return { sec: s.duree, estimee: false };
    var audio = window.PistesUI && PistesUI.durees[s.id];
    if (audio) return { sec: Math.round(audio), estimee: true };
    return null;
  }

  function minuter(l) {
    var total = 0, manquantes = 0;
    l.chansons.forEach(function (id) {
      var s = K.trouver(id);
      var d = s && dureeDe(s);
      if (d) total += d.sec; else manquantes++;
    });
    return { total: total, manquantes: manquantes };
  }

  /** Le classeur du concert : la liste, puis chaque morceau sur sa page. */
  function imprimer(l) {
    var ancien = document.getElementById('impression');
    if (ancien) ancien.remove();
    var mesure = minuter(l);

    var h = '<div class="page garde">' +
      '<h1>' + esc(l.nom) + '</h1>' +
      '<p class="sous">' + [l.date, l.chansons.length + ' titre' + (l.chansons.length > 1 ? 's' : ''),
        mesure.total ? K.dureeLongue(mesure.total) : ''].filter(Boolean).map(esc).join(' · ') + '</p>' +
      '<ol class="sommaire">' + l.chansons.map(function (id) {
        var s = K.trouver(id);
        if (!s) return '<li>—</li>';
        var d = dureeDe(s);
        return '<li><span>' + esc(s.titre || 'Sans titre') + '</span><span class="pt">' +
          [s.cle ? 'en ' + s.cle : '', s.capo ? 'capo ' + s.capo : '', d ? K.ecrireDuree(d.sec) : '']
            .filter(Boolean).map(esc).join(' · ') + '</span></li>';
      }).join('') + '</ol>' +
      (l.notes ? '<div class="notes-impr"><h3>Notes</h3><p>' + esc(l.notes).replace(/\n/g, '<br>') + '</p></div>' : '') +
      '</div>';

    l.chansons.forEach(function (id) {
      var s = K.trouver(id);
      if (!s) return;
      var meta = [s.auteur, s.cle ? 'en ' + s.cle : '', s.capo ? 'capo ' + s.capo : '',
        s.bpm ? s.bpm + ' bpm' : ''].filter(Boolean).join(' · ');
      h += '<div class="page"><h2>' + esc(s.titre || 'Sans titre') + '</h2>' +
        (meta ? '<p class="sous">' + esc(meta) + '</p>' : '') +
        (s.roles ? '<p class="sous">' + esc(s.roles) + '</p>' : '') +
        '<div class="chanson">' + K.rendu(s, s.transpose || 0) + '</div></div>';
    });

    var zone = document.createElement('div');
    zone.id = 'impression';
    zone.innerHTML = h;
    document.body.appendChild(zone);
    document.body.classList.add('mode-impression');

    var nettoyer = function () {
      document.body.classList.remove('mode-impression');
      var z = document.getElementById('impression');
      if (z) z.remove();
      window.removeEventListener('afterprint', nettoyer);
    };
    window.addEventListener('afterprint', nettoyer);
    setTimeout(function () { window.print(); }, 60);
    setTimeout(nettoyer, 60000);   // filet, si afterprint ne vient jamais
  }

  function echanger(l, a, b) {
    if (b < 0 || b >= l.chansons.length) return;
    var t = l.chansons[a]; l.chansons[a] = l.chansons[b]; l.chansons[b] = t;
    K.save(); Vues.setlist();
  }

  /* ------------------------------------------------------------- réglages */

  Vues.reglages = function () {
    var r = state.reglages;
    var h = '<h1 class="h1">Réglages</h1>';
    h += '<div class="bloc-reglage"><h2>Affichage</h2>' +
      '<label class="ligne-reg">Thème ' +
      '<select id="theme">' + [['auto', 'Automatique'], ['sombre', 'Sombre'], ['clair', 'Clair']].map(function (t) {
        return '<option value="' + t[0] + '"' + (r.theme === t[0] ? ' selected' : '') + '>' + t[1] + '</option>';
      }).join('') + '</select></label>' +
      '<label class="ligne-reg">Taille du texte <input type="range" id="taille" min="12" max="34" value="' + r.taille + '"><span id="taille-val">' + r.taille + '</span></label>' +
      '<label class="ligne-reg"><input type="checkbox" id="dia"' + (r.diagrammes ? ' checked' : '') + '> Diagrammes d’accords</label>' +
      '</div>';

    h += '<div class="bloc-reglage"><h2>Sauvegarde</h2>' +
      '<p class="aide">Tes chansons vivent dans ce navigateur. Exporte de temps en temps — et partage le fichier au groupe.</p>' +
      '<div class="rangee">' +
      '<button class="btn" id="exp">Exporter tout (.json)</button>' +
      '<button class="btn" id="imp">Importer un fichier</button>' +
      '<button class="btn" id="lien-tout">Lien de partage du carnet</button>' +
      '<input type="file" id="fichier" accept=".json,application/json" hidden>' +
      '</div></div>';

    h += '<div class="bloc-reglage" id="bloc-audio"><h2>Pistes audio</h2>' +
      '<p class="aide" id="poids-audio">Calcul de la place occupée…</p>' +
      '<p class="aide"><b>Les pistes ne sont pas dans l’export .json.</b> Ce sont des fichiers, ' +
      'pas du texte : pour en sauvegarder une, ouvre la chanson, menu ⋯ de la piste → ' +
      '<i>Exporter le fichier</i>.</p></div>';

    h += '<div class="bloc-reglage"><h2>À propos</h2>' +
      '<p class="aide">Carnet ' + K.VERSION + ' · ' + state.chansons.length + ' chanson(s) à toi, ' +
      K.groupe.length + ' dans le répertoire du groupe.</p>' +
      '<p class="aide"><a href="#/aide">Comment écrire une chanson →</a></p>' +
      (K.depot ? '<p class="aide"><a href="https://github.com/' + esc(K.depot.owner) + '/' + esc(K.depot.repo) + '" target="_blank" rel="noopener">Le dépôt du groupe sur GitHub →</a></p>' : '') +
      '<p class="aide">Installation : sur téléphone, « Ajouter à l’écran d’accueil ». L’app marche ensuite sans réseau, en répète comme en concert.</p>' +
      '</div>';

    h += '<div class="bloc-reglage danger-zone"><h2>Zone rouge</h2>' +
      '<button class="btn danger" id="vider">Tout effacer sur cet appareil</button></div>';

    app.innerHTML = h;

    if (window.Pistes) {
      Promise.all([Pistes.toutes(), Pistes.poidsTotal()]).then(function (r) {
        var el = document.getElementById('poids-audio');
        if (!el) return;
        el.innerHTML = r[0].length
          ? r[0].length + ' piste(s), ' + Pistes.poids(r[1]) + ' sur cet appareil.'
          : 'Aucune piste enregistrée pour l’instant.';
      }).catch(function () {
        var el = document.getElementById('poids-audio');
        if (el) el.textContent = 'Stockage audio indisponible sur ce navigateur.';
      });
    }

    document.getElementById('theme').onchange = function () {
      r.theme = this.value; K.save(); V.appliquerReglages();
    };
    var tr = document.getElementById('taille');
    tr.oninput = function () {
      r.taille = +tr.value; document.getElementById('taille-val').textContent = tr.value;
      K.save(); V.appliquerReglages();
    };
    document.getElementById('dia').onchange = function () { r.diagrammes = this.checked; K.save(); };

    document.getElementById('exp').onclick = function () {
      K.telecharger('carnet-' + new Date().toISOString().slice(0, 10) + '.json',
        JSON.stringify({ v: 1, exporte: new Date().toISOString(), chansons: state.chansons, setlists: state.setlists }, null, 2));
    };
    var fichier = document.getElementById('fichier');
    document.getElementById('imp').onclick = function () { fichier.click(); };
    fichier.onchange = function () {
      var f = fichier.files[0];
      if (!f) return;
      var fr = new FileReader();
      fr.onload = function () {
        try {
          var d = JSON.parse(fr.result);
          var n = fusionner(d);
          toast(n + ' chanson(s) importée(s).');
          go('#/');
        } catch (e) { toast('Fichier illisible.'); }
      };
      fr.readAsText(f);
    };
    document.getElementById('lien-tout').onclick = async function () {
      var url = await K.lienPartage({ v: 1, chansons: state.chansons.map(K.nettoyer) });
      if (url.length > 30000) { toast('Carnet trop gros pour un lien : passe par le fichier .json.'); return; }
      var res = await K.partager('Mon carnet', 'Mes chansons', url);
      if (res === 'copie') toast('Lien copié.');
      if (res === 'echec') prompt('Copie ce lien :', url);
    };
    document.getElementById('vider').onclick = function () {
      if (!confirm('Effacer toutes tes chansons et setlists de cet appareil ? Irréversible.')) return;
      if (!confirm('Vraiment ? Pense à exporter avant.')) return;
      state.chansons.length = 0; state.setlists.length = 0;
      K.save(); toast('Carnet vidé.'); go('#/');
    };
  };

  function fusionner(d) {
    var liste = (d && d.chansons) || [];
    var n = 0;
    liste.forEach(function (c) {
      if (!c || (!c.titre && !c.contenu)) return;
      var doublon = state.chansons.some(function (x) {
        return (x.titre || '').toLowerCase() === (c.titre || '').toLowerCase() && (x.contenu || '') === (c.contenu || '');
      });
      if (doublon) return;
      state.chansons.push(K.nouvelleChanson(Object.assign(K.nettoyer(c), { titre: c.titre || 'Sans titre' })));
      n++;
    });
    (d && d.setlists || []).forEach(function (l) {
      if (!l || !l.nom) return;
      if (state.setlists.some(function (x) { return x.nom === l.nom; })) return;
      state.setlists.push({ id: K.uid(), nom: l.nom, date: l.date || '', chansons: [], notes: l.notes || '' });
    });
    K.save();
    return n;
  }

  /* ------------------------------------------------------------- import par lien */

  Vues.import = function () {
    var code = V.route().params.id;
    app.innerHTML = '<p class="indic">Lecture du lien…</p>';
    K.depaqueter(code).then(function (d) {
      var liste = (d && d.chansons) || [];
      if (!liste.length) throw new Error('vide');
      var setl = d && d.setlist;
      var h = '<h1 class="h1">' + (setl
        ? 'On t’a partagé une setlist'
        : 'On t’a partagé ' + (liste.length > 1 ? liste.length + ' chansons' : 'une chanson')) + '</h1>';
      if (setl) {
        h += '<p class="aide"><b>' + esc(setl.nom || 'Sans nom') + '</b>' +
          (setl.date ? ' · ' + esc(setl.date) : '') + ' — ' + liste.length + ' titre' +
          (liste.length > 1 ? 's' : '') + ', dans l’ordre.</p>';
      }
      h += '<ul class="liste">' + liste.map(function (s) {
        return '<li><span class="t">' + esc(s.titre || 'Sans titre') + '</span>' +
          '<span class="m">' + [s.auteur, s.cle ? 'en ' + s.cle : '', s.bpm ? s.bpm + ' bpm' : ''].filter(Boolean).map(esc).join(' · ') + '</span></li>';
      }).join('') + '</ul>';
      h += '<p class="centre"><button class="btn primaire" id="ok-imp">' +
        (setl ? 'Ajouter la setlist' : 'Ajouter à mon carnet') + '</button> ' +
        '<a class="btn" href="#/">Non merci</a></p>';
      h += '<details class="apercu-import"><summary>Voir avant d’ajouter</summary>' +
        liste.map(function (s) {
          return '<h3>' + esc(s.titre || 'Sans titre') + '</h3><div class="chanson">' + K.rendu(s, 0) + '</div>';
        }).join('') + '</details>';
      app.innerHTML = h;
      document.getElementById('ok-imp').onclick = function () {
        var n = fusionner({ chansons: liste });
        if (setl) {
          var ids = liste.map(function (c) {
            var m = state.chansons.filter(function (x) {
              return (x.titre || '') === (c.titre || '') && (x.contenu || '') === (c.contenu || '');
            })[0];
            return m ? m.id : null;
          }).filter(Boolean);
          var nouvelle = {
            id: K.uid(), nom: setl.nom || 'Setlist partagée',
            date: setl.date || '', chansons: ids, notes: ''
          };
          state.setlists.push(nouvelle);
          K.save();
          toast('Setlist ajoutée' + (n ? ' avec ' + n + ' nouvelle(s) chanson(s).' : '.'));
          go('#/l/' + nouvelle.id);
          return;
        }
        toast(n ? n + ' chanson(s) ajoutée(s).' : 'Déjà dans ton carnet.');
        go('#/');
      };
    }).catch(function () {
      app.innerHTML = vide('Lien illisible.', 'Il a peut-être été coupé en route. Demande qu’on te le renvoie en entier.');
    });
  };

  /* ------------------------------------------------------------- aide */

  Vues.aide = function () {
    var onglet = V.route().params.onglet === 'partager' ? 'partager' : 'ecrire';
    var h = '<h1 class="h1">Mode d’emploi</h1>' +
      '<div class="onglets">' +
      '<a class="onglet' + (onglet === 'ecrire' ? ' actif' : '') + '" href="#/aide">Écrire une chanson</a>' +
      '<a class="onglet' + (onglet === 'partager' ? ' actif' : '') + '" href="#/aide/partager">Partager au groupe</a>' +
      '</div>';
    app.innerHTML = h + (onglet === 'partager' ? aidePartager() : aideEcrire());
  };

  function aideEcrire() {
    var exemple = [
      '## Couplet 1',
      '[Am]Le texte va comme ça, [F]l’accord tombe sur la syllabe',
      '[C]où tu le places dans la [G]ligne',
      '',
      '## Refrain',
      '> doucement, voix seule la première fois',
      '[F]Refrain [C]refrain [G]refrain',
      '',
      '## Pont',
      'Am  F  C  G'
    ].join('\n');

    return '<p class="aide">Quatre règles, et c’est tout.</p>' +
      '<div class="regles">' +
      regle('[Am]', 'Un accord', 'Entre crochets, collé à la syllabe où il tombe. <code>[Am]Le texte</code>.') +
      regle('##', 'Une partie', 'Une ligne qui commence par <code>##</code> : couplet, refrain, pont, solo.') +
      regle('&gt;', 'Une indication', 'Une ligne qui commence par <code>&gt;</code> : nuance, arrangement, note pour le groupe.') +
      regle('Am F C G', 'Une grille', 'Une ligne faite uniquement d’accords est reconnue toute seule — pratique pour les intros.') +
      '</div>' +
      '<div class="encart"><p><b>Tu as déjà la chanson écrite ailleurs ?</b> ' +
      'Ne retape rien. Dans l’éditeur, <b>Coller une feuille</b> prend le format courant — ' +
      'les accords sur une ligne, les paroles en dessous — et replace chaque accord ' +
      'sur sa syllabe. Il récupère au passage le capo, le tempo et les titres de parties. ' +
      'Un simple collage dans la zone de texte te le propose aussi.</p></div>' +
      '<h2 class="sect">Ce que ça donne</h2>' +
      '<div class="deux-col"><pre class="code">' + esc(exemple) + '</pre>' +
      '<div class="chanson">' + K.rendu({ contenu: exemple, cle: 'Am' }, 0) + '</div></div>' +
      '<h2 class="sect">Et ensuite</h2>' +
      '<ul class="puces">' +
      '<li><b>Transposer</b> : les boutons − et + en haut de la chanson. Ça ne touche pas au texte, c’est juste l’affichage. « Figer » dans le menu ⋯ réécrit pour de bon.</li>' +
      '<li><b>Le tempo à l’oreille</b> : le bouton <i>♩ taper le tempo</i> — tu tapes quatre fois ' +
      'en rythme, il remplit le bpm.</li>' +
      '<li><b>La tonalité</b> : le bouton <i>Tonalité ?</i> la devine d’après les accords employés. ' +
      'Elle sert à la palette d’accords et au choix dièses ou bémols.</li>' +
      '<li><b>Un accord qui t’échappe ?</b> Clique dessus, dans les paroles comme dans le ' +
      'bandeau du haut : la position s’affiche, jusqu’à trois façons de le plaquer, ' +
      'et les notes qu’on entend.</li>' +
      '<li><b>Capo</b> : indique la case dans la fiche. Le bouton <i>capo</i> bascule entre les accords qui sonnent et ceux que tu plaques réellement.</li>' +
      '<li><b>Défiler</b> : le défilement automatique, avec sa vitesse réglable, pour jouer sans lâcher l’instrument.</li>' +
      '<li><b>Setlists</b> : l’ordre des morceaux d’une répète ou d’un concert, avec précédent / suivant pendant qu’on joue. ' +
      'Le bouton <i>Partager la setlist</i> l’envoie entière, chansons comprises.</li>' +
      '<li><b>Mode scène</b> (menu ⋯) : plus que les paroles, en grand, et l’écran qui ne s’éteint pas.</li>' +
      '<li><b>Durée et rôles</b> : renseigne-les dans la fiche. La durée additionne le concert, ' +
      'et « qui fait quoi » s’affiche sous le titre — et sur le papier.</li>' +
      '<li><b>Imprimer la setlist</b> : une page de garde avec l’ordre, les tonalités et le minutage, ' +
      'puis un morceau par page. Le classeur du concert.</li>' +
      '<li><b>Accordeur</b> : en haut de la bibliothèque, ou depuis le menu ⋯ d’une chanson. ' +
      'Il écoute la corde et dit de combien tu es à côté. Rien n’est enregistré.</li>' +
      '<li><b>Pistes</b> : sous les paroles, enregistre une idée au micro ou dépose un fichier. ' +
      'Voir <a href="#/aide/partager">Partager au groupe</a> pour ce qui circule et ce qui reste ici.</li>' +
      '</ul>' +
      '<p class="centre"><a class="btn primaire" href="#/nouveau">Écrire une chanson</a> ' +
      '<a class="btn" href="#/aide/partager">Comment on partage →</a></p>';
  }

  function aidePartager() {
    var h = '';

    h += '<div class="encart"><p><b>Tes chansons ne quittent pas ton téléphone.</b> ' +
      'Il n’y a pas de serveur et pas de compte : tout ce que tu écris reste dans le navigateur ' +
      'de cet appareil. Personne ne le voit tant que tu n’as rien fait pour. ' +
      'Et donc : rien ne se synchronise tout seul — c’est à toi d’envoyer.</p></div>';

    h += '<h2 class="sect">Trois façons de partager</h2>';
    h += '<div class="tableau"><table>' +
      '<thead><tr><th>Ce que tu envoies</th><th>Ce qu’ils voient</th><th>Tes corrections ensuite</th></tr></thead><tbody>' +
      ligneTab('Le lien de l’app', 'Le répertoire du groupe, rien de personnel', 'Elles arrivent toutes seules') +
      ligneTab('Un lien de chanson<br><span class="pt">menu ⋯ → Partager un lien</span>', 'Cette chanson-là, recopiée chez eux', 'Non — leur copie est figée') +
      ligneTab('Le répertoire du groupe<br><span class="pt">le fichier repertoire.json</span>', 'Tout ce que tu y mets', 'Elles arrivent toutes seules') +
      ligneTab('Une piste audio<br><span class="pt">⋯ → Exporter le fichier</span>', 'Le fichier, envoyé à la main', 'Non — c’est une copie') +
      ligneTab('Une version de référence<br><span class="pt">déposée dans audio/</span>', 'Tout le groupe l’entend dans l’app', 'Elles arrivent toutes seules') +
      '</tbody></table></div>';

    h += '<h2 class="sect">Envoyer une chanson à quelqu’un</h2>' +
      '<p class="aide">Ouvre la chanson, menu <b>⋯</b> → <b>Partager un lien</b>. La chanson entière ' +
      'tient dans l’adresse : celui qui clique l’ajoute à son carnet d’un bouton, sans rien installer. ' +
      'Pratique pour « tiens, écoute celle-là » — mais si tu corriges un accord après coup, ' +
      'il garde l’ancienne version. Renvoie-lui un lien, ou passe par le répertoire.</p>';

    h += '<h2 class="sect">Mettre une chanson dans le répertoire du groupe</h2>' +
      '<p class="aide">C’est le vrai répertoire commun : tout le monde l’a en ouvrant l’app, ' +
      'et vos corrections suivent.</p>' +
      '<ol class="puces">' +
      '<li>Ouvre la chanson, menu <b>⋯</b> → <b>Proposer au répertoire du groupe</b>.</li>' +
      '<li>Ça ouvre une page GitHub déjà remplie — il n’y a plus qu’à envoyer.</li>' +
      '<li>Celui qui tient le dépôt valide, et la chanson apparaît chez tout le monde ' +
      'à la prochaine ouverture avec du réseau.</li>' +
      '</ol>';

    h += '<div class="encart attention"><p><b>Attention à ce que veut dire « partagé ».</b> ' +
      'Le dépôt est public : ce qui entre dans le répertoire du groupe est lisible ' +
      '<i>par n’importe qui sur internet</i>, pas seulement par nous. ' +
      'Pour un morceau pas fini ou qu’on garde pour soi, reste sur le lien de chanson à chanson.</p></div>';

    h += '<h2 class="sect">Les pistes audio</h2>' +
      '<p class="aide">Sous les paroles, chaque chanson a ses <b>pistes</b> : une idée fredonnée, ' +
      'une maquette, un bout de répète. Deux façons d’en ajouter — <b>🎙 Enregistrer</b> ' +
      '(décompte de quatre temps, clic du métronome en option, vumètre pendant la prise) ' +
      'ou <b>Importer</b> un fichier déjà sur l’appareil.</p>' +
      '<ul class="puces">' +
      '<li>À la lecture, le bouton <b>×1</b> descend à ×0,75 puis ×0,5 <b>sans changer la hauteur</b> : ' +
      'de quoi repiquer un passage à l’oreille.</li>' +
      '<li>Le bouton <b>⚑</b> pose un repère à l’endroit où tu es — « Refrain », « le solo » — ' +
      'et un clic dessus y retourne. Clic droit (ou appui long) sur un repère pour l’enlever.</li>' +
      '<li>Étiquette chaque prise : <i>idée · maquette · répète · live · référence</i>.</li>' +
      '</ul>' +
      '<div class="encart attention"><p><b>Une piste ne voyage pas toute seule.</b> ' +
      'Un fichier audio ne rentre pas dans un lien, et il <b>n’est pas dans l’export .json</b>. ' +
      'Pour en faire écouter une : menu <b>⋯</b> de la piste → <i>Exporter le fichier</i>, ' +
      'puis envoie-le comme n’importe quel fichier. Compte à peu près <b>1 Mo la minute</b>.</p></div>' +

      '<h2 class="sect">La version de référence</h2>' +
      '<p class="aide">Une chanson du répertoire peut porter <b>une version qui fait foi</b> : ' +
      'celle qu’on écoute avant la répète pour se remettre le morceau en tête. Elle s’affiche ' +
      'en tête des pistes, se lit en ligne, et le bouton <b>⤓</b> la garde sur l’appareil ' +
      'pour la cave.</p>' +
      '<p class="aide">Pour en proposer une : menu <b>⋯</b> de ta piste → ' +
      '<i>Proposer comme référence du groupe</i>. Il te donne le fichier à déposer et ' +
      'le bloc à coller — un audio ne peut pas s’ajouter tout seul, il faut le poser ' +
      'dans le dépôt.</p>' +

      '<h2 class="sect">L’installer, et jouer sans réseau</h2>' +
      '<ul class="puces">' +
      '<li>Ouvre le lien, puis dans le menu du navigateur : <b>« Ajouter à l’écran d’accueil »</b>. ' +
      'Ça devient une app, avec son icône.</li>' +
      '<li>Une fois ouverte une première fois, elle <b>marche sans réseau</b> — en cave de répète ' +
      'comme en coulisses. Le répertoire du groupe se remet à jour dès qu’il y a du réseau.</li>' +
      '</ul>';

    h += '<h2 class="sect">Ne pas perdre ses chansons</h2>' +
      '<p class="aide">Elles vivent dans le navigateur : si tu en vides les données, ou si tu changes ' +
      'de téléphone, elles partent avec. Prends l’habitude d’aller dans ' +
      '<a href="#/reglages">Réglages → <b>Exporter tout (.json)</b></a> de temps en temps, ' +
      'et garde le fichier quelque part. Le même écran sait le relire.</p>';

    h += '<p class="centre"><a class="btn primaire" href="#/">Retour au carnet</a> ' +
      '<a class="btn" href="#/aide">Comment écrire une chanson →</a></p>';
    return h;
  }

  function ligneTab(a, b, c) {
    // Les libellés servent d'intitulés quand la table s'empile sur téléphone.
    return '<tr><td data-l="Ce que tu envoies"><b>' + a + '</b></td>' +
      '<td data-l="Ce qu’ils voient">' + b + '</td>' +
      '<td data-l="Tes corrections ensuite">' + c + '</td></tr>';
  }

  function regle(sym, titre, texte) {
    return '<div class="regle"><code class="sym">' + sym + '</code><div><b>' + titre + '</b><p>' + texte + '</p></div></div>';
  }
})();
