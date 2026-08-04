#!/usr/bin/env python3
"""Redesign the generated Academy blog homepage without changing article content."""

from __future__ import annotations

import argparse
import html
import json
import re
from collections import Counter
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse

STYLE_ID = "academy-blog-home-v2"
SCRIPT_ID = "academy-blog-home-v2-script"

CATEGORY_DESCRIPTIONS = {
    "bat-dau-hoc": "Lộ trình, thời gian học và cách bắt đầu khi chưa có nền tảng.",
    "may-anh-thiet-bi": "Chọn máy, ống kính và thiết bị theo nhu cầu sử dụng thực tế.",
    "ky-thuat-chup": "Phơi sáng, lấy nét, bố cục và các bài tập làm chủ máy.",
    "anh-sang": "Quan sát, kiểm soát ánh sáng tự nhiên và thực hành trong studio.",
    "hau-ky": "Quản lý file, Lightroom, Photoshop và quy trình hoàn thiện ảnh.",
    "lam-nghe": "Portfolio, quy trình dự án và những năng lực cần có khi nhận việc.",
}


@dataclass(frozen=True)
class Article:
    title: str
    excerpt: str
    href: str
    category: str
    category_slug: str
    date_iso: str
    date_label: str
    read_time: str


def clean_text(value: str) -> str:
    value = re.sub(r"<[^>]+>", " ", value)
    return " ".join(html.unescape(value).split()).strip()


def extract(pattern: str, source: str, default: str = "", flags: int = re.I | re.S) -> str:
    match = re.search(pattern, source, flags)
    return clean_text(match.group(1)) if match else default


def article_from_card(block: str) -> Article | None:
    link = re.search(r'<h2\b[^>]*>\s*<a\b[^>]*href="([^"]+)"', block, re.I | re.S)
    if not link:
        link = re.search(r'href="(/blog/[^"#?]+/)"', block, re.I)
    if not link:
        return None
    href = html.unescape(link.group(1))
    path_parts = [part for part in urlparse(href).path.split("/") if part]
    if len(path_parts) < 3 or path_parts[0] != "blog":
        return None

    title = extract(r'<h2\b[^>]*>\s*<a\b[^>]*>(.*?)</a>\s*</h2>', block)
    if not title:
        return None
    excerpt = extract(r'<h2\b[^>]*>.*?</h2>\s*<p\b[^>]*>(.*?)</p>', block)
    category = extract(r'<div\b[^>]*class="[^"]*blog-card-meta[^"]*"[^>]*>\s*<span\b[^>]*>(.*?)</span>', block)
    time_match = re.search(r'<time\b[^>]*datetime="([^"]+)"[^>]*>(.*?)</time>', block, re.I | re.S)
    date_iso = time_match.group(1).strip() if time_match else ""
    date_label = clean_text(time_match.group(2)) if time_match else ""
    if date_iso:
        try:
            date_label = datetime.strptime(date_iso[:10], "%Y-%m-%d").strftime("%d/%m/%Y")
        except ValueError:
            pass
    read_time = extract(r'<div\b[^>]*class="[^"]*blog-card-footer[^"]*"[^>]*>\s*<span\b[^>]*>(.*?)</span>', block)
    return Article(
        title=title,
        excerpt=excerpt,
        href=href,
        category=category or "Kiến thức nhiếp ảnh",
        category_slug=path_parts[1],
        date_iso=date_iso,
        date_label=date_label or "Mới cập nhật",
        read_time=read_time or "Đọc bài",
    )


def extract_articles(index_html: str) -> list[Article]:
    pattern = re.compile(
        r'<article\b[^>]*class="[^"]*\bblog-card\b[^"]*"[^>]*>.*?</article>',
        re.I | re.S,
    )
    articles: list[Article] = []
    seen: set[str] = set()
    for block in pattern.findall(index_html):
        article = article_from_card(block)
        if article and article.href not in seen:
            seen.add(article.href)
            articles.append(article)
    if not articles:
        raise RuntimeError("No generated blog cards were found in blog/index.html")
    return articles


