from pathlib import Path
import re
import sys

SITE = Path(sys.argv[1] if len(sys.argv) > 1 else "_site")
LOGO_PATH = SITE / "logo-academy.svg"
CSS_NAME = "shared-header.css"

if not SITE.exists():
    raise SystemExit(f"Site folder not found: {SITE}")
if not LOGO_PATH.exists():
    raise SystemExit(f"Logo not found: {LOGO_PATH}")

logo = LOGO_PATH.read_text(encoding="utf-8")
logo = re.sub(r"<\?xml[^>]*>\s*", "", logo)
logo = logo.replace("<svg ", '<svg class="aca-global-header__logo" aria-hidden="true" focusable="false" ', 1)

HEADER = f"""
<header class="aca-global-header" id="siteHeader" data-shared-header>
  <div class="aca-global-header__inner">
    <a class="aca-global-header__brand" href="/" aria-label="Hang Đôi Academy — Trang chủ">
      {logo}
    </a>

    <nav class="aca-global-header__nav" aria-label="Điều hướng chính">
      <a href="/#lo-trinh" data-nav="lo-trinh">Lộ trình</a>
      <a href="/khoa-hoc/" data-nav="khoa-hoc">Khóa học</a>
      <a href="/#du-an-thuc-te" data-nav="du-an">Dự án thật</a>
      <a href="/hoc-vien/" data-nav="hoc-vien">Học viên</a>
      <a href="/giang-vien/" data-nav="giang-vien">Giảng viên</a>
      <a href="/blog/" data-nav="blog">Kiến thức</a>
    </nav>

    <a class="aca-global-header__cta" href="/#tu-van">Nhận tư vấn</a>

    <button class="aca-global-header__menu" id="menuBtn" type="button" aria-expanded="false" aria-controls="mobileMenu" aria-label="Mở menu">
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <path d="M4 7h16M4 12h16M4 17h16"/>
      </svg>
    </button>
  </div>

  <nav class="aca-global-header__mobile" id="mobileMenu" aria-label="Điều hướng di động">
    <a href="/#lo-trinh" data-nav="lo-trinh">Lộ trình</a>
    <a href="/khoa-hoc/" data-nav="khoa-hoc">Khóa học</a>
    <a href="/#du-an-thuc-te" data-nav="du-an">Dự án thật</a>
    <a href="/hoc-vien/" data-nav="hoc-vien">Học viên</a>
    <a href="/giang-vien/" data-nav="giang-vien">Giảng viên</a>
    <a href="/blog/" data-nav="blog">Kiến thức</a>
    <a class="aca-global-header__cta" href="/#tu-van">Nhận tư vấn</a>
  </nav>
</header>
""".strip()

RUNTIME = """
<script id="aca-shared-header-runtime">
(() => {
  const header = document.querySelector('[data-shared-header]');
  if (!header) return;

  const button = header.querySelector('.aca-global-header__menu');
  const mobile = header.querySelector('.aca-global-header__mobile');

  button?.addEventListener('click', () => {
    const open = mobile.classList.toggle('is-open');
    button.setAttribute('aria-expanded', String(open));
    button.setAttribute('aria-label', open ? 'Đóng menu' : 'Mở menu');
  });

  mobile?.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      mobile.classList.remove('is-open');
      button?.setAttribute('aria-expanded', 'false');
      button?.setAttribute('aria-label', 'Mở menu');
    });
  });

  const path = location.pathname.replace(/\\/+$/, '/') || '/';
  const rules = [
    ['/khoa-hoc/', 'khoa-hoc'],
    ['/hoc-vien/', 'hoc-vien'],
    ['/giang-vien/', 'giang-vien'],
    ['/blog/', 'blog']
  ];
  const match = rules.find(([prefix]) => path.startsWith(prefix));
  if (match) {
    header.querySelectorAll(`[data-nav="${match[1]}"]`).forEach(link => {
      link.setAttribute('aria-current', 'page');
    });
  }
})();
</script>
""".strip()


def replace_header(html: str) -> str:
    # Replace the homepage header while keeping legacy IDs used by its inline JS.
    html = re.sub(
        r'<header\b[^>]*class="[^"]*\bsite-header\b[^"]*"[^>]*>.*?</header>',
        HEADER,
        html,
        count=1,
        flags=re.S | re.I,
    )
    # Replace the Phase 2 and blog navigation.
    html = re.sub(
        r'<nav\b[^>]*class="[^"]*\bp2-nav\b[^"]*"[^>]*>.*?</nav>',
        HEADER,
        html,
        count=1,
        flags=re.S | re.I,
    )
    # Fallback for generated pages without a known header.
    if 'data-shared-header' not in html:
        html = re.sub(r'(<body\b[^>]*>)', r'\1' + HEADER, html, count=1, flags=re.I)
    # Remove the legacy homepage mobile menu. The new mobile nav keeps the same IDs
    # so the existing homepage script remains null-safe until it is retired.
    html = re.sub(
        r'<div\b[^>]*class="[^"]*\bmobile-menu\b[^"]*"[^>]*>.*?</div>',
        '',
        html,
        count=1,
        flags=re.S | re.I,
    )
    # Ensure the shared stylesheet is present.
    if f'href="/{CSS_NAME}"' not in html:
        html = html.replace('</head>', f'<link rel="stylesheet" href="/{CSS_NAME}"></head>')
    # Ensure a single runtime script.
    html = re.sub(r'<script id="aca-shared-header-runtime">.*?</script>', '', html, flags=re.S)
    html = html.replace('</body>', RUNTIME + '</body>')
    return html


count = 0
for page in SITE.rglob("index.html"):
    html = page.read_text(encoding="utf-8")
    updated = replace_header(html)
    page.write_text(updated, encoding="utf-8")
    count += 1

print(f"Unified header applied to {count} pages.")
