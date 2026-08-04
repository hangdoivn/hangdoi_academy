#!/usr/bin/env python3
"""Convert flat Academy blog routes into /blog/<category>/<article>/ routes."""

from __future__ import annotations

import argparse
import html
import json
import re
import shutil
import sys
from dataclasses import dataclass
from datetime import date
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse

BASE_URL = "https://academy.hangdoiproduction.com"
TEXT_SUFFIXES = {".html", ".xml", ".txt", ".json"}


class RouteError(RuntimeError):
    pass


def class_tokens(attrs: list[tuple[str, str | None]]) -> set[str]:
    return set((dict(attrs).get("class") or "").split())


class BlogIndexParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.article_depth = 0
        self.meta_depth = 0
        self.capture_category = False
        self.category_buffer: list[str] = []
        self.current_category: str | None = None
        self.current_slug: str | None = None
        self.articles: list[tuple[str, str]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        classes = class_tokens(attrs)
        if tag == "article" and "blog-card" in classes:
            self.article_depth = 1
            self.current_category = None
            self.current_slug = None
            return
        if not self.article_depth:
            return
        self.article_depth += 1
        if tag == "div" and "blog-card-meta" in classes:
            self.meta_depth = self.article_depth
        elif tag == "span" and self.meta_depth:
            self.capture_category = True
            self.category_buffer = []
        elif tag == "a":
            href = dict(attrs).get("href") or ""
            match = re.fullmatch(r"/blog/([^/]+)/?", urlparse(href).path)
            if match:
                self.current_slug = match.group(1)

    def handle_endtag(self, tag: str) -> None:
        if tag == "span" and self.capture_category:
            label = " ".join("".join(self.category_buffer).split())
            if label and self.current_category is None:
                self.current_category = label
            self.capture_category = False
        if not self.article_depth:
            return
        if self.article_depth == self.meta_depth and tag == "div":
            self.meta_depth = 0
        self.article_depth -= 1
        if self.article_depth == 0:
            if not self.current_slug:
                raise RouteError("Blog card is missing /blog/<slug>/")
            if not self.current_category:
                raise RouteError(f"Blog card {self.current_slug!r} has no category")
            pair = (self.current_slug, self.current_category)
            if pair not in self.articles:
                self.articles.append(pair)

    def handle_data(self, data: str) -> None:
        if self.capture_category:
            self.category_buffer.append(data)


@dataclass(frozen=True)
class ArticleRoute:
    article_slug: str
    category_label: str
    category_slug: str

    @property
    def old_path(self) -> str:
        return f"/blog/{self.article_slug}/"

    @property
    def new_path(self) -> str:
        return f"/blog/{self.category_slug}/{self.article_slug}/"


def load_categories(path: Path) -> tuple[dict[str, str], dict[str, str]]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError) as exc:
        raise RouteError(f"Cannot read category config {path}: {exc}") from exc
    categories = payload.get("categories")
    if not isinstance(categories, list) or not categories:
        raise RouteError("Category config must contain a non-empty categories list")
    label_to_slug: dict[str, str] = {}
    slug_to_label: dict[str, str] = {}
    for item in categories:
        slug = str(item.get("slug", "")).strip()
        label = str(item.get("label", "")).strip()
        aliases = item.get("aliases", [])
        if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", slug):
            raise RouteError(f"Invalid category slug: {slug!r}")
        if not label or slug in slug_to_label:
            raise RouteError(f"Invalid or duplicate category: {slug!r}")
        slug_to_label[slug] = label
        for candidate in [label, *aliases]:
            key = " ".join(str(candidate).split()).casefold()
            if key in label_to_slug and label_to_slug[key] != slug:
                raise RouteError(f"Category alias collision: {candidate!r}")
            label_to_slug[key] = slug
    return label_to_slug, slug_to_label


def extract_routes(index_html: str, config_path: Path) -> tuple[list[ArticleRoute], dict[str, str], dict[str, str]]:
    parser = BlogIndexParser()
    parser.feed(index_html)
    if not parser.articles:
        raise RouteError("No blog cards found in blog/index.html")
    label_to_slug, slug_to_label = load_categories(config_path)
    routes: list[ArticleRoute] = []
    seen: set[str] = set()
    for article_slug, category_label in parser.articles:
        if article_slug in seen:
            raise RouteError(f"Duplicate article slug: {article_slug}")
        seen.add(article_slug)
        category_slug = label_to_slug.get(" ".join(category_label.split()).casefold())
        if not category_slug:
            raise RouteError(
                f"Unknown category {category_label!r} for {article_slug!r}; add it to {config_path}"
            )
        routes.append(ArticleRoute(article_slug, category_label, category_slug))
    return routes, label_to_slug, slug_to_label


