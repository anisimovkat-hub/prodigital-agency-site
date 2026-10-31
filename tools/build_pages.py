#!/usr/bin/env python3
"""Собирает SEO/GEO-страницы сайта ProDigital из data/*.json.

    python3 tools/build_pages.py

Создаёт:
  keysy/index.html, keysy/<slug>/index.html   — статья на каждый кейс
  nishi/<slug>/index.html, strany/<slug>/index.html — хабы, только где 2+ кейса
  robots.txt, sitemap.xml, assets/case-pages.js
и обновляет блоки между маркерами <!-- GEN:... --> в index.html, cases-target.html,
cases-context.html (meta-теги, разметка, списки ссылок на статьи).

Источник правды — data/cases.json. Править тексты кейсов там, потом пересобрать.
Адрес сайта — data/site.json (site_url). Сменили домен → поправить и пересобрать.
"""
import html
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = json.loads((ROOT / "data/site.json").read_text(encoding="utf-8"))
CASES = json.loads((ROOT / "data/cases.json").read_text(encoding="utf-8"))
TAX = json.loads((ROOT / "data/taxonomy.json").read_text(encoding="utf-8"))
SERVICES = json.loads((ROOT / "data/services.json").read_text(encoding="utf-8"))
BASE = SITE["site_url"].rstrip("/")
CONTENT_DATE = SITE["content_updated_at"]
MIN_CASES_FOR_HUB = 2

ORG = {
    "@type": "ProfessionalService",
    "@id": BASE + "/#org",
    "name": "ProDigital",
    "url": BASE + "/",
    "logo": BASE + "/assets/prodigital-logo-wordmark.png",
    "description": "Маркетинговое агентство Катерины Анисимовой: контекстная и таргетированная реклама, "
                   "сайты, воронки, чат-боты, AI-автоматизации и маркетинговая стратегия.",
    "founder": {"@id": BASE + "/#katerina"},
    "areaServed": ["Россия", "СНГ", "Европа", "ОАЭ", "Индонезия", "США"],
    "sameAs": ["https://t.me/ka_anisimova"],
}
PERSON = {
    "@type": "Person",
    "@id": BASE + "/#katerina",
    "name": "Катерина Анисимова",
    "jobTitle": "Интернет-маркетолог, основатель ProDigital",
    "worksFor": {"@id": BASE + "/#org"},
    "sameAs": ["https://t.me/ka_anisimova"],
}


def e(s):
    return html.escape(str(s or ""), quote=True)


def url(path):
    return BASE + "/" + re.sub(r"(^|/)index\.html(?=$|[?#])", r"\1", path.lstrip("/"))


def jsonld(*items):
    graph = {"@context": "https://schema.org", "@graph": list(items)}
    return '<script type="application/ld+json">' + json.dumps(graph, ensure_ascii=False) + "</script>"


def breadcrumbs(items):
    return {
        "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": i + 1, "name": n, "item": url(p)} for i, (n, p) in enumerate(items)
        ],
    }


DEFAULT_CTA = ("Нужны клиенты для вашего бизнеса?", "Расскажите о проекте — предложим модель продвижения под ваш продукт, рынок и бюджет.")


def clean_home_links(text):
    """Один адрес у каталога: / вместо /index.html, старые файлы остаются доступны."""
    def replace(match):
        target = match.group(2)
        if re.match(r"(?:[a-z]+:)?//", target):
            return match.group(0)
        target = re.sub(r"(^|/)index\.html(?=$|[?#])", r"\1", target)
        if not target or target.startswith("#"):
            target = "./" + target
        return match.group(1) + target + match.group(3)
    return re.sub(r'(href=["\'])([^"\']*index\.html(?:[?#][^"\']*)?)(["\'])', replace, text)


