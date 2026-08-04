#!/usr/bin/env python3
"""Generate editorial blog visuals and inject them into the published Academy site."""

from __future__ import annotations

import argparse
import html
import json
import re
import shutil
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw, ImageFont

BASE_URL = "https://academy.hangdoiproduction.com"
GREEN = "#103F2D"
GREEN_2 = "#2D6D54"
PAPER = "#F5F7F1"
WHITE = "#FFFFFF"
YELLOW = "#F5C518"
MUTED = "#637B70"
LINE = "#C9D6CF"


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf",
    ]
    for path in candidates:
        if Path(path).is_file():
            return ImageFont.truetype(path, size=size)
    return ImageFont.load_default()


def wrap(draw: ImageDraw.ImageDraw, text: str, font_obj: ImageFont.ImageFont, max_width: int) -> list[str]:
    words = text.split()
    lines: list[str] = []
    current = ""
    for word in words:
        trial = f"{current} {word}".strip()
        box = draw.textbbox((0, 0), trial, font=font_obj)
        if box[2] - box[0] <= max_width or not current:
            current = trial
        else:
            lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def text_block(draw: ImageDraw.ImageDraw, xy: tuple[int, int], text: str, font_obj: ImageFont.ImageFont, fill: str, max_width: int, spacing: int = 8) -> int:
    x, y = xy
    lines = wrap(draw, text, font_obj, max_width)
    for line in lines:
        draw.text((x, y), line, font=font_obj, fill=fill)
        bbox = draw.textbbox((x, y), line, font=font_obj)
        y = bbox[3] + spacing
    return y


def rounded(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], radius: int, fill: str, outline: str | None = None, width: int = 1) -> None:
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def cover_visual(draw: ImageDraw.ImageDraw, visual: str) -> None:
    if visual == "camera":
        rounded(draw, (720, 145, 1110, 505), 42, GREEN, None)
        rounded(draw, (770, 100, 930, 185), 24, GREEN, None)
        draw.ellipse((825, 205, 1035, 415), fill=PAPER, outline=YELLOW, width=18)
        draw.ellipse((875, 255, 985, 365), fill=GREEN_2)
        draw.ellipse((1025, 175, 1065, 215), fill=YELLOW)
        for index, label in enumerate(["Nhu cầu", "Body", "Lens", "Phụ kiện"]):
            x = 675 + index * 125
            rounded(draw, (x, 540, x + 108, 603), 18, WHITE, LINE)
            draw.text((x + 54, 571), label, font=font(16, True), fill=GREEN, anchor="mm")
            if index < 3:
                draw.line((x + 110, 571, x + 124, 571), fill=YELLOW, width=5)
    elif visual == "software":
        rounded(draw, (700, 115, 875, 360), 34, "#DDE9E2", GREEN_2, 3)
        rounded(draw, (905, 190, 1080, 435), 34, GREEN, None)
        draw.text((787, 237), "Lr", font=font(78, True), fill=GREEN, anchor="mm")
        draw.text((992, 312), "Ps", font=font(78, True), fill=YELLOW, anchor="mm")
        draw.line((860, 405, 920, 405), fill=YELLOW, width=8)
        draw.polygon([(920, 405), (900, 390), (900, 420)], fill=YELLOW)
        labels = [(730, 500, "Quản lý bộ ảnh"), (915, 500, "Xử lý chi tiết")]
        for x, y, label in labels:
            rounded(draw, (x, y, x + 175, y + 58), 18, WHITE, LINE)
            draw.text((x + 87, y + 29), label, font=font(15, True), fill=GREEN, anchor="mm")
    else:
        start_x = 690
        y = 340
        draw.line((start_x, y, 1090, y), fill=GREEN_2, width=8)
        labels = ["Biết máy", "Tự chụp", "Bộ ảnh", "Portfolio"]
        for index, label in enumerate(labels):
            x = start_x + index * 133
            draw.ellipse((x - 23, y - 23, x + 23, y + 23), fill=YELLOW, outline=GREEN, width=5)
            rounded(draw, (x - 55, y + 62, x + 85, y + 122), 18, WHITE, LINE)
            draw.text((x + 15, y + 92), label, font=font(15, True), fill=GREEN, anchor="mm")
        draw.text((890, 185), "8", font=font(160, True), fill=GREEN, anchor="mm")
        draw.text((890, 265), "TUẦN THỰC HÀNH", font=font(20, True), fill=GREEN_2, anchor="mm")