def load_categories(config_path: Path) -> list[dict[str, str]]:
    payload = json.loads(config_path.read_text(encoding="utf-8"))
    categories = payload.get("categories")
    if not isinstance(categories, list) or not categories:
        raise RuntimeError("Category config has no categories")
    output: list[dict[str, str]] = []
    for item in categories:
        slug = str(item.get("slug", "")).strip()
        label = str(item.get("label", "")).strip()
        if slug and label:
            output.append({"slug": slug, "label": label})
    if not output:
        raise RuntimeError("Category config has no valid category")
    return output


def article_search_text(article: Article) -> str:
    return " ".join([article.title, article.excerpt, article.category]).casefold()


def featured_card(article: Article) -> str:
    return f"""
    <article class="abh-card abh-card-featured abh-article-card" data-category="{html.escape(article.category_slug)}" data-search="{html.escape(article_search_text(article))}">
      <a class="abh-card-hit" href="{html.escape(article.href)}" aria-label="Đọc {html.escape(article.title)}"></a>
      <div class="abh-card-top"><span>{html.escape(article.category)}</span><time datetime="{html.escape(article.date_iso)}">{html.escape(article.date_label)}</time></div>
      <div class="abh-card-body"><span class="abh-card-number">01</span><h2>{html.escape(article.title)}</h2><p>{html.escape(article.excerpt)}</p></div>
      <div class="abh-card-bottom"><span>{html.escape(article.read_time)}</span><span class="abh-card-arrow" aria-hidden="true">↗</span></div>
    </article>"""


def compact_card(article: Article, number: int) -> str:
    return f"""
    <article class="abh-card abh-card-compact abh-article-card" data-category="{html.escape(article.category_slug)}" data-search="{html.escape(article_search_text(article))}">
      <a class="abh-card-hit" href="{html.escape(article.href)}" aria-label="Đọc {html.escape(article.title)}"></a>
      <div class="abh-card-index">{number:02d}</div>
      <div class="abh-card-compact-copy"><div class="abh-card-top"><span>{html.escape(article.category)}</span><time datetime="{html.escape(article.date_iso)}">{html.escape(article.date_label)}</time></div><h3>{html.escape(article.title)}</h3><p>{html.escape(article.excerpt)}</p><div class="abh-card-bottom"><span>{html.escape(article.read_time)}</span><span class="abh-card-arrow" aria-hidden="true">↗</span></div></div>
    </article>"""


def standard_card(article: Article, number: int) -> str:
    return f"""
    <article class="abh-card abh-card-standard abh-article-card" data-category="{html.escape(article.category_slug)}" data-search="{html.escape(article_search_text(article))}">
      <a class="abh-card-hit" href="{html.escape(article.href)}" aria-label="Đọc {html.escape(article.title)}"></a>
      <div class="abh-card-top"><span>{html.escape(article.category)}</span><time datetime="{html.escape(article.date_iso)}">{html.escape(article.date_label)}</time></div>
      <span class="abh-card-number">{number:02d}</span><h3>{html.escape(article.title)}</h3><p>{html.escape(article.excerpt)}</p>
      <div class="abh-card-bottom"><span>{html.escape(article.read_time)}</span><span class="abh-card-arrow" aria-hidden="true">↗</span></div>
    </article>"""


def category_cards(categories: list[dict[str, str]], counts: Counter[str]) -> str:
    cards: list[str] = []
    for index, item in enumerate(categories, 1):
        slug = item["slug"]
        label = item["label"]
        count = counts.get(slug, 0)
        description = CATEGORY_DESCRIPTIONS.get(slug, "Kiến thức và bài tập thực hành theo từng chủ đề.")
        tag = "a" if count else "div"
        href = f' href="/blog/{html.escape(slug)}/"' if count else ""
        status = f"{count} bài viết" if count else "Sắp có bài"
        state = " is-active" if count else " is-empty"
        cards.append(
            f'<{tag} class="abh-topic{state}"{href}><span class="abh-topic-index">{index:02d}</span>'
            f'<div><h3>{html.escape(label)}</h3><p>{html.escape(description)}</p></div>'
            f'<span class="abh-topic-status">{html.escape(status)}</span></{tag}>'
        )
    return "".join(cards)


