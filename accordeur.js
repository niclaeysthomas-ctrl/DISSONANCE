/* accordeur.js — détection de hauteur par autocorrélation, et l'écran qui va avec.
   Le micro ne sort pas d'ici : rien n'est enregistré, rien n'est envoyé. */
(function () {
  'use strict';
  var K = window.Carnet;
  var Vues = window.Vues = window.Vues || {};

  var LA = 440;
  var NOMS = ['Do', 'Do♯', 'Ré', 'Ré♯', 'Mi', 'Fa', 'Fa♯', 'Sol', 'Sol♯', 'La', 'La♯', 'Si'];
  // Accordage standard, de la 6e corde à la 1re.
  var CORDES = [
    { nom: 'Mi', grave: true, midi: 40 }, { nom: 'La', midi: 45 }, { nom: 'Ré', midi: 50 },
    { nom: 'Sol', midi: 55 }, { nom: 'Si', midi: 59 }, { nom: 'Mi', aigu: true, midi: 64 }
  ];

  function freqDe(midi) { return LA * Math.pow(2, (midi - 69) / 12); }

  /** Autocorrélation bornée aux fréquences d'une guitare : 70 à 1100 Hz. */
  function detecter(buf, sr) {
    var n = buf.length, i, somme = 0;
    for (i = 0; i < n; i++) somme += buf[i] * buf[i];
    var rms = Math.sqrt(somme / n);
    if (rms < 0.008) return { freq: -1, force: rms };   // silence : on ne devine pas

    var lagMin = Math.floor(sr / 1100), lagMax = Math.min(n - 2, Math.ceil(sr / 70));
    var meilleur = -1, meilleurVal = 0, c = new Float32Array(lagMax + 2);

    for (var lag = lagMin; lag <= lagMax; lag++) {
      var s = 0, norme1 = 0, norme2 = 0;
      for (i = 0; i + lag < n; i++) {
        s += buf[i] * buf[i + lag];
        norme1 += buf[i] * buf[i];
        norme2 += buf[i + lag] * buf[i + lag];
      }
      // Corrélation normalisée : une note forte ne gagne pas contre une note juste.
      c[lag] = (norme1 && norme2) ? s / Math.sqrt(norme1 * norme2) : 0;
    }

    // La corrélation culmine autant à une période qu'à deux ou trois : prendre
    // le plus haut sommet, c'est s'exposer à lire l'octave en dessous. On
    // relève donc tous les sommets, puis on garde LE PREMIER qui approche le
    // meilleur — la période la plus courte, donc la vraie.
    var sommets = [];
    for (var l = lagMin + 1; l < lagMax; l++) {
      if (c[l] > c[l - 1] && c[l] >= c[l + 1]) sommets.push(l);
    }
    if (!sommets.length) return { freq: -1, force: rms };
    sommets.forEach(function (l) { if (c[l] > meilleurVal) meilleurVal = c[l]; });
    if (meilleurVal < 0.5) return { freq: -1, force: rms };
    var seuil = meilleurVal * 0.88;
    for (var k = 0; k < sommets.length; k++) {
      if (c[sommets[k]] >= seuil) { meilleur = sommets[k]; break; }
    }
    if (meilleur < 0) return { freq: -1, force: rms };

    // Interpolation parabolique : la vraie période tombe entre deux échantillons.
    var x1 = c[meilleur - 1] || 0, x2 = c[meilleur], x3 = c[meilleur + 1] || 0;
    var a = (x1 + x3 - 2 * x2) / 2, b = (x3 - x1) / 2;
    var periode = a ? meilleur - b / (2 * a) : meilleur;
    return { freq: sr / periode, force: rms, nettete: meilleurVal };
  }

  /** Fréquence → note, octave, écart en cents, corde visée. */
  function analyser(freq) {
    var midi = 69 + 12 * Math.log2(freq / LA);
    var rond = Math.round(midi);
    var cents = Math.round((midi - rond) * 100);
    var corde = null, ecartMin = 99;
    CORDES.forEach(function (c, i) {
      var d = Math.abs(rond - c.midi);
      if (d < ecartMin) { ecartMin = d; corde = i; }
    });
    return {
      nom: NOMS[((rond % 12) + 12) % 12],
      octave: Math.floor(rond / 12) - 1,
      cents: cents,
      corde: ecartMin <= 2 ? corde : null
    };
  }

  /* ------------------------------------------------------------- l'écran */

  var moteur = { ctx: null, flux: null, analyse: null, tampon: null, raf: 0, source: null };

  function arreter() {
    cancelAnimationFrame(moteur.raf);
    if (moteur.flux) moteur.flux.getTracks().forEach(function (p) { p.stop(); });
    if (moteur.ctx && moteur.ctx.state !== 'closed') { try { moteur.ctx.close(); } catch (e) {} }
    moteur.ctx = null; moteur.flux = null; moteur.analyse = null; moteur.source = null;
  }

  // sourceFactory sert aux essais : on peut brancher autre chose que le micro.
  function demarrer(sourceFactory) {
    var p = sourceFactory
      ? Promise.resolve(null)
      : navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
        });
    return p.then(function (flux) {
      moteur.flux = flux;
      moteur.ctx = new (window.AudioContext || window.webkitAudioContext)();
      moteur.analyse = moteur.ctx.createAnalyser();
      moteur.analyse.fftSize = 2048;
      moteur.tampon = new Float32Array(moteur.analyse.fftSize);
      moteur.source = sourceFactory ? sourceFactory(moteur.ctx) : moteur.ctx.createMediaStreamSource(flux);
      moteur.source.connect(moteur.analyse);
      return moteur;
    });
  }

  function mesurer() {
    if (!moteur.analyse) return null;
    moteur.analyse.getFloatTimeDomainData(moteur.tampon);
    var d = detecter(moteur.tampon, moteur.ctx.sampleRate);
    if (d.freq < 0) return null;
    var a = analyser(d.freq);
    a.freq = d.freq;
    return a;
  }

  Vues.accordeur = function () {
    var app = document.getElementById('app');
    app.innerHTML = '<h1 class="h1">Accordeur</h1>' +
      '<div class="acc">' +
      '<div class="acc-note" id="acc-note">—</div>' +
      '<div class="acc-sous" id="acc-sous">Joue une corde, à vide.</div>' +
      '<div class="jauge"><span class="j-zone"></span><i class="j-aig" id="j-aig"></i>' +
      '<span class="j-g">♭</span><span class="j-d">♯</span></div>' +
      '<div class="cordes" id="cordes">' + CORDES.map(function (c, i) {
        return '<span class="corde" data-c="' + i + '">' + c.nom +
          '<small>' + (c.grave ? 'grave' : c.aigu ? 'aiguë' : '&nbsp;') + '</small></span>';
      }).join('') + '</div>' +
      '<p class="aide centre" id="acc-etat">Le micro reste sur l’appareil : rien n’est enregistré.</p>' +
      '<p class="centre"><button class="btn primaire" id="acc-go">Activer le micro</button></p>' +
      '</div>';

    var bouton = document.getElementById('acc-go');
    bouton.onclick = function () {
      bouton.disabled = true;
      bouton.textContent = 'Écoute…';
      demarrer().then(function () {
        bouton.remove();
        boucle();
      }).catch(function () {
        document.getElementById('acc-etat').innerHTML =
          '<b>Micro refusé.</b> Autorise-le dans les réglages du site, puis recharge.';
        bouton.disabled = false;
        bouton.textContent = 'Réessayer';
      });
    };

    var dernier = 0;
    function boucle() {
      moteur.raf = requestAnimationFrame(boucle);
      var t = performance.now();
      if (t - dernier < 60) return;        // ~16 mesures par seconde, ça suffit
      dernier = t;
      peindre(mesurer());
    }
  };

  function peindre(a) {
    var note = document.getElementById('acc-note');
    if (!note) { arreter(); return; }
    var sous = document.getElementById('acc-sous');
    var aig = document.getElementById('j-aig');

    if (!a) {
      note.textContent = '—';
      note.className = 'acc-note';
      sous.textContent = 'Joue une corde, à vide.';
      aig.style.left = '50%';
      aig.className = 'j-aig';
      document.querySelectorAll('.corde').forEach(function (c) { c.className = 'corde'; });
      return;
    }

    var juste = Math.abs(a.cents) <= 5;
    note.textContent = a.nom;
    note.className = 'acc-note' + (juste ? ' juste' : '');
    sous.textContent = Math.round(a.freq) + ' Hz · ' +
      (juste ? 'c’est juste' : (a.cents < 0 ? 'trop bas de ' : 'trop haut de ') + Math.abs(a.cents) + ' cents');
    aig.style.left = (50 + Math.max(-50, Math.min(50, a.cents))) + '%';
    aig.className = 'j-aig' + (juste ? ' juste' : '');

    document.querySelectorAll('.corde').forEach(function (c, i) {
      c.className = 'corde' + (a.corde === i ? (juste ? ' visee juste' : ' visee') : '');
    });
  }

  window.Accordeur = {
    detecter: detecter, analyser: analyser, demarrer: demarrer,
    arreter: arreter, mesurer: mesurer, freqDe: freqDe, CORDES: CORDES
  };
})();