def make_cover(path: Path, article: dict[str, Any]) -> None:
    cover = article["cover"]
    image = Image.new("RGB", (1200, 675), PAPER)
    draw = ImageDraw.Draw(image)
    draw.ellipse((-180, 430, 420, 1030), fill="#E4ECE6")
    draw.ellipse((950, -250, 1430, 230), fill="#E6EEE8")
    draw.rectangle((0, 0, 22, 675), fill=YELLOW)
    draw.text((78, 76), cover["label"], font=font(20, True), fill=GREEN_2)
    draw.rectangle((78, 112, 138, 119), fill=YELLOW)
    y = text_block(draw, (78, 158), cover["title"], font(50, True), GREEN, 555, 10)
    y += 20
    text_block(draw, (78, y), cover["subtitle"], font(23, False), MUTED, 540, 8)
    draw.text((78, 610), "HANG ĐÔI ACADEMY · MINH HỌA BIÊN TẬP", font=font(14, True), fill=GREEN_2)
    cover_visual(draw, cover.get("visual", "timeline"))
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, "PNG", optimize=True)


def make_social(path: Path, article: dict[str, Any]) -> None:
    cover = article["cover"]
    image = Image.new("RGB", (1080, 1350), PAPER)
    draw = ImageDraw.Draw(image)
    draw.rectangle((0, 0, 1080, 24), fill=YELLOW)
    draw.ellipse((-300, 920, 580, 1800), fill="#E3ECE5")
    draw.ellipse((760, -250, 1320, 310), fill="#E6EEE8")
    draw.text((72, 82), cover["label"], font=font(22, True), fill=GREEN_2)
    draw.rectangle((72, 126, 142, 134), fill=YELLOW)
    y = text_block(draw, (72, 190), cover["title"], font(58, True), GREEN, 890, 13)
    y += 28
    text_block(draw, (72, y), cover["subtitle"], font(27, False), MUTED, 860, 9)
    visual = Image.new("RGB", (1200, 675), PAPER)
    visual_draw = ImageDraw.Draw(visual)
    cover_visual(visual_draw, cover.get("visual", "timeline"))
    crop = visual.crop((620, 70, 1160, 630)).resize((780, 808), Image.Resampling.LANCZOS)
    image.paste(crop, (250, 500))
    draw.text((72, 1270), "HANG ĐÔI ACADEMY", font=font(18, True), fill=GREEN)
    draw.text((1008, 1270), "KIẾN THỨC NHIẾP ẢNH THỰC HÀNH", font=font(14, True), fill=GREEN_2, anchor="ra")
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, "PNG", optimize=True)


def make_guide(path: Path, article: dict[str, Any]) -> None:
    guide = article["guide"]
    image = Image.new("RGB", (1200, 820), WHITE)
    draw = ImageDraw.Draw(image)
    draw.rectangle((0, 0, 1200, 120), fill=GREEN)
    draw.rectangle((64, 120, 86, 820), fill=YELLOW)
    draw.text((64, 38), guide["title"], font=font(38, True), fill=WHITE)
    draw.text((1080, 51), "HĐA", font=font(22, True), fill=YELLOW, anchor="mm")
    steps = guide.get("steps", [])
    top = 170
    gap = 142
    for index, step in enumerate(steps, 1):
        y = top + (index - 1) * gap
        draw.ellipse((116, y + 8, 184, y + 76), fill=YELLOW)
        draw.text((150, y + 42), f"{index:02d}", font=font(23, True), fill=GREEN, anchor="mm")
        rounded(draw, (220, y, 1100, y + 92), 24, PAPER, LINE, 2)
        text_block(draw, (258, y + 23), step, font(25, True), GREEN, 790, 6)
        if index < len(steps):
            draw.line((150, y + 82, 150, y + gap + 4), fill=LINE, width=4)
    draw.text((1060, 780), "Minh họa biên tập · Hang Đôi Academy", font=font(13, False), fill=MUTED, anchor="ra")
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, "PNG", optimize=True)


