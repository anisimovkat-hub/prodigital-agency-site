(() => {
  const base = "https://prodigital-agency.github.io";
  const oldOrigin = 'https://anisimovkat-hub.github.io';
  const oldPrefix = '/prodigital-agency-site/';
  if (location.origin !== oldOrigin || !location.pathname.startsWith(oldPrefix)) return;
  if (base === oldOrigin + oldPrefix.slice(0, -1)) return;
  const path = location.pathname.slice(oldPrefix.length).replace(/(^|\/)index\.html$/, '$1');
  location.replace(base + '/' + path + location.search + location.hash);
})();