def article_title(article_html: str, fallback: str) -> str:
    match = re.search(r"<h1[^>]*>(.*?)</h1>", article_html, re.I | re.S)
    if not match:
        match = re.search(r"<title[^>]*>(.*?)</title>", article_html, re.I | re.S)
    raw = match.group(1) if match else fallback
    raw = html.unescape(re.sub(r"<[^>]+>", " ", raw))
    return " ".join(raw.split()).split(" | ", 1)[0].strip() or fallback


def enrich_article(article_html: str, route: ArticleRoute, base_url: str) -> str:
    article_html = article_html.replace('"@type":"Article"', '"@type":"BlogPosting"')
    article_html = article_html.replace('"@type": "Article"', '"@type": "BlogPosting"')
    if '"@type":"BreadcrumbList"' in article_html or '"@type": "BreadcrumbList"' in article_html:
        return article_html
    schema = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Trang chủ", "item": f"{base_url}/"},
            {"@type": "ListItem", "position": 2, "name": "Kiến thức", "item": f"{base_url}/blog/"},
            {
                "@type": "ListItem",
                "position": 3,
                "name": route.category_label,
                "item": f"{base_url}/blog/{route.category_slug}/",
            },
            {
                "@type": "ListItem",
                "position": 4,
                "name": article_title(article_html, route.article_slug),
                "item": f"{base_url}{route.new_path}",
            },
        ],
    }
    script = '<script type="application/ld+json">' + json.dumps(
        schema, ensure_ascii=False, separators=(",", ":")
    ) + "</script>"
    if "</head>" not in article_html:
        raise RouteError(f"Article {route.article_slug!r} has no </head>")
    return article_html.replace("</head>", script + "</head>", 1)


def redirect_html(route: ArticleRoute, base_url: str) -> str:
    target = route.new_path
    return f"""<!doctype html><html lang=\"vi\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>Bài viết đã chuyển địa chỉ | Hang Đôi Academy</title><meta name=\"robots\" content=\"noindex,follow\"><link rel=\"canonical\" href=\"{base_url}{target}\"><meta http-equiv=\"refresh\" content=\"0;url={target}\"><script>location.replace({json.dumps(target)});</script></head><body><p>Bài viết đã chuyển sang <a href=\"{target}\">địa chỉ mới</a>.</p></body></html>"""


def extract_cards(index_html: str) -> dict[str, str]:
    cards: dict[str, str] = {}
    pattern = re.compile(r'<article\b[^>]*class="[^"]*blog-card[^"]*"[^>]*>.*?</article>', re.I | re.S)
    for block in pattern.findall(index_html):
        match = re.search(r'href="/blog/([^/]+)/"', block)
        if match:
            cards[match.group(1)] = block
    return cards