def build_main(articles: list[Article], categories: list[dict[str, str]]) -> str:
    counts = Counter(article.category_slug for article in articles)
    active_categories = sum(1 for count in counts.values() if count)
    featured = featured_card(articles[0])
    compact = "".join(compact_card(article, index) for index, article in enumerate(articles[1:3], 2))
    remaining = articles[3:]
    remaining_section = ""
    if remaining:
        remaining_cards = "".join(
            standard_card(article, index) for index, article in enumerate(remaining, 4)
        )
        remaining_section = f"""
        <section class="abh-section abh-all" aria-labelledby="abh-all-title">
          <div class="p2-wrap"><div class="abh-section-heading"><div><span class="abh-kicker">Thư viện</span><h2 id="abh-all-title">Tất cả bài viết.</h2></div><p>Chọn đúng vấn đề đang gặp, đọc phần cần thiết và quay lại thực hành.</p></div><div class="abh-all-grid">{remaining_cards}</div></div>
        </section>"""

    chips = []
    for item in categories:
        count = counts.get(item["slug"], 0)
        if count:
            chips.append(
                f'<a href="/blog/{html.escape(item["slug"])}/">{html.escape(item["label"])}<span>{count}</span></a>'
            )
        else:
            chips.append(f'<span>{html.escape(item["label"])}<small>Sắp có</small></span>')

    return f"""<main class="abh-main" id="main-content">
      <section class="abh-hero">
        <div class="p2-wrap">
          <div class="abh-hero-grid">
            <div class="abh-hero-copy"><span class="abh-kicker">Kiến thức nhiếp ảnh thực hành</span><h1>Học nhiếp ảnh bắt đầu từ câu hỏi thật.</h1><p>Không gom lý thuyết để đọc cho đủ. Mỗi bài giải quyết một vấn đề cụ thể về thiết bị, kỹ thuật, ánh sáng, hậu kỳ hoặc con đường làm nghề.</p>
              <form class="abh-search" role="search" aria-label="Tìm bài viết"><label for="abh-search-input">Bạn đang cần giải quyết điều gì?</label><div><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m21 21-4.35-4.35m2.35-5.65a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z"/></svg><input id="abh-search-input" type="search" autocomplete="off" placeholder="Ví dụ: mua máy, Lightroom, học bao lâu…"><button type="button" id="abh-search-clear" hidden>Xóa</button></div><p id="abh-search-status" aria-live="polite">Tìm trong {len(articles)} bài đã xuất bản.</p></form>
            </div>
            <aside class="abh-hero-panel" aria-label="Tổng quan thư viện"><div class="abh-stat"><strong>{len(articles):02d}</strong><span>Bài đã xuất bản</span></div><div class="abh-stat"><strong>{active_categories:02d}</strong><span>Chủ đề đang có bài</span></div><div class="abh-principle"><span>Nguyên tắc biên tập</span><p>Thực tế, có nguồn, có bước để người mới áp dụng.</p></div><a href="#bai-moi">Đọc bài mới nhất <span aria-hidden="true">↓</span></a></aside>
          </div>
          <nav class="abh-topic-nav" aria-label="Danh mục blog">{''.join(chips)}</nav>
        </div>
      </section>

      <section class="abh-section abh-latest-section" id="bai-moi" aria-labelledby="abh-latest-title">
        <div class="p2-wrap"><div class="abh-section-heading"><div><span class="abh-kicker">Mới cập nhật</span><h2 id="abh-latest-title">Bắt đầu từ bài phù hợp.</h2></div><p>Đừng đọc theo thứ tự xuất bản. Chọn câu hỏi gần nhất với tình trạng hiện tại của bạn.</p></div><div class="abh-latest-grid">{featured}<div class="abh-side-list">{compact}</div></div><div class="abh-no-results" id="abh-no-results" hidden><strong>Chưa có bài khớp từ khóa.</strong><p>Thử tìm bằng một từ ngắn hơn như “máy ảnh”, “hậu kỳ” hoặc “học”.</p></div></div>
      </section>

      {remaining_section}

      <section class="abh-section abh-topics-section" aria-labelledby="abh-topics-title"><div class="p2-wrap"><div class="abh-section-heading"><div><span class="abh-kicker">Đọc theo chủ đề</span><h2 id="abh-topics-title">Một thư viện có cấu trúc.</h2></div><p>Danh mục chỉ mở liên kết khi đã có bài, nên người đọc không bị dẫn vào trang trống.</p></div><div class="abh-topic-grid">{category_cards(categories, counts)}</div></div></section>

      <section class="abh-section abh-cta-section"><div class="p2-wrap"><div class="abh-cta"><div><span class="abh-kicker">Cần người nhìn đúng vấn đề?</span><h2>Biết mình đang thiếu gì trước khi chọn khóa học.</h2><p>Gửi mục tiêu, thiết bị đang có và một số ảnh gần nhất. Academy sẽ giúp xác định nên ưu tiên vận hành máy, ánh sáng, tư duy hình ảnh hay hậu kỳ.</p></div><a class="abh-cta-button" href="/#tu-van" data-track="blog_consultation_click">Nhận tư vấn lộ trình <span aria-hidden="true">↗</span></a></div></div></section>
    </main>"""


