/* boot.js — démarrage : réglages, répertoire du groupe, service worker, routeur. */
(function () {
  'use strict';
  var K = window.Carnet, V = window.VuesInternes;

  // Où tourne-t-on ? (pour les liens « proposer au répertoire »)
  (function detecterDepot() {
    var h = location.hostname;
    if (/\.github\.io$/.test(h)) {
      var owner = h.replace(/\.github\.io$/, '');
      var seg = location.pathname.split('/').filter(Boolean);
      K.depot = { owner: owner, repo: seg.length ? seg[0] : h };
    }
  })();

  V.appliquerReglages();

  window.addEventListener('hashchange', V.naviguer);
  if (window.matchMedia) {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    var relire = function () { if (K.state.reglages.theme === 'auto') V.appliquerReglages(); };
    mq.addEventListener ? mq.addEventListener('change', relire) : mq.addListener(relire);
  }

  V.naviguer();

  // Répertoire partagé : versionné dans le dépôt, lecture seule dans l’app.
  fetch('repertoire.json', { cache: 'no-cache' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) {
      if (!d || !Array.isArray(d.chansons)) return;
      var fav = K.state.reglages.favGroupe || {};
      K.groupe = d.chansons.map(function (c, i) {
        var id = 'g:' + (c.id || slug(c.titre) || i);
        return Object.assign(K.nouvelleChanson(), c, {
          id: id, transpose: 0, favori: !!fav[id], tags: c.tags || []
        });
      });
      // La vue a pu s'afficher avant l'arrivée du répertoire : on la refait,
      // sauf si on est en train d'écrire (on ne jette pas le texte en cours).
      if (V.route().nom !== 'editeur') V.naviguer();
    })
    .catch(function () { /* hors-ligne au premier lancement : tant pis */ });

  function slug(t) {
    return String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    });
  }
})();