def category_page(
    category_slug: str,
    category_label: str,
    routes: list[ArticleRoute],
    cards: dict[str, str],
    base_url: str,
) -> str:
    canonical = f"{base_url}/blog/{category_slug}/"
    description = f"Các bài viết thuộc chủ đề {category_label} từ Hang Đôi Academy tại Đà Nẵng."
    selected = [cards[r.article_slug] for r in routes if r.article_slug in cards]
    if not selected:
        selected = [f'<article class="blog-card"><h2><a href="{r.new_path}">{r.article_slug}</a></h2></article>' for r in routes]
    schema = {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "CollectionPage",
                "name": f"{category_label} | Hang Đôi Academy",
                "description": description,
                "url": canonical,
                "inLanguage": "vi-VN",
                "isPartOf": {"@id": f"{base_url}/#website"},
            },
            {
                "@type": "BreadcrumbList",
                "itemListElement": [
                    {"@type": "ListItem", "position": 1, "name": "Trang chủ", "item": f"{base_url}/"},
                    {"@type": "ListItem", "position": 2, "name": "Kiến thức", "item": f"{base_url}/blog/"},
                    {"@type": "ListItem", "position": 3, "name": category_label, "item": canonical},
                ],
            },
        ],
    }
    return f"""<!doctype html><html lang=\"vi\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>{html.escape(category_label)} | Hang Đôi Academy</title><meta name=\"description\" content=\"{html.escape(description)}\"><link rel=\"canonical\" href=\"{canonical}\"><meta name=\"robots\" content=\"index,follow,max-image-preview:large\"><meta property=\"og:type\" content=\"website\"><meta property=\"og:locale\" content=\"vi_VN\"><meta property=\"og:site_name\" content=\"Hang Đôi Academy\"><meta property=\"og:title\" content=\"{html.escape(category_label)} | Hang Đôi Academy\"><meta property=\"og:description\" content=\"{html.escape(description)}\"><meta property=\"og:url\" content=\"{canonical}\"><link rel=\"icon\" type=\"image/svg+xml\" href=\"/logo-academy.svg\"><link rel=\"stylesheet\" href=\"/phase2.css\"><link rel=\"stylesheet\" href=\"/blog.css\"><script defer src=\"/logo-inline.js\"></script><script defer src=\"/blog.js\"></script><script type=\"application/ld+json\">{json.dumps(schema, ensure_ascii=False, separators=(",", ":"))}</script></head><body class=\"p2-page blog-page\" data-page-type=\"blog-category\"><nav class=\"p2-nav\"><div class=\"p2-wrap p2-nav-inner\"><a class=\"p2-brand\" href=\"/\">Hang Đôi Academy</a><div class=\"p2-nav-links\"><a href=\"/khoa-hoc/\">Khóa học</a><a href=\"/giang-vien/\">Giảng viên</a><a href=\"/hoc-vien/\">Học viên</a><a aria-current=\"page\" href=\"/blog/\">Kiến thức</a></div><a class=\"p2-cta\" href=\"/#tu-van\">Nhận tư vấn</a></div></nav><main><section class=\"p2-hero blog-hero\"><div class=\"p2-wrap\"><span class=\"p2-eyebrow\">Chủ đề</span><h1>{html.escape(category_label)}</h1><p class=\"p2-lead\">{html.escape(description)}</p><p><a href=\"/blog/\">← Xem toàn bộ bài viết</a></p></div></section><section class=\"p2-section alt\"><div class=\"p2-wrap\"><div class=\"blog-grid\">{''.join(selected)}</div></div></section></main><footer class=\"p2-footer\"><div class=\"p2-wrap p2-footer-grid\"><div><strong>Hang Đôi Academy</strong><p>Đào tạo nhiếp ảnh thực hành tại Đà Nẵng.</p></div><div><strong>98 Điện Biên Phủ, Đà Nẵng</strong><p>Hotline: 0888 445 997</p></div></div><div class=\"p2-wrap p2-footer-bottom\">© {date.today().year} Hang Đôi Academy</div></footer></body></html>"""


def rewrite_chips(index_html: str, label_to_slug: dict[str, str]) -> str:
    pattern = re.compile(r'<(span|a)\b[^>]*class="[^"]*blog-category-chip[^"]*"[^>]*>(.*?)</\1>', re.I | re.S)

    def replacement(match: re.Match[str]) -> str:
        label = html.unescape(re.sub(r"<[^>]+>", "", match.group(2)))
        slug = label_to_slug.get(" ".join(label.split()).casefold())
        if not slug:
            return match.group(0)
        return f'<a class="blog-category-chip" href="/blog/{slug}/">{match.group(2)}</a>'

    return pattern.sub(replacement, index_html)


def rewrite_text_files(site_root: Path, replacements: dict[str, str]) -> None:
    for path in site_root.rglob("*"):
        if not path.is_file() or path.suffix.lower() not in TEXT_SUFFIXES:
            continue
        content = path.read_text(encoding="utf-8")
        updated = content
        for old, new in replacements.items():
            updated = updated.replace(old, new)
        if updated != content:
            path.write_text(updated, encoding="utf-8")


def append_categories_to_sitemap(site_root: Path, category_slugs: list[str], base_url: str) -> None:
    sitemap = site_root / "sitemap.xml"
    if not sitemap.exists():
        return
    content = sitemap.read_text(encoding="utf-8")
    if "</urlset>" not in content:
        raise RouteError("sitemap.xml has no </urlset>")
    additions = []
    for slug in sorted(set(category_slugs)):
        url = f"{base_url}/blog/{slug}/"
        if url not in content:
            additions.append(f"  <url><loc>{url}</loc></url>")
    if additions:
        sitemap.write_text(content.replace("</urlset>", "\n".join(additions) + "\n</urlset>"), encoding="utf-8")