def page(path, title, description, body, ld, og_image="assets/prodigital-logo-wordmark.png", cta=DEFAULT_CTA):
    depth = path.count("/")
    pre = "../" * depth
    canonical = url(path.replace("index.html", ""))
    return clean_home_links(f"""<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>{e(title)}</title>
  <meta name="description" content="{e(description)}">
  <link rel="canonical" href="{canonical}">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="ProDigital">
  <meta property="og:title" content="{e(title)}">
  <meta property="og:description" content="{e(description)}">
  <meta property="og:url" content="{canonical}">
  <meta property="og:image" content="{url(og_image)}">
  <meta property="og:locale" content="ru_RU">
  <link rel="icon" href="{pre}favicon.ico" sizes="any">
  <link rel="icon" type="image/png" href="{pre}assets/favicon-32.png" sizes="32x32">
  <link rel="apple-touch-icon" href="{pre}assets/apple-touch-icon.png">
  <meta name="theme-color" content="#080806">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@1,500;1,600&family=Inter:wght@400;500;600;700&family=Manrope:wght@600;700;800&display=swap">
  <link rel="stylesheet" href="{pre}style.css">
  {ld}
</head>
<body class="article-page">
<header class="site-header">
  <div class="container header-inner">
    <a class="brand" href="{pre}index.html"><img src="{pre}assets/prodigital-logo-wordmark.png" alt="ProDigital"></a>
    <nav class="nav">
      <a href="{pre}index.html#services">Услуги</a>
      <a href="{pre}uslugi/ai-avtomatizacii-i-agenty/">AI-агенты</a>
      <div class="nav-dropdown">
        <a class="nav-dropdown-trigger" href="{pre}keysy/">Кейсы</a>
        <div class="nav-dropdown-menu">
          <a href="{pre}keysy/">Все кейсы</a>
          <a href="{pre}cases-context.html">Контекстная реклама</a>
          <a href="{pre}cases-target.html">Таргетированная реклама</a>
        </div>
      </div>
      <a href="{pre}index.html#contact">Контакты</a>
    </nav>
    <div class="header-actions">
      <a class="btn btn-ghost" href="https://t.me/ka_anisimova" target="_blank" rel="noopener">Написать в Telegram</a>
      <a class="btn btn-primary" href="{pre}index.html#contact">Получить стратегию продвижения</a>
      <button class="mobile-toggle" type="button" data-mobile-toggle aria-label="Открыть меню">☰</button>
    </div>
  </div>
  <div id="mobileMenu" class="container"></div>
</header>
<main class="article-main">
{body}
<section class="article-cta">
  <div class="container article-narrow">
    <h2>{e(cta[0])}</h2>
    <p>{e(cta[1])}</p>
    <div class="article-cta-actions">
      <a class="btn btn-primary" href="{pre}index.html#contact">Обсудить проект</a>
      <a class="btn btn-ghost" href="https://t.me/ka_anisimova" target="_blank" rel="noopener">Написать в Telegram</a>
    </div>
  </div>
</section>
</main>
<footer class="footer">
  <div class="container footer-inner">
    <div class="footer-copy">
      <div>© ProDigital · Катерина Анисимова</div>
      <div>ИП Анисимова Катерина Андреевна</div>
      <div>ИНН 770306774140 · ОГРН 324774600695123</div>
    </div>
    <div class="footer-right">
      <div>Контекст · таргет · сайты · чат-боты · аналитика</div>
      <div class="footer-contacts">
        <a href="https://t.me/ka_anisimova" target="_blank" rel="noopener">Написать в Telegram</a>
        <a href="{pre}index.html#contact">Заполнить бриф</a>
      </div>
      <div class="footer-disclaimer">* Meta и её продукты Instagram, Facebook признаны экстремистскими организациями и запрещены на территории РФ.</div>
    </div>
  </div>
</footer>
<script src="{pre}script.js"></script>
</body>
</html>
""")


def platform(case):
    for s in case["stats"]:
        if "платформ" in s["label"]:
            return s["value"]
    return ""


def meta_note(text):
    """Пометка про Meta для РФ, как на основных страницах сайта."""
    return re.sub(r"\b(Meta|Instagram|Facebook)\b(?!\*)", r"\1*", text)


