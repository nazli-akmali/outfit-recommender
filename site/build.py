#!/usr/bin/env python3
"""Assemble the GitHub Pages showcase site from site/showcase.json.

    python3 site/build.py            # writes the site into _site/

Output layout:
    <output>/            files from the "static" folder (landing page, CSS, images)
    <output>/<demo>/     the runnable app, copied as-is
    <output>/<page>/     each Markdown page rendered into its HTML template

Relative links inside the Markdown are rewritten so they keep working on the
site: links to another rendered page point at that page, and links to any other
repository file point at the file on GitHub.

Needs the "markdown" package (pip install markdown==3.7).
"""
import html
import json
import posixpath
import re
import shutil
import sys
from pathlib import Path

try:
    import markdown
except ImportError:
    sys.exit('Missing dependency: run "pip install markdown==3.7" first.')

ROOT = Path(__file__).resolve().parent.parent
CONFIG = json.loads((ROOT / 'site' / 'showcase.json').read_text())
OUT = ROOT / CONFIG.get('output', '_site')
REPO = CONFIG['repo'].rstrip('/')
BRANCH = CONFIG.get('branch', 'main')


def copy(src: Path, dest: Path):
    if src.is_dir():
        shutil.copytree(src, dest, dirs_exist_ok=True, ignore=shutil.ignore_patterns('.DS_Store'))
    else:
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dest)


def rewrite_links(body: str, source: str, page_dest: str, page_map: dict) -> str:
    """Make relative links from the Markdown file work on the published site."""
    src_dir = posixpath.dirname(source)
    depth = page_dest.count('/') + 1  # the page lives at <page_dest>/index.html

    def fix(match):
        attr, url = match.group(1), html.unescape(match.group(2))
        if re.match(r'^([a-z]+:|#|/)', url):
            return match.group(0)
        path, _, frag = url.partition('#')
        target = posixpath.normpath(posixpath.join(src_dir, path))
        if target in page_map:
            new = '../' * depth + page_map[target] + '/'
        elif target in ('README.md', '.'):
            new = '../' * depth  # the project landing page
        else:
            kind = 'tree' if (ROOT / target).is_dir() else 'blob'
            new = f'{REPO}/{kind}/{BRANCH}/{target}'
        if frag:
            new += '#' + frag
        return f'{attr}="{html.escape(new)}"'

    return re.sub(r'\b(href|src)="([^"]*)"', fix, body)


def render_page(page: dict, page_map: dict):
    text = (ROOT / page['source']).read_text()
    # The first H1 becomes the page title; a leading "← back" link line is dropped
    # because the template has its own navigation.
    title_match = re.search(r'^# (.+)$', text, re.M)
    title = title_match.group(1).strip() if title_match else CONFIG['title']
    if title_match:
        text = text[:title_match.start()] + text[title_match.end():]
    text = re.sub(r'^\[←[^\]]*\]\([^)]*\)\s*$', '', text, count=1, flags=re.M)

    md = markdown.Markdown(extensions=['tables', 'fenced_code', 'sane_lists', 'toc'],
                           extension_configs={'toc': {'toc_depth': '2'}})
    body = md.convert(text)
    body = rewrite_links(body, page['source'], page['dest'], page_map)
    # Wrap tables so they scroll sideways on phones instead of widening the page.
    body = body.replace('<table>', '<div class="table-wrap"><table>').replace('</table>', '</table></div>')
    def h2s(tokens):
        for t in tokens:
            if t['level'] == 2:
                yield t
            else:
                yield from h2s(t.get('children', []))
    toc = ''.join(f'<li><a href="#{t["id"]}">{t["name"]}</a></li>' for t in h2s(md.toc_tokens))
    short_title = re.split(r'\s+[—–-]\s+', title)[0]
    values = {
        'title': html.escape(title),
        'short_title': html.escape(short_title),
        'site_title': html.escape(CONFIG['title']),
        'author': html.escape(CONFIG.get('author', '')),
        'eyebrow': html.escape(page.get('eyebrow', '')),
        'toc': toc,
        'content': body,
        'repo': html.escape(REPO),
        'portfolio': html.escape(CONFIG.get('portfolio', '')),
        'root': '../' * (page['dest'].count('/') + 1),
        'source_url': html.escape(f'{REPO}/blob/{BRANCH}/{page["source"]}'),
    }
    template = (ROOT / page['template']).read_text()
    out = re.sub(r'\{\{\s*(\w+)\s*\}\}', lambda m: values[m.group(1)], template)
    dest = OUT / page['dest'] / 'index.html'
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(out)
    return dest


def main():
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir()
    copy(ROOT / CONFIG['static'], OUT)

    demo = CONFIG.get('demo')
    if demo:
        # "dir": copy a build output folder's contents (e.g. "dist");
        # "files": copy listed files/folders from the repo root, keeping their names.
        if demo.get('dir'):
            copy(ROOT / demo['dir'], OUT / demo['dest'])
        for name in demo.get('files', []):
            copy(ROOT / name, OUT / demo['dest'] / name)

    pages = CONFIG.get('pages', [])
    page_map = {p['source']: p['dest'] for p in pages}
    for page in pages:
        print('rendered', render_page(page, page_map).relative_to(ROOT))

    (OUT / '.nojekyll').write_text('')  # serve files as-is, no Jekyll processing
    print(f'Site written to {OUT.relative_to(ROOT)}/')


if __name__ == '__main__':
    main()