def update_schema(content: str, image_url: str) -> str:
    pattern = re.compile(r'(<script\s+type="application/ld\+json">)(.*?)(</script>)', re.I | re.S)

    def replace(match: re.Match[str]) -> str:
        try:
            payload = json.loads(match.group(2))
        except json.JSONDecodeError:
            return match.group(0)
        nodes: list[dict[str, Any]] = []
        if isinstance(payload, dict):
            graph = payload.get("@graph")
            if isinstance(graph, list):
                nodes.extend(item for item in graph if isinstance(item, dict))
            else:
                nodes.append(payload)
        changed = False
        for node in nodes:
            node_type = node.get("@type")
            types = node_type if isinstance(node_type, list) else [node_type]
            if "BlogPosting" in types or "Article" in types:
                node["image"] = [image_url]
                changed = True
        if not changed:
            return match.group(0)
        encoded = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
        return match.group(1) + encoded + match.group(3)

    return pattern.sub(replace, content)


def upsert_meta(content: str, image_url: str) -> str:
    tags = (
        f'<meta property="og:image" content="{html.escape(image_url)}">'
        '<meta property="og:image:width" content="1200">'
        '<meta property="og:image:height" content="675">'
        f'<meta name="twitter:image" content="{html.escape(image_url)}">'
    )
    content = re.sub(r'<meta\s+(?:property="og:image(?::(?:width|height))?"|name="twitter:image")[^>]*>', '', content, flags=re.I)
    return content.replace('</head>', tags + '</head>', 1)


def inject_article(content: str, article: dict[str, Any], asset_base: str) -> str:
    content = re.sub(r'<!-- academy-blog-assets:start -->.*?<!-- academy-blog-assets:end -->', '', content, flags=re.S)
    if '/blog-assets.css' not in content:
        content = content.replace('</head>', '<link rel="stylesheet" href="/blog-assets.css"></head>', 1)
    content = content.replace('<body ', '<body data-assets-ready="true" ', 1)
    image_url = f"{BASE_URL}{asset_base}/cover.png"
    content = upsert_meta(content, image_url)
    content = update_schema(content, image_url)
    cover = article["cover"]
    guide = article.get("guide")
    cover_markup = (
        '<!-- academy-blog-assets:start -->'
        '<div class="p2-wrap blog-visual-cover"><figure class="blog-visual-figure">'
        f'<img src="{asset_base}/cover.png" width="1200" height="675" loading="eager" fetchpriority="high" alt="{html.escape(cover["alt"])}">'
        '<figcaption><span>Minh họa biên tập</span><span>Hang Đôi Academy</span></figcaption>'
        '</figure></div>'
        '<!-- academy-blog-assets:end -->'
    )
    hero_pattern = re.compile(r'(<section\s+class="p2-hero blog-article-hero".*?</section>)', re.I | re.S)
    content, count = hero_pattern.subn(r'\1' + cover_markup, content, count=1)
    if count != 1:
        raise RuntimeError("Article hero not found")
    if guide:
        guide_markup = (
            '<!-- academy-blog-assets:start -->'
            '<figure class="blog-visual-figure blog-visual-guide">'
            f'<img src="{asset_base}/guide.png" width="1200" height="820" loading="lazy" alt="{html.escape(guide["alt"])}">'
            '<figcaption><span>Quy trình thực hành</span><span>Minh họa biên tập của Hang Đôi Academy</span></figcaption>'
            '</figure>'
            '<!-- academy-blog-assets:end -->'
        )
        answer_pattern = re.compile(r'(<div\s+class="blog-direct-answer".*?</div>)', re.I | re.S)
        content, answer_count = answer_pattern.subn(r'\1' + guide_markup, content, count=1)
        if answer_count != 1:
            raise RuntimeError("Direct answer block not found")
    return content