def case_card(c, pre):
    stat = next((s["value"] for s in c["stats"] if "цена" in s["label"] or "результат" in s["label"]), "")
    cover = (f'<span class="case-cover"><img src="{pre}{c["img"]}" alt="{e(c["title"])}" loading="lazy"></span>'
             if c.get("img") else "")
    return f"""<a class="article-card" href="{pre}keysy/{c['slug']}/">
  {cover}
  <span class="article-card-meta">{e(c['year'])} · {e(meta_note(platform(c)))}</span>
  <strong>{e(c['title'])}</strong>
  <span class="article-card-text">{e(c['summary'])}</span>
  {f'<span class="kpi-row"><span class="kpi-pill">{e(stat)}</span></span>' if stat else ''}
  <span class="case-open-btn">Читать кейс</span>
</a>"""


def illustration(name, pre, alt):
    """Иллюстрация страницы: assets/illustrations/<name>.png (или .jpg/.webp), если файл добавлен."""
    for ext in ("png", "jpg", "webp"):
        if (ROOT / f"assets/illustrations/{name}.{ext}").exists():
            return (f'<figure class="article-cover"><img src="{pre}assets/illustrations/{name}.{ext}" '
                    f'alt="{e(alt)}"></figure>')
    return ""


def related(c, limit=3):
    def score(o):
        return 2 * len(set(o["niches"]) & set(c["niches"])) + len(set(o["countries"]) & set(c["countries"])) \
               + (1 if o["service"] == c["service"] else 0)
    others = sorted((o for o in CASES if o["id"] != c["id"]), key=score, reverse=True)
    return [o for o in others if score(o) > 0][:limit]


def hubs(kind):
    out = {}
    for c in CASES:
        for k in c[kind]:
            out.setdefault(k, []).append(c)
    return {k: v for k, v in out.items() if len(v) >= MIN_CASES_FOR_HUB}


NICHE_HUBS = hubs("niches")
COUNTRY_HUBS = hubs("countries")


def build_case(c):
    path = f"keysy/{c['slug']}/index.html"
    pre = "../../"
    service_name, service_page = TAX["services"][c["service"]]
    title = f"{c['title']}: кейс {service_name.lower()} | ProDigital"
    description = c["summary"][:155]
    stats = "".join(f'<div class="case-stat-box"><span>{e(s["label"])}</span><strong>{e(meta_note(s["value"]))}</strong></div>'
                    for s in c["stats"])
    done = "".join(f"<li>{e(d)}</li>" for d in c["done"])
    insights = "".join(f"<li>{e(i)}</li>" for i in c.get("insights") or [])
    tags = []
    for n in c["niches"]:
        if n in NICHE_HUBS:
            tags.append(f'<a href="{pre}nishi/{n}/">{e(TAX["niches"][n][0])}</a>')
    for k in c["countries"]:
        if k in COUNTRY_HUBS:
            tags.append(f'<a href="{pre}strany/{k}/">{e(TAX["countries"][k][0])}</a>')
    tags.append(f'<a href="{pre}{service_page}">{e(service_name)}</a>')
    rel = related(c)
    body = f"""<article>
<section class="article-hero">
  <div class="container article-narrow">
    <nav class="article-crumbs"><a href="{pre}index.html">Главная</a> / <a href="{pre}keysy/">Кейсы</a> / <span>{e(c['title'])}</span></nav>
    <div class="eyebrow">{e(c['year'])}</div>
    <h1>{e(c['title'])}</h1>
    <p class="article-lead">{e(meta_note(c['summary']))}</p>
    {f'<figure class="article-cover"><img src="{pre}{c["img"]}" alt="{e(c["title"])}"></figure>' if c.get("img") else ''}
    <div class="case-stats-row article-stats">{stats}</div>
    <div class="article-tags">{''.join(tags)}</div>
  </div>
</section>
<section class="article-body">
  <div class="container article-narrow">
    <h2>Задача</h2>
    <p>{e(meta_note(c['task']))}</p>
    <h2>Что сделали</h2>
    <ol class="article-steps">{done}</ol>
    <h2>Результат</h2>
    <p>{e(meta_note(c['result']))}</p>
    {f'<h2>Что важно знать о нише</h2><ul>{insights}</ul>' if insights else ''}
    <p class="article-author">Автор кейса — <a href="{pre}index.html">Катерина Анисимова</a>, ProDigital. Обновлено: {CONTENT_DATE}.</p>
  </div>
</section>
{f'''<section class="article-related"><div class="container article-narrow"><h2>Похожие кейсы</h2><div class="article-grid">{"".join(case_card(o, pre) for o in rel)}</div></div></section>''' if rel else ''}
</article>"""
    ld = jsonld(
        ORG, PERSON,
        {"@type": "Article", "headline": c["title"], "description": c["summary"], "inLanguage": "ru",
         "author": {"@id": BASE + "/#katerina"}, "publisher": {"@id": BASE + "/#org"},
         "dateModified": CONTENT_DATE, "mainEntityOfPage": url(f"keysy/{c['slug']}/"),
         **({"image": url(c["img"])} if c.get("img") else {})},
        breadcrumbs([("Главная", ""), ("Кейсы", "keysy/"), (c["title"], f"keysy/{c['slug']}/")]),
    )
    return path, page(path, title, description, body, ld, og_image=c.get("img") or "assets/prodigital-logo-wordmark.png")


