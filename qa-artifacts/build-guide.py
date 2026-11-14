"""Build the self-contained "How to use Serumpun" HTML slide deck.

Reads the full-page screen captures in qa-artifacts/guide-screens/, downsizes them to
slide-friendly JPEGs, embeds them as data URIs, and writes ONE portable HTML file.

Usage (from the project root):  python qa-artifacts/build-guide.py
"""
from __future__ import annotations

import base64
import html
import io
import shutil
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SHOTS = ROOT / "qa-artifacts" / "guide-screens"
OUT = ROOT / "guide" / "how-to-use.html"
PUBLIC = ROOT / "public" / "guide.html"
SITE = "https://aarfanayub.github.io/serumpun/"
REPO = "https://github.com/AArfanAyub/serumpun"
RELEASES = f"{REPO}/releases/latest"

# --------------------------------------------------------------------------- slide copy
STEPS = [
    dict(
        img="00-welcome.png", cap="S0 · Welcome screen",
        title="Open the website",
        lead="Open the address on any phone or computer. There is nothing to install and nothing to sign up for.",
        points=[
            "Tap <b>Find my field</b> to start with a real place.",
            "Tap <b>Use a sample field (offline)</b> for a complete demo with no internet at all.",
            "The <b>ID / EN</b> button in the header switches between Bahasa Indonesia and English.",
            "Add it to your home screen from your browser menu — it keeps working offline afterwards.",
        ],
        tip="Everything here is free: no account, no ads, no tracking, no payment tier.",
    ),
    dict(
        img="01-find-field.png", cap="S1 · Find your field",
        title="Tell it where your field is",
        lead="There are four ways to set a location — use whichever works on your phone.",
        points=[
            "Search a <b>village or town</b> name, then pick a result and confirm with <b>Use this location</b>.",
            "<b>Use my location</b> asks your phone for GPS.",
            "Drop a <b>pin on the map</b>, or type <b>latitude and longitude</b> by hand.",
            "<b>Use a sample field</b> loads bundled Central Java data with zero network.",
        ],
        tip="No signal, or just looking around? The sample field still produces the full recommendation, rotation and strategy comparison.",
    ),
    dict(
        img="02-snapshot.png", cap="S2 · Your field snapshot",
        title="Check the field snapshot",
        lead="Before recommending anything, Serumpun shows what the data says about the area around your field.",
        points=[
            "The KPI strip shows <b>temperature, rain this month, soil wetness and elevation</b>, each with its source.",
            "Charts show the <b>long-term monthly climate</b> and the <b>next 16 days</b> of forecast.",
            "A map shows the field with OpenStreetMap tiles and an optional NASA true-colour satellite layer.",
            "Use <b>What if I plant in a different month?</b> to re-score for another planting month.",
        ],
        tip="These are regional estimates from grids and models, not measurements taken at your field.",
    ),
    dict(
        img="03-profile-soil.png", cap="S3 · Step 1 of 3 · Soil",
        title="Describe your field · soil",
        lead="Three short steps about your own plot. Step 1 asks about the soil.",
        points=[
            "Choose <b>Sandy, Loam, Clay or Peaty</b> — a one-line hint explains each.",
            "Add a <b>soil pH</b> between 4.0 and 9.0 if you know it; leave it blank otherwise.",
            "<b>I don't know</b> is always an acceptable answer.",
            "If a soil service pre-fills a value, it is clearly labelled <b>estimated</b> — please check it.",
        ],
        tip="Your answers are labelled self-reported. Nothing is silently presented as a measurement.",
    ),
    dict(
        img="04-profile-water.png", cap="S3 · Step 2 of 3 · Water &amp; terrain",
        title="Describe your field · water &amp; terrain",
        lead="Step 2 captures the conditions that change how much water a crop really needs.",
        points=[
            "<b>Can you water the field?</b> — none, partial or reliable irrigation.",
            "<b>Is the field sloped?</b> — flat, gentle or steep, which affects erosion risk.",
            "How much <b>shade</b> the plot gets.",
            "What <b>surrounds</b> it — forest, water, buildings or nothing in particular.",
        ],
        tip="These feed the water-fit, terrain/erosion and surroundings factors in the score.",
    ),
    dict(
        img="05-profile-history.png", cap="S3 · Step 3 of 3 · History &amp; size",
        title="Describe your field · history &amp; size",
        lead="Step 3 is about what happened on this plot before, which drives the rotation advice.",
        points=[
            "<b>What grew here last season?</b> — pick a crop, or <b>Nothing / unknown</b>.",
            "Set your <b>priorities</b> and an optional <b>field size</b> in hectares.",
            "If the previous crop is unknown, the app assumes a neutral starting crop and says so.",
            "Finish with <b>See recommended crops</b>.",
        ],
        tip="Nothing here is mandatory. The app degrades honestly instead of blocking you.",
    ),
    dict(
        img="06-recommendations.png", cap="S4 · Recommendations",
        title="Read your crop recommendations",
        lead="Serumpun ranks 3–5 crops for this place and this month, with a score you can interrogate.",
        points=[
            "Each card shows a <b>0–100 score</b>, a verdict, a planting-window chip and a confidence level.",
            "Tap a card to see <b>why</b> it scored that way.",
            "Use the <b>month chips</b> at the top to ask “what if I plant later?”",
            "Open <b>Scoring method</b> to see all seven factor weights, or <b>Download field card</b> to keep a copy.",
        ],
        tip="Confidence is separate from the score. Low confidence means the data is thin — not that the crop is bad.",
    ),
    dict(
        img="07-why.png", cap="S5 · Why this crop?",
        title="Understand why a crop scored that way",
        lead="Every point of the score is broken down into named, weighted factors.",
        points=[
            "Seven factors: <b>temperature, water, soil, season, terrain, surroundings and rotation continuity</b>.",
            "Each factor carries its <b>source, freshness and an estimated flag</b>.",
            "You also get <b>things to watch</b>, water need, typical days to harvest, difficulty and the planting window.",
            "Continue with <b>See 3-season rotation plan</b>.",
        ],
        tip="Every number on this screen traces back to a named, keyless data source.",
    ),
    dict(
        img="08-rotation.png", cap="S6 · Three-season rotation plan",
        title="Plan the next three seasons",
        lead="One recommendation is only the start. Serumpun builds a sequence that keeps the soil healthy.",
        points=[
            "<b>Season 1</b> is what to plant now; <b>Seasons 2 and 3</b> are what to plant next.",
            "The sequence avoids the same <b>plant family</b>, sequences <b>nitrogen roles</b>, alternates <b>root depth</b> and breaks <b>disease cycles</b>.",
            "<b>Why this change</b> explains every transition, with a climate-fit note for that month.",
            "Continue to <b>Compare rotation strategies</b>.",
        ],
        tip="Seasons 2 and 3 are tentative — check real conditions again before planting.",
    ),
    dict(
        img="09-strategies.png", cap="S6B · Compare rotation strategies",
        title="Compare at least three strategies",
        lead="Instead of one answer, you get several comparable options — including the rotation you already use.",
        points=[
            "The table compares <b>soil health, water demand, nitrogen balance, bare-field weeks and rule violations</b>.",
            "Your <b>current rotation</b> is always included as a baseline, not as a recommendation.",
            "Each strategy lists <b>supporting evidence, benefits, information gaps and risks needing local review</b>.",
            "Open <b>View this 3-season plan</b> to inspect the sequence behind a row.",
        ],
        tip="On a phone, scroll the comparison table sideways to see every column.",
    ),
    dict(
        img="10-data-sources.png", cap="S7 · Data &amp; sources",
        title="Check where every number came from",
        lead="The last screen is the audit trail for the whole app.",
        points=[
            "A table lists every allowlisted host with its <b>licence, status, freshness and contribution</b>.",
            "The <b>scoring method</b> and the crop database are documented in plain language.",
            "Datasets that need an account or key are credited as <b>inspiration only</b> — they are never called.",
            "<b>Refresh data</b> retries the sources; <b>Start over</b> clears the session.",
        ],
        tip="Only eight keyless hosts can ever be contacted. No API keys, no accounts, no telemetry.",
    ),
]