def inject_homepage(content: str, articles: dict[str, dict[str, Any]], routes: list[dict[str, Any]]) -> str:
    content = re.sub(r'<div class="abh-card-visual".*?</div>', '', content, flags=re.I | re.S)
    if '/blog-assets.css' not in content:
        content = content.replace('</head>', '<link rel="stylesheet" href="/blog-assets.css"></head>', 1)
    for route in routes:
        slug = route["article_slug"]
        asset = articles.get(slug)
        if not asset:
            continue
        href = '/' + '/'.join(route["url"].split('/', 3)[3:])
        asset_base = f'/blog-assets/{route["category_slug"]}/{slug}'
        media = f'<div class="abh-card-visual" aria-hidden="true"><img src="{asset_base}/cover.png" width="1200" height="675" loading="lazy" alt=""></div>'
        pattern = re.compile(
            rf'(<article\b[^>]*class="[^"]*abh-article-card[^"]*"[^>]*>\s*<a\b[^>]*href="{re.escape(href)}"[^>]*></a>)',
            re.I,
        )
        content, count = pattern.subn(r'\1' + media, content, count=1)
        if count != 1:
            raise RuntimeError(f"Homepage card not found for {slug}")
    return content


def fallback_asset(route: dict[str, Any], article_html: str) -> dict[str, Any]:
    title_match = re.search(r'<h1[^>]*>(.*?)</h1>', article_html, re.I | re.S)
    title = re.sub(r'<[^>]+>', ' ', title_match.group(1) if title_match else route["article_slug"])
    title = ' '.join(html.unescape(title).split())
    return {
        "category_slug": route["category_slug"],
        "cover": {
            "label": route.get("category_label", "KIẾN THỨC NHIẾP ẢNH").upper(),
            "title": title,
            "subtitle": "Hướng dẫn thực tế từ Hang Đôi Academy",
            "visual": "timeline",
            "alt": f"Minh họa cho bài viết {title}",
        },
        "first_party_status": "missing",
        "first_party_needed": "Cần lập asset brief first-party theo claim trong bài",
    }


def run(site: Path, config: Path, css: Path) -> dict[str, Any]:
    manifest = json.loads((site / "blog/routes.json").read_text(encoding="utf-8"))
    asset_config = json.loads(config.read_text(encoding="utf-8"))
    configured = asset_config.get("articles", {})
    output_root = site / "blog-assets"
    output_root.mkdir(parents=True, exist_ok=True)
    shutil.copy2(css, site / "blog-assets.css")
    resolved: dict[str, dict[str, Any]] = {}

    for route in manifest["articles"]:
        slug = route["article_slug"]
        article_path = site / "blog" / route["category_slug"] / slug / "index.html"
        content = article_path.read_text(encoding="utf-8")
        article = configured.get(slug) or fallback_asset(route, content)
        resolved[slug] = article
        asset_dir = output_root / route["category_slug"] / slug
        cover_path = asset_dir / "cover.png"
        make_cover(cover_path, article)
        make_social(asset_dir / "social-4x5.png", article)
        if article.get("guide"):
            make_guide(asset_dir / "guide.png", article)
        asset_base = f'/blog-assets/{route["category_slug"]}/{slug}'
        article_path.write_text(inject_article(content, article, asset_base), encoding="utf-8")
        public_manifest = {
            "version": 1,
            "article_slug": slug,
            "category_slug": route["category_slug"],
            "source": asset_config.get("source", "Hang Đôi Academy"),
            "usage_rights_confirmed": bool(asset_config.get("usage_rights_confirmed", True)),
            "cover": {"file": "cover.png", "alt": article["cover"]["alt"], "type": "editorial"},
            "social": {"file": "social-4x5.png", "alt": article["cover"]["alt"], "type": "editorial"},
            "guide": ({"file": "guide.png", "alt": article["guide"]["alt"], "type": "editorial"} if article.get("guide") else None),
            "first_party_status": article.get("first_party_status", asset_config.get("default_first_party_status", "missing")),
            "first_party_needed": article.get("first_party_needed", "Cần xác định"),
        }
        (asset_dir / "assets.json").write_text(json.dumps(public_manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    homepage = site / "blog/index.html"
    homepage.write_text(inject_homepage(homepage.read_text(encoding="utf-8"), resolved, manifest["articles"]), encoding="utf-8")
    return {"articles": len(manifest["articles"]), "configured": len(configured), "generated": len(resolved)}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--site", type=Path, required=True)
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--css", type=Path, required=True)
    args = parser.parse_args()
    result = run(args.site.resolve(), args.config.resolve(), args.css.resolve())
    print(json.dumps(result, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