def build_list(path, crumbs, eyebrow, h1, lead, cases, extra_ld=None):
    ill_name = path.replace("/index.html", "").replace("/", "-")
    depth = path.count("/")
    pre = "../" * depth
    crumbs_html = " / ".join(
        [f'<a href="{pre}{p}">{e(n)}</a>' if i < len(crumbs) - 1 else f"<span>{e(n)}</span>" for i, (n, p) in enumerate(crumbs)]
    )
    cards = "".join(case_card(c, pre) for c in cases)
    body = f"""<section class="article-hero">
  <div class="container article-narrow">
    <nav class="article-crumbs">{crumbs_html}</nav>
    <div class="eyebrow">{e(eyebrow)}</div>
    <h1>{e(h1)}</h1>
    <p class="article-lead">{e(lead)}</p>
    {illustration(ill_name, pre, h1)}
  </div>
</section>
<section class="article-related"><div class="container article-narrow"><div class="article-grid">{cards}</div></div></section>"""
    items = [{"@type": "ListItem", "position": i + 1, "url": url(f"keysy/{c['slug']}/"), "name": c["title"]}
             for i, c in enumerate(cases)]
    ld = jsonld(ORG, breadcrumbs([(n, p) for n, p in crumbs]),
                {"@type": "CollectionPage", "name": h1, "description": lead, "url": url(path.replace("index.html", "")),
                 "mainEntity": {"@type": "ItemList", "itemListElement": items}}, *(extra_ld or []))
    return path, page(path, f"{h1} | ProDigital", lead[:155], body, ld)


def build_service(svc):
    path = f"uslugi/{svc['slug']}/index.html"
    pre = "../../"
    parts = []
    for sec in svc["sections"]:
        parts.append(f"<h2>{e(sec['h2'])}</h2>")
        for para in sec.get("paragraphs", []):
            parts.append(f"<p>{e(para)}</p>")
        if sec.get("items"):
            tag = "ol" if sec["h2"].startswith("Как мы работаем") else "ul"
            cls = ' class="article-steps"' if tag == "ol" else ""
            parts.append(f"<{tag}{cls}>" + "".join(f"<li>{e(i)}</li>" for i in sec["items"]) + f"</{tag}>")
        if sec.get("case_link"):
            parts.append(f'<p><a href="{pre}{sec["case_link"]}">{e(sec["case_link_text"])}</a></p>')
    tool = ""
    if svc.get("tool"):
        t = svc["tool"]
        tool = (f'<div class="article-tool"><a class="btn btn-primary" href="{pre}{t["href"]}">{e(t["text"])}</a>'
                f'<span>{e(t["note"])}</span></div>')
    body = f"""<section class="article-hero">
  <div class="container article-narrow">
    <nav class="article-crumbs"><a href="{pre}index.html">Главная</a> / <a href="{pre}index.html#services">Услуги</a> / <span>{e(svc['title'])}</span></nav>
    <div class="eyebrow">{e(svc['eyebrow'])}</div>
    <h1>{e(svc['title'])}</h1>
    <p class="article-lead">{e(svc['lead'])}</p>
    {illustration("uslugi-" + svc["slug"], pre, svc["title"])}
    {tool}
  </div>
</section>
<section class="article-body"><div class="container article-narrow">
{''.join(parts)}

</div></section>"""
    ld = jsonld(ORG, PERSON,
                {"@type": "Service", "name": svc["title"], "description": svc["description"], "provider": {"@id": BASE + "/#org"},
                 "url": url(f"uslugi/{svc['slug']}/"), "areaServed": ORG["areaServed"], "inLanguage": "ru"},
                breadcrumbs([("Главная", ""), ("Услуги", "index.html#services"), (svc["title"], f"uslugi/{svc['slug']}/")]))
    cta = tuple(svc["cta"]) if svc.get("cta") else DEFAULT_CTA
    return path, page(path, svc["meta_title"], svc["description"][:155], body, ld, cta=cta)


