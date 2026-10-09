(() => {
  const targets = [
    ...document.querySelectorAll('a.brand-official, a.p2-brand'),
    ...document.querySelectorAll('.p2-footer-grid > div:first-child > strong:first-child')
  ];
  if (!targets.length) return;

  fetch('/logo-academy.svg', { cache: 'force-cache' })
    .then(response => {
      if (!response.ok) throw new Error('Logo SVG could not be loaded');
      return response.text();
    })
    .then(svg => {
      targets.forEach(target => {
        target.innerHTML = svg;
        target.classList.add('academy-logo-host');
        if (target.matches('a')) target.setAttribute('aria-label', 'Hang Đôi Academy');
      });
    })
    .catch(() => {
      targets.forEach(target => target.classList.add('academy-logo-fallback'));
    });
})();
