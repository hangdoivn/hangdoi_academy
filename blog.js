(() => {
  const body = document.body;
  const send = (name, params = {}) => {
    const payload = {
      article_id: body.dataset.articleId || undefined,
      article_slug: body.dataset.articleSlug || undefined,
      category: body.dataset.category || undefined,
      course_name: body.dataset.course || undefined,
      ...params,
    };
    if (typeof window.gtag === 'function') window.gtag('event', name, payload);
    window.dispatchEvent(new CustomEvent('hangdoi:analytics', { detail: { name, payload } }));
  };

  if (body.dataset.pageType === 'blog-article') {
    send('blog_article_view');
    const marks = [25, 50, 75, 90];
    const fired = new Set();
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (max <= 0) return;
      const pct = Math.round((window.scrollY / max) * 100);
      marks.forEach(mark => {
        if (pct >= mark && !fired.has(mark)) {
          fired.add(mark);
          send(mark === 90 ? 'article_complete' : `article_${mark}_percent`);
        }
      });
    };
    addEventListener('scroll', onScroll, { passive: true });
  }

  document.addEventListener('click', event => {
    const target = event.target.closest('[data-track]');
    if (!target) return;
    send(target.dataset.track, {
      destination_url: target.getAttribute('href') || undefined,
      cta_text: target.textContent.trim(),
    });
  });

  document.querySelectorAll('.p2-faq details').forEach(item => {
    item.addEventListener('toggle', () => {
      if (item.open) send('faq_expand', { question: item.querySelector('summary')?.textContent?.trim() });
    });
  });
})();
