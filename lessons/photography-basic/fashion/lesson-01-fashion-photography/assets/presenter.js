(() => {
  const page = document.querySelector('.page');
  const sections = [...page.querySelectorAll(':scope > section')];
  const slides = [];
  const readable = node => { const copy = node.cloneNode(true); copy.querySelectorAll("br").forEach(br => br.replaceWith(" ")); return copy.textContent.replace(/\s+/g, " ").trim(); };
  const clone = node => {
    const copy = node.cloneNode(true);
    copy.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
    copy.removeAttribute('id');
    copy.querySelectorAll('img').forEach(img => { img.loading = 'eager'; });
    return copy;
  };
  const add = (chapter, title, nodes, note, lead = '') => slides.push({chapter, title, nodes, note, lead});
  const hero = page.querySelector('.hero');
  add(0, 'Tư duy nhiếp ảnh thời trang', [hero.querySelector('.hero-intro'), hero.querySelector('.hero-pin')], hero.querySelector('.teacher-note-popover'), 'Buổi 01 · Nhìn → gọi tên → dự đoán → chụp thử → so sánh → giải thích.');
  sections.forEach((section, index) => {
    const chapter = index + 1;
    const title = readable(section.querySelector('h2'));
    const note = section.querySelector('.teacher-note-popover');
    const introduction = section.querySelector('[class$="-lead"]') || section.querySelector('.objective-heading p');
    if (introduction) add(chapter, title, [introduction], note);
    const lead = ''; 
    const pair = (items, companion) => {
      for (let i = 0; i < items.length; i += 2) add(chapter, title, companion ? [companion, ...items.slice(i, i + 2)] : items.slice(i, i + 2), note);
    };
    if (section.classList.contains('section-objectives')) {
      pair([...section.querySelectorAll('.objective-item')]);
      add(chapter, title, [section.querySelector('.objective-outcomes')], note);
      return;
    }
    [...section.children].forEach(block => {
      if (block.querySelector('h2') || block.classList.contains('section-note-anchor')) return;
      if (block.classList.contains('garment-map')) {
        pair([...block.querySelectorAll('.garment-point')], block.querySelector('.garment-visual'));
      } else if (block.classList.contains('analysis-layout')) {
        pair([...block.querySelectorAll('.analysis-layer')], block.querySelector('.analysis-image'));
      } else if (block.children.length > 1 && [...block.children].every(el => el.matches('article,figure'))) {
        pair([...block.children]);
      } else {
        add(chapter, title, [block], note, lead);
      }
    });
  });

  const toolbar = document.createElement('div');
  toolbar.className = 'lesson-controls';
  toolbar.innerHTML = '<button type="button" data-action="mode">Trình chiếu</button><button type="button" data-action="previous" aria-label="Màn hình trước">←</button><span class="lesson-position" aria-live="polite"></span><button type="button" data-action="next" aria-label="Màn hình sau">→</button><button type="button" data-action="contents">Mục lục</button><button type="button" data-action="notes">Gợi ý giảng viên</button><button type="button" data-action="fullscreen">Toàn màn hình</button>';
  document.body.append(toolbar);
  const stage = document.createElement('main');
  stage.className = 'present-stage'; stage.hidden = true;
  stage.innerHTML = '<header class="present-header"><span class="present-chapter"></span><h1></h1></header><div class="present-content" tabindex="0" aria-label="Nội dung màn hình bài giảng"></div>';
  document.body.append(stage);
  const dialog = document.createElement('dialog');
  dialog.className = 'present-dialog';
  dialog.innerHTML = '<button type="button" class="present-close" aria-label="Đóng">×</button><div class="present-dialog-body"></div>';
  document.body.append(dialog);
  dialog.querySelector('.present-close').onclick = () => dialog.close();
  dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
  const dialogBody = dialog.querySelector('.present-dialog-body');
  let current = 0;
  let presenting = false;
  const content = stage.querySelector('.present-content');
  const button = action => toolbar.querySelector(`[data-action="${action}"]`);

  function render() {
    const slide = slides[current];
    stage.querySelector('.present-chapter').textContent = slide.chapter ? `PHẦN ${String(slide.chapter).padStart(2, '0')} / 14 · BUỔI 01` : 'HANG ĐÔI ACADEMY · BUỔI 01';
    stage.querySelector('h1').textContent = slide.title;
    content.replaceChildren();
    content.classList.toggle('present-three', slide.nodes.length === 3);
    slide.nodes.forEach(node => {
      const card = document.createElement('div'); card.className = 'present-card'; card.append(clone(node)); content.append(card);
    });
    content.scrollTop = 0;
    content.querySelectorAll('img').forEach(img => {
      const zoom = document.createElement('button'); zoom.type = 'button'; zoom.className = 'present-zoom'; zoom.setAttribute('aria-label', `Phóng to ảnh: ${img.alt}`);
      img.replaceWith(zoom); zoom.append(img);
      zoom.onclick = () => { dialogBody.replaceChildren(clone(img)); dialogBody.className = 'present-dialog-body present-image'; dialog.showModal(); };
    });
    content.querySelectorAll('[data-pin-do]').forEach(link => {
      link.removeAttribute('data-pin-do'); link.target = '_blank'; link.rel = 'noopener noreferrer';
      link.className = 'present-reference'; link.textContent = 'Mở ảnh tham khảo Pinterest ↗';
      const label = document.createElement('p'); label.className = 'present-online'; label.textContent = 'Ảnh tham khảo trực tuyến · cần Internet'; link.after(label);
    });
    toolbar.querySelector('.lesson-position').textContent = `Màn hình ${current + 1} / ${slides.length}`;
    button('previous').disabled = !presenting || current === 0;
    button('next').disabled = !presenting || current === slides.length - 1;
    button('notes').disabled = !presenting || !slide.note;
    button('contents').disabled = !presenting;
  }
  function setMode(value) {
    presenting = value;
    page.hidden = value; stage.hidden = !value;
    document.body.classList.toggle('is-presenting', value);
    button('mode').textContent = value ? 'Chế độ đọc' : 'Trình chiếu';
    button('mode').setAttribute('aria-pressed', String(value));
    render();
    if (value) content.focus({preventScroll:true});
    else { const target = current ? sections[slides[current].chapter - 1] : hero; target?.scrollIntoView({block:'start'}); }
  }
  function move(delta) { current = Math.max(0, Math.min(slides.length - 1, current + delta)); render(); }
  button('mode').onclick = () => setMode(!presenting);
  button('previous').onclick = () => move(-1);
  button('next').onclick = () => move(1);
  button('contents').onclick = () => {
    dialogBody.className = 'present-dialog-body'; dialogBody.replaceChildren();
    const title = document.createElement('h2'); title.textContent = 'Mục lục · Buổi 01'; dialogBody.append(title);
    [hero, ...sections].forEach((section, chapter) => {
      const choice = document.createElement('button'); choice.type = 'button'; choice.className = 'present-toc-choice';
      choice.textContent = `${String(chapter).padStart(2, '0')} · ${readable(section.querySelector('h1,h2'))}`;
      choice.onclick = () => { current = slides.findIndex(slide => slide.chapter === chapter); dialog.close(); render(); content.focus(); };
      dialogBody.append(choice);
    });
    dialog.showModal();
  };
  button('notes').onclick = () => { dialogBody.className = 'present-dialog-body'; dialogBody.replaceChildren(clone(slides[current].note)); dialog.showModal(); };
  button('fullscreen').onclick = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
      else button('fullscreen').textContent = 'Dùng F11 để toàn màn hình';
    } catch { button('fullscreen').textContent = 'Dùng F11 để toàn màn hình'; }
  };
  document.addEventListener('fullscreenchange', () => { button('fullscreen').textContent = document.fullscreenElement ? 'Thoát toàn màn hình' : 'Toàn màn hình'; });
  document.addEventListener('keydown', event => {
    if (!presenting || dialog.open || event.altKey || event.ctrlKey || event.metaKey || event.target.closest('input,textarea,select,a,[contenteditable="true"]')) return;
    if (['ArrowRight','PageDown'].includes(event.key)) { event.preventDefault(); move(1); }
    if (['ArrowLeft','PageUp'].includes(event.key)) { event.preventDefault(); move(-1); }
    if (event.key === 'Home') { event.preventDefault(); current = 0; render(); }
    if (event.key === 'End') { event.preventDefault(); current = slides.length - 1; render(); }
  });
  setMode(innerWidth >= 1024 && new URLSearchParams(location.search).get('view') !== 'read');
})();