TEMPLATE = r"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="theme-color" content="#FAF7F0" />
<meta name="description" content="A visual, step-by-step guide to using Serumpun — free crop recommendations and three-season rotation planning for smallholder farmers." />
<title>How to use Serumpun — visual guide</title>
<style>
  :root{
    --bg:#FAF7F0; --surface:#FFFFFF; --ink:#1F2A21; --muted:#66706A; --line:#E4DECE;
    --green:#2E6B4F; --green-dark:#1E5038; --green-soft:#E9F2E8;
    --amber-soft:#FFF4DC; --amber:#8A5D12; --shadow:0 18px 46px rgba(31,42,33,.13);
  }
  *{box-sizing:border-box}
  html,body{margin:0;min-height:100%}
  body{background:var(--bg);color:var(--ink);font:17px/1.62 system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;-webkit-font-smoothing:antialiased}
  a{color:var(--green-dark)}
  .deck{min-height:100vh;display:flex;flex-direction:column}
  .topbar{position:sticky;top:0;z-index:20;display:flex;align-items:center;justify-content:space-between;gap:16px;
    padding:12px clamp(16px,4vw,48px);border-bottom:1px solid var(--line);background:rgba(250,247,240,.94);backdrop-filter:blur(10px)}
  .brand{display:flex;align-items:center;gap:10px;font-weight:750;letter-spacing:-.01em}
  .brand .mark{font-size:22px;line-height:1}
  .brand .sep{width:1px;height:20px;background:var(--line)}
  .brand .sub{font-weight:600;color:var(--muted);font-size:14px}
  .topright{display:flex;align-items:center;gap:18px}
  .topright a{font-size:14px;font-weight:650;text-decoration:none;border-bottom:1px solid currentColor}
  .counter{font-size:13px;color:var(--muted);font-variant-numeric:tabular-nums;white-space:nowrap}
  .counter b{color:var(--ink);font-size:16px}
  .progress{height:3px;background:var(--line)}
  .progress span{display:block;height:100%;background:var(--green);transition:width .25s ease}
  main{flex:1;display:flex;align-items:center;justify-content:center;padding:clamp(18px,3vw,34px) clamp(16px,4vw,48px)}
  .slide{display:none;width:100%;max-width:1240px}
  .slide.is-active{display:grid;grid-template-columns:minmax(0,1fr) minmax(300px,420px);gap:clamp(24px,4vw,64px);align-items:center}
  .slide--center.is-active{display:flex;flex-direction:column;justify-content:center;text-align:center;max-width:860px}
  .eyebrow{font-size:12px;font-weight:750;letter-spacing:.14em;text-transform:uppercase;color:var(--green);margin:0 0 14px}
  h1{font-size:clamp(30px,4.2vw,50px);line-height:1.12;letter-spacing:-.03em;margin:0 0 18px}
  h2{font-size:clamp(26px,3.2vw,38px);line-height:1.16;letter-spacing:-.02em;margin:0 0 16px}
  .lead{font-size:clamp(17px,1.55vw,20px);color:#3D4A40;margin:0 0 22px;max-width:62ch}
  .points{list-style:none;margin:0;padding:0;display:grid;gap:13px}
  .points li{position:relative;padding-left:28px;font-size:16px;color:#354137}
  .points li::before{content:"";position:absolute;left:4px;top:10px;width:9px;height:9px;border-radius:50%;background:var(--green)}
  .points b{color:var(--ink)}
  .tip{margin-top:24px;padding:14px 18px;background:var(--amber-soft);border-left:4px solid #E0A93B;border-radius:0 10px 10px 0;font-size:15px;color:#5E4517}
  .tip strong{color:var(--amber)}
  .visual{display:flex;flex-direction:column;align-items:center;min-width:0}
  .phone{width:100%;max-width:390px;height:min(64vh,640px);overflow-y:auto;overflow-x:hidden;background:#fff;
    border:7px solid #20342A;border-radius:26px;box-shadow:var(--shadow);scrollbar-width:thin;scrollbar-color:#BFCBBF transparent}
  .phone img{display:block;width:100%;height:auto}
  .cap{margin:12px 0 0;font-size:13px;color:var(--muted);text-align:center}
  .scrollhint{font-size:12px;color:var(--muted);margin:4px 0 0}
  .cover-badges{display:flex;flex-wrap:wrap;gap:9px;justify-content:center;margin:0 0 30px}
  .badge2{padding:7px 14px;border-radius:999px;background:var(--green-soft);color:var(--green-dark);font-size:13px;font-weight:650;border:1px solid #D4E5D2}
  .cta-row{display:flex;flex-wrap:wrap;gap:12px;justify-content:center;margin-top:8px}
  .btn{cursor:pointer;font:inherit;font-weight:700;font-size:15px;padding:13px 24px;border-radius:12px;border:1px solid transparent;min-height:48px}
  .btn--primary{background:var(--green);color:#fff}
  .btn--primary:hover{background:var(--green-dark)}
  .btn--ghost{background:transparent;color:var(--green-dark);border-color:#B9CDBB}
  .btn:disabled{opacity:.42;cursor:not-allowed}
  .cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(215px,1fr));gap:14px;width:100%;margin:22px 0 26px;text-align:left}
  .card2{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:16px 18px}
  .card2 h3{margin:0 0 6px;font-size:15px;color:var(--green-dark)}
  .card2 p{margin:0;font-size:14px;color:var(--muted);line-height:1.5}
  .card2 a{font-weight:650;font-size:14px}
  .controls{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:13px clamp(16px,4vw,48px);
    border-top:1px solid var(--line);background:var(--surface)}
  .dots{display:flex;gap:6px;flex-wrap:wrap;justify-content:center}
  .dot{width:9px;height:9px;border:0;padding:0;border-radius:50%;background:#CFD8CD;cursor:pointer;transition:all .2s}
  .dot.is-active{width:26px;border-radius:6px;background:var(--green)}
  .kbd{font-size:12px;color:var(--muted);white-space:nowrap}
  @media (max-width:920px){
    .slide.is-active{grid-template-columns:1fr;gap:20px}
    .visual{order:-1}
    .phone{height:min(42vh,420px);max-width:300px}
    .points li{font-size:15px}
    h1{font-size:30px}
    .kbd{display:none}
  }
  @media (max-width:560px){
    .brand .sub,.topright a{display:none}
    .phone{height:min(38vh,340px);max-width:250px}
    .tip{margin-top:16px}
  }
  @page{size:A4;margin:12mm}
  @media print{
    .topbar,.progress,.controls{display:none}
    main{display:block;padding:0}
    .slide,.slide.is-active,.slide--center.is-active{display:block!important;page-break-after:always;width:100%;margin:0;padding:0;box-sizing:border-box}
    .slide--cols{display:flex!important;flex-direction:row;align-items:flex-start;gap:16px}
    .slide .copy{flex:1 1 49%;min-width:0}
    .slide .visual{flex:1 1 50%;min-width:0;margin:0}
    .slide h2{font-size:19px;line-height:1.2;margin:0 0 6px}
    .slide p{font-size:12.5px;line-height:1.4;margin:0 0 6px}
    .slide ul{margin:4px 0;padding-left:18px}
    .slide li{font-size:12.5px;line-height:1.4;margin:0 0 3px}
    .phone{height:auto;max-height:none;border:0;border-radius:0;box-shadow:none;overflow:visible;margin:0 auto;max-width:320px}
    .phone img{width:auto;height:auto;max-width:320px;max-height:560px;display:block;margin:0 auto}
    .cap,.scrollhint{text-align:center;font-size:11.5px;margin:4px 0 0}
  }
</style>
</head>
<body>
<div class="deck">
  <header class="topbar">
    <div class="brand"><span class="mark" aria-hidden="true">🌱</span><span>Serumpun</span><span class="sep"></span><span class="sub">How to use</span></div>
    <div class="topright">
      <a href="@@SITE@@" target="_blank" rel="noreferrer noopener">Open the live app ↗</a>
      <span class="counter" aria-live="polite"><b id="cur">1</b> / <span id="total">@@TOTAL@@</span></span>
    </div>
  </header>
  <div class="progress"><span id="bar"></span></div>

  <main id="stage">
@@SLIDES@@
  </main>

  <footer class="controls">
    <button class="btn btn--ghost" id="prev" type="button">← Previous</button>
    <div class="dots" id="dots" role="tablist" aria-label="Slides">@@DOTS@@</div>
    <span class="kbd">← → keys · swipe on touch</span>
    <button class="btn btn--primary" id="next" type="button">Next →</button>
  </footer>
</div>
<script>
(function(){
  var slides = Array.prototype.slice.call(document.querySelectorAll('.slide'));
  var dots = Array.prototype.slice.call(document.querySelectorAll('.dot'));
  var prev = document.getElementById('prev');
  var next = document.getElementById('next');
  var cur = document.getElementById('cur');
  var bar = document.getElementById('bar');
  var stage = document.getElementById('stage');
  var i = 0;

  function go(n, updateHash){
    i = Math.max(0, Math.min(slides.length - 1, n));
    slides.forEach(function(s,k){ s.classList.toggle('is-active', k === i); });
    dots.forEach(function(d,k){
      d.classList.toggle('is-active', k === i);
      d.setAttribute('aria-selected', k === i ? 'true' : 'false');
    });
    cur.textContent = String(i + 1);
    bar.style.width = ((i + 1) / slides.length * 100) + '%';
    prev.disabled = i === 0;
    next.textContent = i === slides.length - 1 ? 'Start again ↺' : 'Next →';
    document.title = (i === 0 ? 'How to use Serumpun' : (i + 1) + '. ' + (slides[i].dataset.title || 'Guide')) + ' — visual guide';
    var phone = slides[i].querySelector('.phone');
    if (phone) phone.scrollTop = 0;
    window.scrollTo(0, 0);
    if (updateHash !== false) history.replaceState(null, '', '#slide-' + (i + 1));
  }

  prev.addEventListener('click', function(){ go(i - 1); });
  next.addEventListener('click', function(){ go(i === slides.length - 1 ? 0 : i + 1); });
  dots.forEach(function(d,k){ d.addEventListener('click', function(){ go(k); }); });

  document.addEventListener('keydown', function(e){
    if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); go(i + 1); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); go(i - 1); }
    else if (e.key === 'Home') { e.preventDefault(); go(0); }
    else if (e.key === 'End') { e.preventDefault(); go(slides.length - 1); }
  });

  var sx = 0;
  stage.addEventListener('touchstart', function(e){ sx = e.touches[0].clientX; }, {passive:true});
  stage.addEventListener('touchend', function(e){
    var dx = e.changedTouches[0].clientX - sx;
    if (Math.abs(dx) > 60) go(i + (dx < 0 ? 1 : -1));
  }, {passive:true});

  var start = parseInt((location.hash.match(/slide-(\d+)/) || [])[1] || '1', 10);
  go(Number.isFinite(start) ? start - 1 : 0, false);
})();
</script>
</body>
</html>
"""


def img_data_uri(name: str) -> str:
    src = SHOTS / name
    if not src.exists():
        raise SystemExit(f"missing screenshot: {src}")
    im = Image.open(src).convert("RGB")
    w, h = im.size
    target_w = 520
    im = im.resize((target_w, round(h * target_w / w)), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=81, optimize=True, progressive=True)
    raw = buf.getvalue()
    print(f"  {name:26} {len(raw)//1024:>4} KB embedded")
    return "data:image/jpeg;base64," + base64.b64encode(raw).decode("ascii")


def li(text: str) -> str:
    return f"<li>{text}</li>"  # copy is authored, not user input


def cover() -> str:
    return """<section class="slide slide--center" data-title="Introduction">
  <p class="eyebrow">A visual walk-through · 11 screens</p>
  <h1>How to use Serumpun</h1>
  <p class="lead">From opening the page to comparing three-season rotation strategies.
  One screen at a time, with a picture of exactly what you will see.</p>
  <div class="cover-badges">
    <span class="badge2">Free, forever</span><span class="badge2">No account</span>
    <span class="badge2">No ads or tracking</span><span class="badge2">Works offline</span>
    <span class="badge2">English + Bahasa Indonesia</span>
  </div>
  <div class="cta-row">
    <button class="btn btn--primary" type="button" onclick="document.getElementById('next').click()">Start the walkthrough →</button>
    <a class="btn btn--ghost" href="@@SITE@@" target="_blank" rel="noreferrer noopener">Open the live app ↗</a>
    <a class="btn btn--ghost" href="how-to-use.pdf" download="Serumpun-how-to-use.pdf" target="_blank" rel="noreferrer noopener">Download PDF ↧</a>
  </div>
  <p class="cap">Use the ← → arrow keys, the buttons below, or swipe on a touch screen.</p>
</section>""".replace("@@SITE@@", SITE)


def step_slide(n: int, s: dict) -> str:
    points = "\n".join(li(p) for p in s["points"])
    return f"""<section class="slide slide--cols" data-title="{html.escape(s['title'], quote=True)}">
  <div class="copy">
    <p class="eyebrow">Step {n} of {len(STEPS)}</p>
    <h2>{s['title']}</h2>
    <p class="lead">{s['lead']}</p>
    <ul class="points">
{points}
    </ul>
    <p class="tip"><strong>Good to know · </strong>{s['tip']}</p>
  </div>
  <figure class="visual" style="margin:0">
    <div class="phone"><img src="{img_data_uri(s['img'])}" alt="Serumpun screen: {html.escape(s['title'], quote=True)}" loading="lazy" /></div>
    <figcaption class="cap">{s['cap']}</figcaption>
    <p class="scrollhint">Scroll inside the phone to see the whole screen ↓</p>
  </figure>
</section>"""


def finish() -> str:
    return """<section class="slide slide--center" data-title="Quick reference">
  <p class="eyebrow">You are ready</p>
  <h2>Quick reference &amp; useful links</h2>
  <p class="lead">Keep this page handy. Everything below is free and needs no account.</p>
  <div class="cards">
    <div class="card2"><h3>Use it on the web</h3><p><a href="@@SITE@@" target="_blank" rel="noreferrer noopener">Open Serumpun ↗</a><br />Works on any phone; installable to the home screen.</p></div>
    <div class="card2"><h3>Windows desktop</h3><p><a href="@@RELEASES@@" target="_blank" rel="noreferrer noopener">Download the portable .exe ↗</a><br />Single file, no installation. SmartScreen may warn once.</p></div>
    <div class="card2"><h3>Source code</h3><p><a href="@@REPO@@" target="_blank" rel="noreferrer noopener">GitHub repository ↗</a><br />MIT licensed, eight keyless data hosts, no secrets.</p></div>
    <div class="card2"><h3>No internet?</h3><p>Tap <b>Use a sample field (offline)</b>. Bundled data produces the full recommendation, rotation and strategy comparison.</p></div>
    <div class="card2"><h3>Language</h3><p>The <b>ID / EN</b> button in the header switches language instantly, at any point in the flow.</p></div>
    <div class="card2"><h3>One important caveat</h3><p>This is decision support based on regional climate data, not agronomic advice for your field. Check with a local extension officer before committing your season.</p></div>
  </div>
  <div class="cta-row">
    <a class="btn btn--primary" href="@@SITE@@" target="_blank" rel="noreferrer noopener">Open Serumpun ↗</a>
    <button class="btn btn--ghost" type="button" onclick="document.querySelector('.dot').click()">Start this guide again ↺</button>
    <a class="btn btn--ghost" href="how-to-use.pdf" download="Serumpun-how-to-use.pdf" target="_blank" rel="noreferrer noopener">Download this guide (PDF) ↧</a>
  </div>
</section>""".replace("@@SITE@@", SITE).replace("@@RELEASES@@", RELEASES).replace("@@REPO@@", REPO)


def main() -> None:
    print("Embedding screenshots:")
    slides = [cover()] + [step_slide(n, s) for n, s in enumerate(STEPS, 1)] + [finish()]
    dots = "\n".join(
        f'<button class="dot" type="button" role="tab" aria-label="Go to slide {k + 1}" aria-selected="false"></button>'
        for k in range(len(slides))
    )
    out = (
        TEMPLATE.replace("@@SITE@@", SITE)
        .replace("@@TOTAL@@", str(len(slides)))
        .replace("@@SLIDES@@", "\n".join(slides))
        .replace("@@DOTS@@", dots)
    )
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(out, encoding="utf-8")
    PUBLIC.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(OUT, PUBLIC)
    print(f"\nWrote {OUT} ({len(out.encode('utf-8')) // 1024} KB)")
    print(f"Copied to {PUBLIC} so it is deployed with the site as guide.html")
    print(f"Slides: {len(slides)} (cover + {len(STEPS)} steps + quick reference)")


if __name__ == "__main__":
    main()