def hub_lead(kind, key, cases):
    name, intro = TAX[kind][key]
    platforms = sorted({meta_note(platform(c)) for c in cases if platform(c)})
    return (f"{intro} {len(cases)} кейса(ов) ProDigital с цифрами: площадки — {', '.join(platforms)}."
            if intro else f"{len(cases)} кейса(ов) ProDigital: {', '.join(platforms)}.")


def replace_block(text, name, content):
    start, end = f"<!-- GEN:{name}:START -->", f"<!-- GEN:{name}:END -->"
    block = f"{start}\n{content}\n{end}"
    if start in text:
        return re.sub(re.escape(start) + r".*?" + re.escape(end), lambda _: block, text, flags=re.S)
    return None


def update_static_pages(pages_built):
    def head_block(path, title, desc):
        canonical = url("" if path == "index.html" else path)
        ld = jsonld(ORG, PERSON) if path == "index.html" else jsonld(ORG)
        return (f'<link rel="canonical" href="{canonical}">\n'
                f'  <meta property="og:type" content="website">\n  <meta property="og:site_name" content="ProDigital">\n'
                f'  <meta property="og:title" content="{e(title)}">\n  <meta property="og:description" content="{e(desc)}">\n'
                f'  <meta property="og:url" content="{canonical}">\n'
                f'  <meta property="og:image" content="{url("assets/prodigital-logo-wordmark.png")}">\n  {ld}')

    for path, service in [("index.html", None), ("cases-target.html", "targetirovannaya-reklama"),
                          ("cases-context.html", "kontekstnaya-reklama"), ("career/index.html", None),
                          ("claude-guide.html", None), ("ai-diagnostika/index.html", None)]:
        p = ROOT / path
        s = p.read_text(encoding="utf-8")
        title = re.search(r"<title>(.*?)</title>", s, re.S).group(1).strip()
        desc = re.search(r'name="description" content="(.*?)"', s).group(1)
        hb = head_block(path, html.unescape(title), html.unescape(desc))
        if "<!-- GEN:HEAD:START -->" not in s:
            s = re.sub(r'<link\b[^>]*rel=["\']canonical["\'][^>]*>\s*', '', s)
            s = re.sub(r'<meta\b[^>]*property=["\']og:[^"\']+["\'][^>]*>\s*', '', s)
        new = replace_block(s, "HEAD", hb)
        s = new if new is not None else s.replace("</head>", f"  <!-- GEN:HEAD:START -->\n  {hb}\n  <!-- GEN:HEAD:END -->\n</head>", 1)
        if service:
            block = ('<section class="case-articles"><div class="container case-articles-cta">'
                     '<a class="btn btn-ghost" href="keysy/">Все кейсы ProDigital →</a></div></section>')
            new = replace_block(s, "CASE-LINKS", block)
            s = new if new is not None else s.replace('<footer class="footer">',
                                                      f"<!-- GEN:CASE-LINKS:START -->\n{block}\n<!-- GEN:CASE-LINKS:END -->\n\n<footer class=\"footer\">", 1)
            if 'src="assets/case-pages.js"' not in s:
                s = s.replace('<script src="script.js"></script>', '<script src="assets/case-pages.js"></script>\n<script src="script.js"></script>', 1)
        p.write_text(clean_home_links(s), encoding="utf-8")