def redesign(index_html: str, config_path: Path) -> tuple[str, int]:
    articles = extract_articles(index_html)
    categories = load_categories(config_path)
    main_html = build_main(articles, categories)

    updated = re.sub(r'<style\b[^>]*id="academy-blog-home-v2"[^>]*>.*?</style>', '', index_html, flags=re.I | re.S)
    updated = re.sub(r'<script\b[^>]*id="academy-blog-home-v2-script"[^>]*>.*?</script>', '', updated, flags=re.I | re.S)
    updated = re.sub(r'<link\b[^>]*href="/blog-home-v2\.css"[^>]*>', '', updated, flags=re.I)
    updated = re.sub(r'<script\b[^>]*src="/blog-home-v2\.js"[^>]*>\s*</script>', '', updated, flags=re.I)
    updated, count = re.subn(r'<main\b[^>]*>.*?</main>', main_html, updated, count=1, flags=re.I | re.S)
    if count != 1:
        raise RuntimeError("Could not replace the blog homepage <main> region")
    updated = re.sub(r'<body\b([^>]*)data-blog-home-v2="true"([^>]*)>', r'<body\1\2>', updated, count=1, flags=re.I)
    updated = re.sub(r'<body\b([^>]*)>', r'<body\1 data-blog-home-v2="true">', updated, count=1, flags=re.I)
    if '</head>' not in updated or '</body>' not in updated:
        raise RuntimeError("Blog homepage is missing head or body closing tag")
    updated = updated.replace('</head>', '<link rel="stylesheet" href="/blog-home-v2.css"></head>', 1)
    updated = updated.replace('</body>', '<script defer src="/blog-home-v2.js"></script></body>', 1)
    return updated, len(articles)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--site", type=Path, required=True)
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--css", type=Path, required=True)
    parser.add_argument("--js", type=Path, required=True)
    args = parser.parse_args()
    index_path = args.site / "blog" / "index.html"
    if not index_path.is_file():
        raise SystemExit(f"Blog homepage not found: {index_path}")
    try:
        updated, article_count = redesign(index_path.read_text(encoding="utf-8"), args.config)
        (args.site / "blog-home-v2.css").write_text(args.css.read_text(encoding="utf-8"), encoding="utf-8")
        (args.site / "blog-home-v2.js").write_text(args.js.read_text(encoding="utf-8"), encoding="utf-8")
    except (RuntimeError, OSError, json.JSONDecodeError) as exc:
        raise SystemExit(f"blog-home-redesign-error: {exc}") from exc
    index_path.write_text(updated, encoding="utf-8")
    print(json.dumps({"status": "ok", "articles": article_count, "homepage": str(index_path)}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
