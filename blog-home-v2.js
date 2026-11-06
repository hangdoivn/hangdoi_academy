(()=>{
  const root=document.documentElement;
  const reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const normalize=value=>(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();

  const motionStyle=document.createElement('style');
  motionStyle.id='abh-motion-styles';
  motionStyle.textContent=`
    html.abh-motion-ready .abh-motion-item{opacity:0;transform:translate3d(0,28px,0);filter:blur(3px);transition:opacity .72s cubic-bezier(.22,1,.36,1),transform .72s cubic-bezier(.22,1,.36,1),filter .72s ease;transition-delay:var(--abh-delay,0ms);will-change:opacity,transform}
    html.abh-motion-ready .abh-motion-item.is-visible{opacity:1;transform:translate3d(0,0,0);filter:blur(0)}
    html.abh-motion-ready .abh-hero-panel.abh-motion-item{transform:translate3d(22px,22px,0) scale(.985)}
    html.abh-motion-ready .abh-hero-panel.abh-motion-item.is-visible{transform:translate3d(0,0,0) scale(1)}
    .abh-scroll-progress{position:fixed;z-index:80;left:0;right:0;top:0;height:3px;pointer-events:none;transform:scaleX(0);transform-origin:0 50%;background:linear-gradient(90deg,var(--abh-yellow),#2f7c5d);box-shadow:0 1px 8px rgba(16,63,45,.18);will-change:transform}
    .abh-card-arrow,.abh-hero-panel>a span,.abh-cta-button span{transition:transform .35s cubic-bezier(.22,1,.36,1)}
    .abh-card:hover .abh-card-arrow{transform:translate(2px,-2px) rotate(45deg)}
    .abh-hero-panel>a:hover span{transform:translateY(4px)}
    .abh-topic-nav>a{transition:transform .24s ease,background-color .24s ease,color .24s ease,border-color .24s ease,box-shadow .24s ease}
    .abh-topic-nav>a:hover{box-shadow:0 10px 24px rgba(16,63,45,.12)}
    .abh-search>div{transition:border-color .28s ease,box-shadow .28s ease,transform .28s ease}
    .abh-search:focus-within>div{transform:translateY(-2px);border-color:rgba(16,63,45,.42);box-shadow:0 22px 52px rgba(16,63,45,.13)}
    .abh-search svg{transition:transform .28s ease,color .28s ease}
    .abh-search:focus-within svg{transform:scale(1.08);color:#2f7c5d}
    .abh-kicker:before{animation:abh-kicker-pulse 2.8s ease-in-out infinite;transform-origin:left center}
    .abh-card{transform-origin:50% 70%}
    .abh-topic.is-active .abh-topic-index{transition:transform .35s cubic-bezier(.22,1,.36,1),color .35s ease}
    .abh-topic.is-active:hover .abh-topic-index{transform:translateY(-4px) rotate(-4deg);color:rgba(16,63,45,.45)}
    .abh-cta-button{position:relative;overflow:hidden;isolation:isolate;transition:transform .3s cubic-bezier(.22,1,.36,1),box-shadow .3s ease}
    .abh-cta-button:before{content:"";position:absolute;z-index:-1;inset:-2px;transform:translateX(-120%) skewX(-18deg);background:linear-gradient(100deg,transparent 20%,rgba(255,255,255,.55) 48%,transparent 76%);transition:transform .72s cubic-bezier(.22,1,.36,1)}
    .abh-cta-button:hover:before{transform:translateX(120%) skewX(-18deg)}
    .abh-filter-pop{animation:abh-filter-pop .38s cubic-bezier(.22,1,.36,1) both}
    @keyframes abh-kicker-pulse{0%,100%{transform:scaleX(1);opacity:1}50%{transform:scaleX(.62);opacity:.62}}
    @keyframes abh-filter-pop{0%{opacity:.2;transform:scale(.975)}100%{opacity:1;transform:scale(1)}}
    @media(prefers-reduced-motion:reduce){html.abh-motion-ready .abh-motion-item,html.abh-motion-ready .abh-motion-item.is-visible{opacity:1!important;transform:none!important;filter:none!important;transition:none!important}.abh-scroll-progress{display:none}.abh-kicker:before{animation:none!important}.abh-filter-pop{animation:none!important}}
  `;
  document.head.appendChild(motionStyle);

  const progress=document.createElement('div');
  progress.className='abh-scroll-progress';
  progress.setAttribute('aria-hidden','true');
  document.body.appendChild(progress);
  let progressTick=false;
  const updateProgress=()=>{
    progressTick=false;
    const max=document.documentElement.scrollHeight-window.innerHeight;
    const ratio=max>0?Math.min(1,Math.max(0,window.scrollY/max)):0;
    progress.style.transform=`scaleX(${ratio})`;
  };
  window.addEventListener('scroll',()=>{
    if(!progressTick){progressTick=true;requestAnimationFrame(updateProgress)}
  },{passive:true});
  updateProgress();

  const heroItems=[
    '.abh-hero-copy > .abh-kicker',
    '.abh-hero-copy > h1',
    '.abh-hero-copy > p',
    '.abh-search',
    '.abh-hero-panel',
    '.abh-topic-nav'
  ].map(selector=>document.querySelector(selector)).filter(Boolean);
  heroItems.forEach((element,index)=>{
    element.classList.add('abh-motion-item');
    element.style.setProperty('--abh-delay',`${index*85}ms`);
  });

  const revealItems=[...document.querySelectorAll('.abh-section-heading,.abh-article-card,.abh-topic,.abh-cta')];
  revealItems.forEach((element,index)=>{
    element.classList.add('abh-motion-item');
    element.style.setProperty('--abh-delay',`${Math.min(index%4,3)*70}ms`);
  });

  root.classList.add('abh-motion-ready');
  const show=element=>element.classList.add('is-visible');
  if(reduceMotion){
    [...heroItems,...revealItems].forEach(show);
  }else{
    requestAnimationFrame(()=>requestAnimationFrame(()=>heroItems.forEach(show)));
    if('IntersectionObserver' in window){
      const observer=new IntersectionObserver(entries=>{
        entries.forEach(entry=>{
          if(entry.isIntersecting){show(entry.target);observer.unobserve(entry.target)}
        });
      },{threshold:.12,rootMargin:'0px 0px -7% 0px'});
      revealItems.forEach(element=>observer.observe(element));
    }else{
      revealItems.forEach(show);
    }
  }

  const statNumbers=[...document.querySelectorAll('.abh-stat strong')];
  const animateNumber=element=>{
    if(element.dataset.counted==='true')return;
    element.dataset.counted='true';
    const raw=element.textContent.trim();
    const target=Number.parseInt(raw,10);
    if(!Number.isFinite(target)||reduceMotion)return;
    const width=raw.length;
    const start=performance.now();
    const duration=900;
    const frame=now=>{
      const t=Math.min(1,(now-start)/duration);
      const eased=1-Math.pow(1-t,3);
      element.textContent=String(Math.round(target*eased)).padStart(width,'0');
      if(t<1)requestAnimationFrame(frame);
    };
    element.textContent=String(0).padStart(width,'0');
    requestAnimationFrame(frame);
  };
  const panel=document.querySelector('.abh-hero-panel');
  if(panel&&statNumbers.length){
    if(reduceMotion){statNumbers.forEach(animateNumber)}
    else if('IntersectionObserver' in window){
      const numberObserver=new IntersectionObserver(entries=>{
        if(entries.some(entry=>entry.isIntersecting)){
          statNumbers.forEach(animateNumber);
          numberObserver.disconnect();
        }
      },{threshold:.45});
      numberObserver.observe(panel);
    }else statNumbers.forEach(animateNumber);
  }

  const form=document.querySelector('.abh-search');
  const input=document.getElementById('abh-search-input');
  const clear=document.getElementById('abh-search-clear');
  const status=document.getElementById('abh-search-status');
  const empty=document.getElementById('abh-no-results');
  const cards=[...document.querySelectorAll('.abh-article-card')];
  if(form&&input){
    const apply=()=>{
      const q=normalize(input.value);
      let visible=0;
      cards.forEach((card,index)=>{
        const shouldShow=!q||normalize(card.dataset.search).includes(q);
        card.hidden=!shouldShow;
        if(shouldShow){
          visible+=1;
          if(q&&!reduceMotion){
            card.classList.remove('abh-filter-pop');
            void card.offsetWidth;
            card.style.animationDelay=`${Math.min(index,5)*45}ms`;
            card.classList.add('abh-filter-pop');
          }
        }
      });
      if(clear)clear.hidden=!q;
      if(empty)empty.hidden=visible!==0;
      if(status)status.textContent=q?`${visible} bài phù hợp với “${input.value.trim()}”.`:`Tìm trong ${cards.length} bài đã xuất bản.`;
    };
    form.addEventListener('submit',event=>{event.preventDefault();apply()});
    input.addEventListener('input',apply);
    if(clear)clear.addEventListener('click',()=>{input.value='';apply();input.focus()});
  }

  document.querySelectorAll('a[href^="#"]').forEach(anchor=>{
    anchor.addEventListener('click',event=>{
      const id=anchor.getAttribute('href');
      if(!id||id==='#')return;
      const target=document.querySelector(id);
      if(!target)return;
      event.preventDefault();
      target.scrollIntoView({behavior:reduceMotion?'auto':'smooth',block:'start'});
    });
  });
})();