def main():
    built = []
    for c in CASES:
        built.append(build_case(c))
    built.append(build_list("keysy/index.html", [("Главная", "index.html"), ("Кейсы", "keysy/")], "Кейсы",
                            "Кейсы ProDigital: реклама с цифрами",
                            f"{len(CASES)} кейсов по таргетированной и контекстной рекламе: релокация и ВНЖ, недвижимость, "
                            "образование, медицина, e-commerce, B2B — в России, ОАЭ, на Бали, в Европе, Казахстане и США.",
                            CASES))
    for k, cases in NICHE_HUBS.items():
        name = TAX["niches"][k][0]
        built.append(build_list(f"nishi/{k}/index.html", [("Главная", "index.html"), ("Кейсы", "keysy/"), (name, f"nishi/{k}/")],
                                "Ниша", f"Реклама в нише «{name}»: кейсы", hub_lead("niches", k, cases), cases))
    for k, cases in COUNTRY_HUBS.items():
        name = TAX["countries"][k][0]
        built.append(build_list(f"strany/{k}/index.html", [("Главная", "index.html"), ("Кейсы", "keysy/"), (name, f"strany/{k}/")],
                                "Страна и регион", f"Реклама в регионе «{name}»: кейсы", hub_lead("countries", k, cases), cases))
    for svc in SERVICES:
        built.append(build_service(svc))
    for path, content in built:
        out = ROOT / path
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(content, encoding="utf-8")

    (ROOT / "assets/case-pages.js").write_text(
        "window.CASE_PAGES = " + json.dumps({c["id"]: f"keysy/{c['slug']}/" for c in CASES}, ensure_ascii=False) + ";\n",
        encoding="utf-8")
    update_static_pages(built)

    # Страницы, которые не собираются генератором, но должны быть в карте сайта
    static_pages = ["ai-diagnostika/", "career/", "claude-guide.html"]
    urls = ["", "cases-target.html", "cases-context.html"] + static_pages + [p.replace("index.html", "") for p, _ in built]
    sitemap = "\n".join(f"  <url><loc>{url(u)}</loc></url>" for u in urls)
    (ROOT / "sitemap.xml").write_text(
        f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n{sitemap}\n</urlset>\n',
        encoding="utf-8")
    (ROOT / "robots.txt").write_text(
        "# Поисковики и AI-ассистенты (GPTBot, OAI-SearchBot, PerplexityBot, ClaudeBot, Google-Extended, YandexBot) не закрыты намеренно.\n"
        f"User-agent: *\nAllow: /\n\nSitemap: {url('sitemap.xml')}\n", encoding="utf-8")
    not_found = ROOT / "404.html"
    text = not_found.read_text(encoding="utf-8")
    text = re.sub(r'<base\b[^>]*>\s*', '', text)
    if '<meta name="robots"' not in text:
        text = text.replace('</head>', '<meta name="robots" content="noindex, follow">\n</head>')
    text = text.replace('<head>', f'<head>\n  <base href="{e(BASE)}/">', 1)
    not_found.write_text(clean_home_links(text), encoding="utf-8")
    # Keep previously shared project URLs working after the branded site is live.
    redirect_script = """(() => {
  const base = __BASE__;
  const oldOrigin = 'https://anisimovkat-hub.github.io';
  const oldPrefix = '/prodigital-agency-site/';
  if (location.origin !== oldOrigin || !location.pathname.startsWith(oldPrefix)) return;
  if (base === oldOrigin + oldPrefix.slice(0, -1)) return;
  const path = location.pathname.slice(oldPrefix.length).replace(/(^|\\/)index\\.html$/, '$1');
  location.replace(base + '/' + path + location.search + location.hash);
})();
""".replace('__BASE__', json.dumps(BASE))
    (ROOT / 'assets/site-address.js').write_text(redirect_script, encoding='utf-8')
    for html_path in ROOT.rglob('*.html'):
        if '.git' in html_path.parts:
            continue
        content = html_path.read_text(encoding='utf-8')
        if 'assets/site-address.js' in content:
            continue
        pre = '../' * (len(html_path.relative_to(ROOT).parts) - 1)
        content = content.replace('</head>', f'<script src="{pre}assets/site-address.js"></script>\n</head>', 1)
        html_path.write_text(content, encoding='utf-8')
    print(f"Собрано страниц: {len(built)}; хабы ниш: {sorted(NICHE_HUBS)}; хабы стран: {sorted(COUNTRY_HUBS)}")


if __name__ == "__main__":
    main()