def validate(site_root: Path, routes: list[ArticleRoute], base_url: str) -> None:
    for route in routes:
        article = site_root / "blog" / route.category_slug / route.article_slug / "index.html"
        redirect = site_root / "blog" / route.article_slug / "index.html"
        category = site_root / "blog" / route.category_slug / "index.html"
        for required in [article, redirect, category]:
            if not required.is_file():
                raise RouteError(f"Missing output: {required}")
        content = article.read_text(encoding="utf-8")
        if f"{base_url}{route.new_path}" not in content:
            raise RouteError(f"Missing canonical for {route.article_slug}")
        if "BreadcrumbList" not in content or "BlogPosting" not in content:
            raise RouteError(f"Missing schema for {route.article_slug}")


def run(site_root: Path, config_path: Path, base_url: str) -> dict[str, object]:
    site_root = site_root.resolve()
    blog_root = site_root / "blog"
    index_path = blog_root / "index.html"
    if not index_path.is_file():
        raise RouteError(f"Blog index not found: {index_path}")
    index_html = index_path.read_text(encoding="utf-8")
    routes, label_to_slug, slug_to_label = extract_routes(index_html, config_path)
    cards = extract_cards(index_html)

    for route in routes:
        source = blog_root / route.article_slug
        target = blog_root / route.category_slug / route.article_slug
        if not (source / "index.html").is_file():
            raise RouteError(f"Flat article not found: {source / 'index.html'}")
        if target.exists():
            raise RouteError(f"Route collision: {target}")

    for route in routes:
        source = blog_root / route.article_slug
        target = blog_root / route.category_slug / route.article_slug
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(source), str(target))
        article_path = target / "index.html"
        article_path.write_text(
            enrich_article(article_path.read_text(encoding="utf-8"), route, base_url),
            encoding="utf-8",
        )

    replacements = {route.old_path: route.new_path for route in routes}
    rewrite_text_files(site_root, replacements)
    index_path.write_text(rewrite_chips(index_path.read_text(encoding="utf-8"), label_to_slug), encoding="utf-8")

    by_category: dict[str, list[ArticleRoute]] = {}
    for route in routes:
        by_category.setdefault(route.category_slug, []).append(route)
    for category_slug, category_routes in by_category.items():
        page = category_page(category_slug, slug_to_label[category_slug], category_routes, cards, base_url)
        for route in routes:
            page = page.replace(route.old_path, route.new_path)
        category_dir = blog_root / category_slug
        category_dir.mkdir(parents=True, exist_ok=True)
        (category_dir / "index.html").write_text(page, encoding="utf-8")

    for route in routes:
        legacy_dir = blog_root / route.article_slug
        legacy_dir.mkdir(parents=True, exist_ok=True)
        (legacy_dir / "index.html").write_text(redirect_html(route, base_url), encoding="utf-8")

    append_categories_to_sitemap(site_root, list(by_category), base_url)
    manifest = {
        "version": 1,
        "base_url": base_url,
        "route_pattern": "/blog/{category_slug}/{article_slug}/",
        "categories": [
            {"slug": slug, "label": slug_to_label[slug], "article_count": len(items)}
            for slug, items in sorted(by_category.items())
        ],
        "articles": [
            {
                "article_slug": route.article_slug,
                "category_slug": route.category_slug,
                "category_label": route.category_label,
                "url": f"{base_url}{route.new_path}",
                "legacy_url": f"{base_url}{route.old_path}",
            }
            for route in routes
        ],
    }
    (blog_root / "routes.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    validate(site_root, routes, base_url)
    return manifest


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--site", type=Path, required=True)
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--base-url", default=BASE_URL)
    args = parser.parse_args()
    try:
        manifest = run(args.site, args.config, args.base_url.rstrip("/"))
    except RouteError as exc:
        print(f"blog-route-error: {exc}", file=sys.stderr)
        return 1
    print(json.dumps({"status": "ok", "articles": len(manifest["articles"]), "categories": len(manifest["categories"]), "route_pattern": manifest["route_pattern"]}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
