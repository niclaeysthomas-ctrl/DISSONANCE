/* audio.js — les pistes : stockage local (IndexedDB), enregistrement micro,
   import de fichiers, lecture. Rien ne sort de l'appareil. */
(function () {
  'use strict';

  var BASE = 'dissonance-audio';
  var MAGASIN = 'pistes';
  var dbp = null;

  function db() {
    if (dbp) return dbp;
    dbp = new Promise(function (res, rej) {
      var r = indexedDB.open(BASE, 1);
      r.onupgradeneeded = function (e) {
        var d = e.target.result;
        if (!d.objectStoreNames.contains(MAGASIN)) {
          var m = d.createObjectStore(MAGASIN, { keyPath: 'id' });
          m.createIndex('chanson', 'chansonId', { unique: false });
        }
      };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
    return dbp;
  }

  function tx(mode, fn) {
    return db().then(function (d) {
      return new Promise(function (res, rej) {
        var t = d.transaction(MAGASIN, mode);
        var m = t.objectStore(MAGASIN);
        var sortie;
        try { sortie = fn(m); } catch (e) { rej(e); return; }
        t.oncomplete = function () { res(sortie && sortie.result !== undefined ? sortie.result : sortie); };
        t.onerror = function () { rej(t.error); };
        t.onabort = function () { rej(t.error); };
      });
    });
  }

  function lister(chansonId) {
    return tx('readonly', function (m) {
      return m.index('chanson').getAll(chansonId);
    }).then(function (l) {
      return (l || []).sort(function (a, b) { return b.date - a.date; });
    });
  }

  function toutes() {
    return tx('readonly', function (m) { return m.getAll(); }).then(function (l) { return l || []; });
  }

  function obtenir(id) { return tx('readonly', function (m) { return m.get(id); }); }
  function ajouter(p) { return tx('readwrite', function (m) { m.put(p); }).then(function () { return p; }); }
  function supprimer(id) { return tx('readwrite', function (m) { m.delete(id); }); }

  function maj(id, champs) {
    return db().then(function (d) {
      return new Promise(function (res, rej) {
        var t = d.transaction(MAGASIN, 'readwrite');
        var m = t.objectStore(MAGASIN);
        var g = m.get(id);
        g.onsuccess = function () {
          var p = g.result;
          if (!p) { rej(new Error('piste introuvable')); return; }
          Object.keys(champs).forEach(function (k) { p[k] = champs[k]; });
          m.put(p);
        };
        t.oncomplete = function () { res(); };
        t.onerror = function () { rej(t.error); };
      });
    });
  }

  // Combien de pistes par chanson, pour la pastille de la bibliothèque.
  function comptes() {
    return toutes().then(function (l) {
      var c = {};
      l.forEach(function (p) { c[p.chansonId] = (c[p.chansonId] || 0) + 1; });
      return c;
    });
  }

  function poidsTotal() {
    return toutes().then(function (l) {
      return l.reduce(function (n, p) { return n + (p.taille || (p.blob && p.blob.size) || 0); }, 0);
    });
  }

  /* ---------------------------------------------------------- enregistrement */

  var FORMATS = [
    'audio/webm;codecs=opus',
    'audio/ogg;codecs=opus',
    'audio/webm',
    'audio/mp4;codecs=mp4a.40.2',
    'audio/mp4'
  ];

  function formatDispo() {
    if (typeof MediaRecorder === 'undefined') return null;
    for (var i = 0; i < FORMATS.length; i++) {
      try { if (MediaRecorder.isTypeSupported(FORMATS[i])) return FORMATS[i]; } catch (e) {}
    }
    return '';   // le navigateur choisira
  }

  function extension(mime) {
    if (!mime) return 'audio';
    if (mime.indexOf('mp4') !== -1) return 'm4a';
    if (mime.indexOf('ogg') !== -1) return 'ogg';
    if (mime.indexOf('webm') !== -1) return 'webm';
    if (mime.indexOf('mpeg') !== -1) return 'mp3';
    if (mime.indexOf('wav') !== -1) return 'wav';
    return 'audio';
  }

  function possible() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && typeof MediaRecorder !== 'undefined');
  }

  /** Un enregistrement en cours : micro + mesure de niveau + clic optionnel. */
  function Enregistreur() {
    this.flux = null; this.mr = null; this.morceaux = [];
    this.ctx = null; this.analyse = null; this.tampon = null;
    this.debut = 0; this.mime = '';
  }

  Enregistreur.prototype.ouvrir = function () {
    var self = this;
    return navigator.mediaDevices.getUserMedia({
      // Pas de traitement de la voix : on enregistre de la musique, pas un appel.
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
    }).then(function (flux) {
      self.flux = flux;
      try {
        self.ctx = new (window.AudioContext || window.webkitAudioContext)();
        var src = self.ctx.createMediaStreamSource(flux);
        self.analyse = self.ctx.createAnalyser();
        self.analyse.fftSize = 1024;
        self.tampon = new Uint8Array(self.analyse.fftSize);
        src.connect(self.analyse);
      } catch (e) { self.analyse = null; }
      return self;
    });
  };

  // Niveau sonore 0 → 1, pour le vumètre.
  Enregistreur.prototype.niveau = function () {
    if (!this.analyse) return 0;
    this.analyse.getByteTimeDomainData(this.tampon);
    var somme = 0;
    for (var i = 0; i < this.tampon.length; i++) {
      var v = (this.tampon[i] - 128) / 128;
      somme += v * v;
    }
    return Math.min(1, Math.sqrt(somme / this.tampon.length) * 4);
  };

  Enregistreur.prototype.clic = function (fort) {
    if (!this.ctx) return;
    var t = this.ctx.currentTime;
    var o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.frequency.value = fort ? 1600 : 1000;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(fort ? 0.45 : 0.25, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    o.connect(g); g.connect(this.ctx.destination);
    o.start(t); o.stop(t + 0.08);
  };

  Enregistreur.prototype.lancer = function () {
    this.mime = formatDispo();
    this.morceaux = [];
    var opts = this.mime ? { mimeType: this.mime } : undefined;
    this.mr = new MediaRecorder(this.flux, opts);
    var self = this;
    this.mr.ondataavailable = function (e) { if (e.data && e.data.size) self.morceaux.push(e.data); };
    this.mr.start(1000);
    this.debut = Date.now();
  };

  Enregistreur.prototype.duree = function () {
    return this.debut ? (Date.now() - this.debut) / 1000 : 0;
  };

  Enregistreur.prototype.arreter = function () {
    var self = this;
    return new Promise(function (res) {
      if (!self.mr || self.mr.state === 'inactive') { res(null); return; }
      self.mr.onstop = function () {
        var type = self.mr.mimeType || self.mime || 'audio/webm';
        res(new Blob(self.morceaux, { type: type }));
      };
      self.mr.stop();
    });
  };

  Enregistreur.prototype.fermer = function () {
    if (this.flux) this.flux.getTracks().forEach(function (p) { p.stop(); });
    if (this.ctx && this.ctx.state !== 'closed') { try { this.ctx.close(); } catch (e) {} }
    this.flux = null; this.ctx = null; this.analyse = null;
  };

  /* ---------------------------------------------------------- utilitaires */

  function mmss(s) {
    s = Math.max(0, Math.round(s || 0));
    var m = Math.floor(s / 60);
    return m + ':' + String(s % 60).padStart(2, '0');
  }

  function poids(o) {
    if (!o) return '0 Ko';
    if (o < 1024 * 1024) return Math.round(o / 1024) + ' Ko';
    return (o / 1024 / 1024).toFixed(1).replace('.', ',') + ' Mo';
  }

  // Durée réelle d'un blob audio : le navigateur doit le décoder pour la connaître.
  function dureeDe(blob) {
    return new Promise(function (res) {
      var url = URL.createObjectURL(blob);
      var a = new Audio();
      var fini = function (d) { URL.revokeObjectURL(url); res(d); };
      var garde = setTimeout(function () { fini(0); }, 4000);
      a.onloadedmetadata = function () {
        // Certains navigateurs renvoient Infinity sur un flux enregistré :
        // on force la lecture en fin de piste pour obtenir la vraie durée.
        if (a.duration === Infinity || isNaN(a.duration)) {
          a.currentTime = 1e101;
          a.ontimeupdate = function () {
            a.ontimeupdate = null;
            clearTimeout(garde);
            fini(a.duration === Infinity ? 0 : a.duration);
          };
        } else {
          clearTimeout(garde);
          fini(a.duration);
        }
      };
      a.onerror = function () { clearTimeout(garde); fini(0); };
      a.src = url;
    });
  }

  var ETIQUETTES = ['idée', 'maquette', 'répète', 'live', 'référence'];

  window.Pistes = {
    lister: lister, toutes: toutes, obtenir: obtenir, ajouter: ajouter,
    supprimer: supprimer, maj: maj, comptes: comptes, poidsTotal: poidsTotal,
    Enregistreur: Enregistreur, possible: possible, formatDispo: formatDispo,
    extension: extension, mmss: mmss, poids: poids, dureeDe: dureeDe,
    ETIQUETTES: ETIQUETTES
  };
})();
