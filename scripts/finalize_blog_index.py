#!/usr/bin/env python3
"""Remove category links that do not yet have a generated category page."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--site", type=Path, required=True)
    args = parser.parse_args()

    blog_root = args.site / "blog"
    manifest_path = blog_root / "routes.json"
    index_path = blog_root / "index.html"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    active = {item["slug"] for item in manifest.get("categories", [])}
    content = index_path.read_text(encoding="utf-8")

    pattern = re.compile(
        r'<a class="blog-category-chip" href="/blog/([^/]+)/">(.*?)</a>',
        re.I | re.S,
    )

    def replace(match: re.Match[str]) -> str:
        slug, label = match.group(1), match.group(2)
        if slug in active:
            return match.group(0)
        return f'<span class="blog-category-chip">{label}</span>'

    content = pattern.sub(replace, content)
    index_path.write_text(content, encoding="utf-8")

    for slug in active:
        page = blog_root / slug / "index.html"
        if not page.is_file():
            raise SystemExit(f"Missing active category page: {page}")
    for match in pattern.finditer(content):
        slug = match.group(1)
        if slug not in active:
            raise SystemExit(f"Index links to inactive category: {slug}")

    print(f"finalized {len(active)} active blog category links")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
