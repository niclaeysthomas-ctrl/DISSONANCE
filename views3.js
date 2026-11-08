/* views3.js — l'audio côté écran : panneau des pistes, enregistreur, lecteur. */
(function () {
  'use strict';
  var K = window.Carnet, P = window.Pistes;
  var esc = K.esc, toast = K.toast;

  var UI = window.PistesUI = { comptes: {}, durees: {} };

  /* ------------------------------------------------------------- lecteur */

  var Lec = {
    el: null, audio: null, piste: null, parties: [], vitesse: 1, glisse: false,

    monter: function () {
      if (this.el) return;
      var d = document.createElement('div');
      d.id = 'lecteur';
      d.hidden = true;
      d.innerHTML =
        '<div class="lec-h">' +
        '<button class="lec-pp" id="lec-pp" aria-label="Lecture">▶</button>' +
        '<div class="lec-info"><b id="lec-nom"></b><span id="lec-sous"></span></div>' +
        '<button class="lec-b2" id="lec-vit" title="Vitesse de lecture">×1</button>' +
        '<button class="lec-b2" id="lec-rep" title="Poser un repère">⚑</button>' +
        '<button class="lec-b2" id="lec-x" title="Fermer" aria-label="Fermer">×</button>' +
        '</div>' +
        '<div class="lec-barre">' +
        '<span id="lec-t">0:00</span>' +
        '<input type="range" id="lec-scrub" min="0" max="1000" value="0" aria-label="Position">' +
        '<span id="lec-d">0:00</span>' +
        '</div>' +
        '<div class="lec-reperes" id="lec-reperes"></div>';
      document.body.appendChild(d);
      this.el = d;

      this.audio = new Audio();
      this.audio.preload = 'metadata';
      var self = this;

      document.getElementById('lec-pp').onclick = function () { self.basculer(); };
      document.getElementById('lec-x').onclick = function () { self.fermer(); };
      document.getElementById('lec-vit').onclick = function () { self.tourneVitesse(); };
      document.getElementById('lec-rep').onclick = function () { self.poserRepere(); };

      var scrub = document.getElementById('lec-scrub');
      scrub.addEventListener('input', function () {
        self.glisse = true;
        var d2 = self.audio.duration;
        if (d2 && isFinite(d2)) document.getElementById('lec-t').textContent = P.mmss(d2 * scrub.value / 1000);
      });
      scrub.addEventListener('change', function () {
        var d2 = self.audio.duration;
        if (d2 && isFinite(d2)) self.audio.currentTime = d2 * scrub.value / 1000;
        self.glisse = false;
      });

      this.audio.addEventListener('timeupdate', function () { self.majTemps(); });
      this.audio.addEventListener('loadedmetadata', function () { self.majTemps(); });
      this.audio.addEventListener('play', function () { self.majBouton(); });
      this.audio.addEventListener('pause', function () { self.majBouton(); });
      this.audio.addEventListener('ended', function () { self.majBouton(); });
    },

    jouer: function (piste, parties) {
      this.monter();
      var self = this;
      this.parties = parties || [];
      if (this.piste && this.piste.id === piste.id) { this.basculer(); return; }
      if (this.url && this.objet) URL.revokeObjectURL(this.url);
      this.piste = piste;
      this.objet = !!piste.blob;
      this.url = piste.blob ? URL.createObjectURL(piste.blob) : piste.url;
      this.audio.src = this.url;
      this.appliquerVitesse();
      this.el.hidden = false;
      document.body.classList.add('avec-lecteur');
      document.getElementById('lec-nom').textContent = piste.nom;
      document.getElementById('lec-sous').textContent =
        [piste.etiquette, K.dateFr(piste.date)].filter(Boolean).join(' · ');
      this.majReperes();
      this.audio.play().catch(function () { toast('Lecture impossible.'); });
      self.majBouton();
    },

    basculer: function () {
      if (!this.audio || !this.piste) return;
      if (this.audio.paused) this.audio.play().catch(function () {});
      else this.audio.pause();
    },

    majBouton: function () {
      var b = document.getElementById('lec-pp');
      if (!b) return;
      var enCours = this.audio && !this.audio.paused;
      b.textContent = enCours ? '⏸' : '▶';
      b.setAttribute('aria-label', enCours ? 'Pause' : 'Lecture');
      document.querySelectorAll('[data-lire]').forEach(function (x) {
        var actif = enCours && Lec.piste && x.dataset.lire === Lec.piste.id;
        x.textContent = actif ? '⏸' : '▶';
        x.classList.toggle('actif', actif);
      });
    },

    majTemps: function () {
      if (!this.el || this.el.hidden) return;
      var d = this.audio.duration, t = this.audio.currentTime;
      if (!this.glisse) {
        document.getElementById('lec-t').textContent = P.mmss(t);
        var s = document.getElementById('lec-scrub');
        s.value = (d && isFinite(d)) ? Math.round(t / d * 1000) : 0;
      }
      document.getElementById('lec-d').textContent =
        (d && isFinite(d)) ? P.mmss(d) : P.mmss(this.piste && this.piste.duree);
    },

    tourneVitesse: function () {
      var suite = [1, 0.75, 0.5];
      this.vitesse = suite[(suite.indexOf(this.vitesse) + 1) % suite.length];
      this.appliquerVitesse();
      document.getElementById('lec-vit').textContent = '×' + String(this.vitesse).replace('0.', ',').replace('1', this.vitesse === 1 ? '1' : '1');
      document.getElementById('lec-vit').textContent = '×' + (this.vitesse === 1 ? '1' : String(this.vitesse).replace('.', ','));
      document.getElementById('lec-vit').classList.toggle('actif', this.vitesse !== 1);
    },

    appliquerVitesse: function () {
      if (!this.audio) return;
      // La hauteur ne doit pas bouger : on ralentit pour repiquer, pas pour détuner.
      this.audio.preservesPitch = true;
      this.audio.webkitPreservesPitch = true;
      this.audio.mozPreservesPitch = true;
      this.audio.playbackRate = this.vitesse;
    },

    poserRepere: function () {
      if (!this.piste) return;
      if (this.piste.distante) {
        toast('Garde-la hors-ligne d’abord : un repère doit se ranger quelque part.');
        return;
      }
      var t = this.audio.currentTime;
      var deja = (this.piste.reperes || []).length;
      var defaut = this.parties[deja] || ('Repère ' + (deja + 1));
      var nom = prompt('Nom du repère à ' + P.mmss(t), defaut);
      if (nom === null) return;
      var reperes = (this.piste.reperes || []).concat([{ t: t, nom: nom.trim() || defaut }]);
      reperes.sort(function (a, b) { return a.t - b.t; });
      this.piste.reperes = reperes;
      var self = this;
      P.maj(this.piste.id, { reperes: reperes }).then(function () {
        self.majReperes();
        toast('Repère posé.');
      });
    },

    majReperes: function () {
      var z = document.getElementById('lec-reperes');
      if (!z) return;
      var r = (this.piste && this.piste.reperes) || [];
      z.innerHTML = r.length ? r.map(function (x, i) {
        return '<button class="rep" data-t="' + x.t + '" data-i="' + i + '">' +
          esc(x.nom) + ' <span>' + P.mmss(x.t) + '</span></button>';
      }).join('') : '';
      var self = this;
      z.querySelectorAll('[data-t]').forEach(function (b) {
        b.onclick = function () { self.audio.currentTime = +b.dataset.t; self.audio.play().catch(function () {}); };
        b.oncontextmenu = function (e) {
          e.preventDefault();
          if (!confirm('Enlever le repère « ' + self.piste.reperes[+b.dataset.i].nom + ' » ?')) return;
          var reperes = self.piste.reperes.filter(function (_, i) { return i !== +b.dataset.i; });
          self.piste.reperes = reperes;
          P.maj(self.piste.id, { reperes: reperes }).then(function () { self.majReperes(); });
        };
      });
    },

    fermer: function () {
      if (!this.el) return;
      this.audio.pause();
      this.el.hidden = true;
      document.body.classList.remove('avec-lecteur');
      this.piste = null;
      this.majBouton();
    },

    oublier: function (id) { if (this.piste && this.piste.id === id) this.fermer(); }
  };

  /* ------------------------------------------------------------- panneau */

  UI.panneau = function () {
    return '<section class="pistes" id="pistes">' +
      '<h2 class="sect">Pistes</h2>' +
      '<div class="rangee">' +
      '<button class="b" data-p="enr">🎙 Enregistrer</button>' +
      '<button class="b" data-p="imp">+ Importer un fichier</button>' +
      '<input type="file" id="fich-audio" accept="audio/*" multiple hidden>' +
      '</div>' +
      '<div id="liste-pistes"><p class="indic">…</p></div>' +
      '</section>';
  };

  UI.monter = function (chanson) {
    var zone = document.getElementById('pistes');
    if (!zone) return;
    var parties = K.analyser(chanson.contenu)
      .filter(function (b) { return b.type === 'partie'; })
      .map(function (b) { return b.label; });

    zone.querySelector('[data-p="enr"]').onclick = function () {
      if (!P.possible()) { toast('Ce navigateur ne sait pas enregistrer le micro.'); return; }
      ouvrirEnregistreur(chanson, function () { UI.rafraichir(chanson, parties); });
    };
    var fich = document.getElementById('fich-audio');
    zone.querySelector('[data-p="imp"]').onclick = function () { fich.click(); };
    fich.onchange = function () { importer(chanson, fich.files, parties); fich.value = ''; };

    UI.rafraichir(chanson, parties);
  };

  UI.rafraichir = function (chanson, parties) {
    var zone = document.getElementById('liste-pistes');
    if (!zone) return;
    P.lister(chanson.id).then(function (liste) {
      UI.comptes[chanson.id] = liste.length;
      var ref = chanson.reference;
      var dejaLa = ref && liste.filter(function (p) { return p.depot === ref.fichier; })[0];
      var ligneRef = (ref && !dejaLa) ? '<li class="ref">' +
        '<button class="lire" data-lireref="1" aria-label="Écouter">▶</button>' +
        '<div class="pi"><b>' + esc(ref.nom || 'Version de référence') + '</b>' +
        '<span class="m">référence du groupe · ' + (ref.duree ? P.mmss(ref.duree) + ' · ' : '') +
        'en ligne</span></div>' +
        '<button class="pmenu" data-dl="1" title="Garder hors-ligne">⤓</button></li>' : '';

      if (!liste.length && !ligneRef) {
        zone.innerHTML = '<p class="indic">Aucune piste. Enregistre une idée, ou dépose un fichier déjà prêt.</p>';
        return;
      }
      zone.innerHTML = '<ul class="liste-pistes">' + ligneRef + liste.map(function (p) {
        return '<li>' +
          '<button class="lire" data-lire="' + p.id + '" aria-label="Écouter">▶</button>' +
          '<div class="pi"><b>' + esc(p.nom) + '</b><span class="m">' +
          [p.etiquette, P.mmss(p.duree), P.poids(p.taille), K.dateFr(p.date)].filter(Boolean).map(esc).join(' · ') +
          ((p.reperes && p.reperes.length) ? ' · ' + p.reperes.length + ' repère' + (p.reperes.length > 1 ? 's' : '') : '') +
          '</span></div>' +
          '<button class="pmenu" data-pm="' + p.id + '" aria-label="Plus">⋯</button>' +
          '</li>';
      }).join('') + '</ul>';

      var brRef = zone.querySelector('[data-lireref]');
      if (brRef) brRef.onclick = function () {
        Lec.jouer({
          id: 'ref:' + ref.fichier, nom: ref.nom || 'Version de référence',
          etiquette: 'référence du groupe', url: ref.fichier, duree: ref.duree || 0,
          date: null, distante: true, reperes: []
        }, parties);
      };
      var bdl = zone.querySelector('[data-dl]');
      if (bdl) bdl.onclick = function () { garderHorsLigne(chanson, ref, parties, bdl); };

      zone.querySelectorAll('[data-lire]').forEach(function (b) {
        b.onclick = function () {
          var p = liste.filter(function (x) { return x.id === b.dataset.lire; })[0];
          if (p) Lec.jouer(p, parties);
        };
      });
      zone.querySelectorAll('[data-pm]').forEach(function (b) {
        b.onclick = function () {
          var p = liste.filter(function (x) { return x.id === b.dataset.pm; })[0];
          if (p) menuPiste(p, chanson, parties);
        };
      });
      Lec.majBouton();
    }).catch(function () {
      zone.innerHTML = '<p class="indic">Les pistes n’ont pas pu être lues sur cet appareil.</p>';
    });
  };

  function menuPiste(p, chanson, parties) {
    var f = document.createElement('div');
    f.className = 'feuille';
    f.innerHTML = '<div class="voile"></div><div class="menu">' +
      '<p class="mt">' + esc(p.nom) + '</p>' +
      '<button data-m="renommer">Renommer</button>' +
      '<button data-m="etiquette">Changer l’étiquette</button>' +
      '<button data-m="exporter">Exporter le fichier</button>' +
      '<button data-m="reference">Proposer comme référence du groupe</button>' +
      '<button data-m="supprimer" class="danger">Supprimer</button>' +
      '<button data-m="" class="annuler">Annuler</button></div>';
    document.body.appendChild(f);
    var fermer = function () { f.remove(); };
    f.querySelector('.voile').onclick = fermer;
    f.querySelectorAll('[data-m]').forEach(function (b) {
      b.onclick = function () {
        var a = b.dataset.m;
        fermer();
        if (a === 'renommer') {
          var n = prompt('Nom de la piste', p.nom);
          if (n === null) return;
          P.maj(p.id, { nom: n.trim() || p.nom }).then(function () { UI.rafraichir(chanson, parties); });
        } else if (a === 'etiquette') {
          choisirEtiquette(p.etiquette, function (e) {
            P.maj(p.id, { etiquette: e }).then(function () { UI.rafraichir(chanson, parties); });
          });
        } else if (a === 'exporter') {
          var nom = (p.nom || 'piste').replace(/[\/\\:*?"<>|]/g, '-') + '.' + P.extension(p.mime);
          K.telecharger(nom, p.blob, p.mime);
        } else if (a === 'reference') {
          proposerReference(p, chanson);
        } else if (a === 'supprimer') {
          if (!confirm('Supprimer « ' + p.nom + ' » ? L’enregistrement est perdu.')) return;
          P.supprimer(p.id).then(function () {
            Lec.oublier(p.id);
            toast('Piste supprimée.');
            UI.rafraichir(chanson, parties);
          });
        }
      };
    });
  }


  /* ------------------------------------------------------------- référence du groupe */

  function garderHorsLigne(chanson, ref, parties, bouton) {
    bouton.disabled = true;
    bouton.textContent = '…';
    fetch(ref.fichier, { cache: 'no-cache' })
      .then(function (r) {
        if (!r.ok) throw new Error('introuvable');
        return r.blob();
      })
      .then(function (blob) {
        return P.dureeDe(blob).then(function (d) {
          return P.ajouter({
            id: K.uid(), chansonId: chanson.id,
            nom: ref.nom || 'Version de référence',
            etiquette: 'référence', depot: ref.fichier,
            mime: blob.type || 'audio/mpeg', taille: blob.size,
            duree: d || ref.duree || 0, date: Date.now(), blob: blob, reperes: []
          });
        });
      })
      .then(function () {
        toast('Gardée sur l’appareil.');
        UI.rafraichir(chanson, parties);
      })
      .catch(function () {
        bouton.disabled = false;
        bouton.textContent = '⤓';
        toast('Téléchargement impossible — réseau ?');
      });
  }

  // Comment faire entrer une prise dans le répertoire commun : il faut déposer
  // un fichier, ce qu'aucun lien ne sait faire tout seul.
  function proposerReference(p, chanson) {
    var d = K.depot;
    var fichier = 'audio/' + (p.nom || 'reference').toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.' + P.extension(p.mime);
    var bloc = JSON.stringify({
      fichier: fichier, nom: p.nom, duree: Math.round(p.duree || 0)
    }, null, 2);

    var f = document.createElement('div');
    f.className = 'feuille';
    f.innerHTML = '<div class="voile"></div><div class="menu fiche" style="text-align:left">' +
      '<p class="mt">Proposer comme référence</p>' +
      '<p class="enr-txt">Une piste du répertoire est un vrai fichier dans le dépôt. ' +
      'Trois gestes, dans l’ordre :</p>' +
      '<ol class="puces etapes">' +
      '<li>Récupère le fichier.<br><button class="b" data-r="exp">Exporter ' + esc(fichier.split('/').pop()) + '</button></li>' +
      '<li>Dépose-le dans le dossier <code>audio/</code> du dépôt.' +
      (d ? '<br><a class="b" href="https://github.com/' + esc(d.owner) + '/' + esc(d.repo) +
        '/upload/main/audio" target="_blank" rel="noopener">Ouvrir la page de dépôt</a>' : '') + '</li>' +
      '<li>Ajoute ce bloc à la chanson dans <code>repertoire.json</code>, sous la clé <code>reference</code>.' +
      '<br><button class="b" data-r="json">Copier le bloc</button></li>' +
      '</ol>' +
      '<pre class="code">' + esc(bloc) + '</pre>' +
      '<button class="annuler" data-r="">Fermer</button></div>';
    document.body.appendChild(f);
    var fermer = function () { f.remove(); };
    f.querySelector('.voile').onclick = fermer;
    f.querySelectorAll('[data-r]').forEach(function (b) {
      b.onclick = function () {
        var a = b.dataset.r;
        if (a === 'exp') K.telecharger(fichier.split('/').pop(), p.blob, p.mime);
        else if (a === 'json') K.copier(bloc).then(function (ok) { toast(ok ? 'Bloc copié.' : 'Copie impossible.'); });
        else fermer();
      };
    });
  }

  function choisirEtiquette(actuelle, suite) {
    var f = document.createElement('div');
    f.className = 'feuille';
    f.innerHTML = '<div class="voile"></div><div class="menu"><p class="mt">Étiquette</p>' +
      P.ETIQUETTES.map(function (e) {
        return '<button data-e="' + e + '"' + (e === actuelle ? ' class="coche"' : '') + '>' + e + '</button>';
      }).join('') + '<button data-e="" class="annuler">Annuler</button></div>';
    document.body.appendChild(f);
    var fermer = function () { f.remove(); };
    f.querySelector('.voile').onclick = fermer;
    f.querySelectorAll('[data-e]').forEach(function (b) {
      b.onclick = function () { fermer(); if (b.dataset.e) suite(b.dataset.e); };
    });
  }

  /* ------------------------------------------------------------- import */

  function importer(chanson, fichiers, parties) {
    var liste = Array.prototype.slice.call(fichiers || []);
    if (!liste.length) return;
    var trop = liste.filter(function (f) { return f.size > 120 * 1024 * 1024; });
    if (trop.length) { toast('Fichier trop lourd (plus de 120 Mo).'); return; }
    toast(liste.length > 1 ? 'Import de ' + liste.length + ' fichiers…' : 'Import…');

    liste.reduce(function (chaine, f) {
      return chaine.then(function () {
        return P.dureeDe(f).then(function (d) {
          return P.ajouter({
            id: K.uid(), chansonId: chanson.id,
            nom: f.name.replace(/\.[^.]+$/, ''),
            etiquette: 'maquette', mime: f.type || 'audio/mpeg',
            taille: f.size, duree: d, date: Date.now(),
            blob: f, reperes: []
          });
        });
      });
    }, Promise.resolve()).then(function () {
      toast('Importé.');
      UI.rafraichir(chanson, parties);
    }).catch(function () { toast('Import impossible.'); });
  }

  /* ------------------------------------------------------------- enregistreur */

  function ouvrirEnregistreur(chanson, apres) {
    var bpm = Math.max(30, Math.min(260, parseInt(chanson.bpm, 10) || 100));
    var enr = new P.Enregistreur();
    var f = document.createElement('div');
    f.className = 'feuille';
    f.innerHTML = '<div class="voile"></div><div class="menu enregistreur"></div>';
    document.body.appendChild(f);
    var boite = f.querySelector('.enregistreur');
    var minuteur = null, vu = null, clic = null, blob = null, apercu = null;
    var avecClic = false;

    function fermer() {
      clearInterval(minuteur); cancelAnimationFrame(vu); clearInterval(clic);
      if (apercu) { apercu.pause(); URL.revokeObjectURL(apercu.src); }
      enr.fermer();
      f.remove();
    }
    f.querySelector('.voile').onclick = function () {
      if (enr.mr && enr.mr.state === 'recording') {
        if (!confirm('Abandonner l’enregistrement en cours ?')) return;
      }
      fermer();
    };

    // 1. Réglages avant de lancer
    function ecranPret() {
      boite.innerHTML = '<p class="mt">Nouvelle prise</p>' +
        '<p class="enr-txt">Un décompte de 4 temps à <b>' + bpm + ' bpm</b>, puis ça tourne.</p>' +
        '<label class="enr-opt"><input type="checkbox" id="enr-clic"> Garder le clic pendant la prise</label>' +
        '<p class="enr-note">Avec le clic, mets un casque — sinon le micro l’enregistre avec toi.</p>' +
        '<button class="btn primaire large" id="enr-go">● Enregistrer</button>' +
        '<button class="annuler" id="enr-non">Annuler</button>';
      document.getElementById('enr-non').onclick = fermer;
      document.getElementById('enr-go').onclick = function () {
        avecClic = document.getElementById('enr-clic').checked;
        enr.ouvrir().then(decompte).catch(function () {
          boite.innerHTML = '<p class="mt">Micro refusé</p>' +
            '<p class="enr-txt">Le navigateur n’a pas donné accès au micro. Autorise-le dans les réglages du site, puis réessaie.</p>' +
            '<button class="annuler" id="enr-non2">Fermer</button>';
          document.getElementById('enr-non2').onclick = fermer;
        });
      };
    }

    // 2. Décompte
    function decompte() {
      var reste = 4;
      var intervalle = 60000 / bpm;
      boite.innerHTML = '<p class="mt">Prêt…</p><div class="enr-compte" id="enr-compte">4</div>';
      enr.clic(true);
      var tic = setInterval(function () {
        reste--;
        if (reste <= 0) { clearInterval(tic); enregistre(); return; }
        document.getElementById('enr-compte').textContent = reste;
        enr.clic(false);
      }, intervalle);
    }

    // 3. Ça tourne
    function enregistre() {
      enr.lancer();
      boite.innerHTML = '<p class="mt rouge">● Enregistrement</p>' +
        '<div class="enr-temps" id="enr-temps">0:00</div>' +
        '<div class="vu"><i id="vu-barre"></i></div>' +
        '<button class="btn primaire large" id="enr-stop">■ Arrêter</button>';
      minuteur = setInterval(function () {
        var t = document.getElementById('enr-temps');
        if (t) t.textContent = P.mmss(enr.duree());
      }, 250);
      var anim = function () {
        var b = document.getElementById('vu-barre');
        if (b) b.style.width = Math.round(enr.niveau() * 100) + '%';
        vu = requestAnimationFrame(anim);
      };
      vu = requestAnimationFrame(anim);

      if (avecClic && enr.ctx) {
        var prochain = enr.ctx.currentTime + 60 / bpm, temps = 0;
        clic = setInterval(function () {
          while (prochain < enr.ctx.currentTime + 0.15) {
            enr.clic(temps % 4 === 0);
            prochain += 60 / bpm;
            temps++;
          }
        }, 25);
      }

      document.getElementById('enr-stop').onclick = function () {
        clearInterval(minuteur); cancelAnimationFrame(vu); clearInterval(clic);
        var duree = enr.duree();
        enr.arreter().then(function (b) {
          blob = b;
          enr.fermer();
          if (!blob || !blob.size) { toast('Rien n’a été enregistré.'); fermer(); return; }
          relecture(duree);
        });
      };
    }

    // 4. On écoute avant de garder
    function relecture(duree) {
      var quand = new Date();
      var defaut = 'Prise du ' + quand.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) +
        ' ' + quand.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      boite.innerHTML = '<p class="mt">' + P.mmss(duree) + ' enregistrées</p>' +
        '<audio id="enr-ap" controls></audio>' +
        '<label class="enr-champ"><span>Nom</span><input id="enr-nom" value="' + esc(defaut) + '"></label>' +
        '<label class="enr-champ"><span>Étiquette</span><select id="enr-et">' +
        P.ETIQUETTES.map(function (e) {
          return '<option value="' + e + '"' + (e === 'idée' ? ' selected' : '') + '>' + e + '</option>';
        }).join('') + '</select></label>' +
        '<button class="btn primaire large" id="enr-save">Garder la prise</button>' +
        '<button class="annuler danger" id="enr-jeter">Jeter</button>';
      apercu = document.getElementById('enr-ap');
      apercu.src = URL.createObjectURL(blob);

      document.getElementById('enr-jeter').onclick = function () {
        if (!confirm('Jeter cette prise ?')) return;
        fermer();
      };
      document.getElementById('enr-save').onclick = function () {
        var nom = document.getElementById('enr-nom').value.trim() || defaut;
        var et = document.getElementById('enr-et').value;
        P.dureeDe(blob).then(function (d) {
          return P.ajouter({
            id: K.uid(), chansonId: chanson.id, nom: nom, etiquette: et,
            mime: blob.type, taille: blob.size, duree: d || duree,
            date: Date.now(), blob: blob, reperes: []
          });
        }).then(function () {
          fermer();
          toast('Prise gardée.');
          if (apres) apres();
        }).catch(function () { toast('Sauvegarde impossible.'); });
      };
    }

    ecranPret();
  }


  /* ------------------------------------------------------------- fiche d'accord */

  // Un accord cliqué, où qu'il soit : dans les paroles, dans la grille ou
  // dans le bandeau du haut.
  document.addEventListener('click', function (e) {
    var cible = e.target.closest ? e.target.closest('[data-ch]') : null;
    if (!cible) return;
    e.preventDefault();
    ficheAccord(cible.dataset.ch);
  });

  function ficheAccord(token) {
    var C = window.Chords;
    var pos = C.positions(token);
    var c = C.parse(token);
    var f = document.createElement('div');
    f.className = 'feuille';

    var corps;
    if (!pos.length) {
      corps = '<p class="enr-txt">Cet accord n’est pas dans mes formes. ' +
        'À toi de le montrer aux autres.</p>';
    } else {
      var notes = C.notesDe(pos[0].frets, c && c.flat);
      corps = '<div class="fiche-pos">' + pos.map(function (p) {
        return '<figure>' + C.diagram(token, { width: 116, frets: p.frets, exact: p.exact }) +
          '<figcaption>' + esc(p.etiquette) + '</figcaption></figure>';
      }).join('') + '</div>' +
        (notes.length ? '<p class="fiche-notes">' + notes.map(function (n) {
          return '<span>' + esc(n) + '</span>';
        }).join('') + '</p>' : '') +
        (pos[0].exact ? '' : '<p class="enr-note">Forme approchée : la couleur exacte de l’accord n’existe pas en position simple.</p>') +
        '<p class="fiche-aide">× corde étouffée · ○ corde à vide · la barre, c’est l’index à plat</p>';
    }

    f.innerHTML = '<div class="voile"></div><div class="menu fiche">' +
      '<p class="fiche-nom">' + esc(token) + '</p>' + corps +
      '<button class="annuler" data-fermer>Fermer</button></div>';
    document.body.appendChild(f);
    var fermer = function () { f.remove(); };
    f.querySelector('.voile').onclick = fermer;
    f.querySelector('[data-fermer]').onclick = fermer;
    document.addEventListener('keydown', function esc2(ev) {
      if (ev.key === 'Escape') { fermer(); document.removeEventListener('keydown', esc2); }
    });
  }

  UI.ficheAccord = ficheAccord;

  UI.Lecteur = Lec;

  // Les pastilles de la bibliothèque, chargées une fois au démarrage.
  P.toutes().then(function (l) {
    var c = {}, d = {};
    l.forEach(function (p) {
      c[p.chansonId] = (c[p.chansonId] || 0) + 1;
      // Faute de durée saisie, la plus longue prise donne la mesure.
      if ((p.duree || 0) > (d[p.chansonId] || 0)) d[p.chansonId] = p.duree;
    });
    UI.durees = d;
    UI.comptes = c;
    if (window.VuesInternes && VuesInternes.route().nom === 'bib') VuesInternes.naviguer();
  }).catch(function () {});
})();
