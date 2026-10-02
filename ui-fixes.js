(() => {
  const replaceWeakHospitalityCard = () => {
    const cards = [...document.querySelectorAll('.work-card')];
    const card = cards.find(item => {
      const title = item.querySelector('.work-copy strong')?.textContent || '';
      return title.includes('Four Points — Architecture') || title.includes('Four Points — Lifestyle');
    });
    if (!card) return;

    const image = card.querySelector('img');
    const title = card.querySelector('.work-copy strong');
    const description = card.querySelector('.work-copy small');
    const type = card.querySelector('.work-type');

    if (image) {
      image.src = 'https://drive.google.com/thumbnail?id=1z1MovFBEk7fDluCC1n0aCRg37kXKGAeZ&sz=w1600';
      image.alt = 'Không gian hospitality campaign tại Hoiana Resort do Hang Đôi Production thực hiện';
      image.width = 1600;
      image.height = 1067;
    }
    if (title) title.textContent = 'Hoiana Resort — Hospitality Campaign';
    if (description) description.textContent = 'Không gian, trải nghiệm và visual storytelling';
    if (type) type.textContent = 'HOSPITALITY';
    card.dataset.workCategory = 'hospitality';
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', replaceWeakHospitalityCard, { once: true });
  } else {
    replaceWeakHospitalityCard();
  }
})();
