"""
Builds the small static fonts embedded in the PDF export.

    python -m pip install --user fonttools brotli   # once; dev-time only
    python scripts/build-pdf-fonts.py               # from the repo root

Output goes to src/assets/pdf-fonts/ and is committed, so the site build never needs Python.
Re-run this script (and commit the result) after upgrading @fontsource-variable/geist or
@fontsource-variable/eczar, or changing CHARSET below. The output is deterministic: running it
twice gives identical bytes.

Why this exists: jsPDF's built-in fonts have no rupee sign, and it can only embed static TrueType
files. The site already ships Geist (text) and Eczar (headlines) as variable woff2, so we cut
static instances from them at the site's weights and keep only the characters the report can
print. The rupee sign lives in Fontsource's latin-ext files, so it is grafted onto the latin ones.
jsPDF applies no OpenType features either, so Geist's tabular figures (the site sets every amount
with `tabular-nums`) are baked into the character map: columns of rupees line up digit for digit.

Licence: Geist and Eczar are under the SIL Open Font License 1.1, which allows subsetting and
embedding. Neither declares a Reserved Font Name, but the subsets are still renamed ("InHand Report
Sans", "InHand Report Display") so they are never mistaken for the full families, and both licence
texts are copied next to them.

The social cards (src/lib/og.ts) read the same files.
"""

from __future__ import annotations

import copy
import json
from io import BytesIO
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = Path(__file__).resolve().parent.parent
PACKAGES = ROOT / "node_modules" / "@fontsource-variable"
OUT = ROOT / "src" / "assets" / "pdf-fonts"

SOURCES = {
    "geist": {"name": "Geist", "licence": "OFL-Geist.txt"},
    "eczar": {"name": "Eczar", "licence": "OFL-Eczar.txt"},
}

# Weights match the site: Geist body text at 400, emphasis and figures at 600 (font-semibold),
# Eczar headlines at 700 (.display).
FONTS = [
    {"file": "report-sans-text", "source": "geist", "wght": 400, "family": "InHand Report Sans",
     "style": "Text", "freeze": ["tnum"]},
    {"file": "report-sans-medium", "source": "geist", "wght": 600, "family": "InHand Report Sans",
     "style": "Medium", "freeze": ["tnum"]},
    {"file": "report-display", "source": "eczar", "wght": 700, "family": "InHand Report Display",
     "style": "Bold", "freeze": []},
]

# Everything the report can print. The PDF code replaces any other character before drawing,
# because jsPDF silently truncates a string at the first character the font cannot map.
CHARSET = (
    [chr(c) for c in range(0x20, 0x7F)]  # Basic Latin
    + [
        chr(0x00A0),  # no-break space (by code: editors turn the literal into a plain space)
        "·",  # middle dot, for inline separators
        chr(0x2009),  # thin space
        "–",  # en dash
        "—",  # em dash
        "‘",  # left single quote
        "’",  # right single quote / apostrophe
        "“",  # left double quote
        "”",  # right double quote
        "•",  # bullet
        "…",  # ellipsis
        "−",  # minus sign, for deductions
        "₹",  # rupee sign
    ]
)
RUPEE = 0x20B9
THIN_SPACE = 0x2009


def instance(source: str, script: str, wght: int) -> TTFont:
    font = TTFont(PACKAGES / source / "files" / f"{source}-{script}-wght-normal.woff2")
    return instancer.instantiateVariableFont(font, {"wght": wght}, inplace=False)


def graft_rupee(target: TTFont, donor: TTFont) -> None:
    """Copies the rupee glyph (a simple outline, no components) from the latin-ext instance."""
    name = donor.getBestCmap()[RUPEE]
    glyph = donor["glyf"][name]
    if glyph.isComposite():
        raise SystemExit("The rupee glyph is a composite; graft its components too.")
    order = target.getGlyphOrder()
    if name not in order:
        target.setGlyphOrder(order + [name])
    target["glyf"][name] = copy.deepcopy(glyph)
    target["hmtx"][name] = donor["hmtx"][name]
    for table in target["cmap"].tables:
        if table.isUnicode():
            table.cmap[RUPEE] = name


def ensure_thin_space(font: TTFont) -> None:
    """Geist has no thin space (U+2009); adds one as an empty glyph a fifth of an em wide."""
    cmap = font.getBestCmap()
    if THIN_SPACE in cmap:
        return
    name = "uni2009"
    font.setGlyphOrder(font.getGlyphOrder() + [name])
    font["glyf"][name] = copy.deepcopy(font["glyf"][cmap[0x20]])
    font["hmtx"][name] = (round(font["head"].unitsPerEm / 5), 0)
    for table in font["cmap"].tables:
        if table.isUnicode():
            table.cmap[THIN_SPACE] = name


def freeze(font: TTFont, tags: list[str]) -> None:
    """Applies single-substitution features (tnum, say) to the character map itself."""
    if not tags:
        return
    gsub = font["GSUB"].table
    mapping: dict[str, str] = {}
    for record in gsub.FeatureList.FeatureRecord:
        if record.FeatureTag not in tags:
            continue
        for index in record.Feature.LookupListIndex:
            lookup = gsub.LookupList.Lookup[index]
            for table in lookup.SubTable:
                if lookup.LookupType == 7:  # extension: the real subtable is wrapped
                    table = table.ExtSubTable
                if getattr(table, "mapping", None) is None:
                    raise SystemExit(f"{record.FeatureTag} is not a single substitution")
                mapping.update(table.mapping)
    if not mapping:
        raise SystemExit(f"None of {tags} found")
    for table in font["cmap"].tables:
        if table.isUnicode():
            table.cmap = {code: mapping.get(glyph, glyph) for code, glyph in table.cmap.items()}


def rename(font: TTFont, family: str, style: str, source: str) -> None:
    """Gives the subset its own name while keeping the copyright and licence records."""
    name = font["name"]
    copyright_ = name.getDebugName(0)
    version = name.getDebugName(5)
    postscript = f"{family.replace(' ', '')}-{style}"
    records = {
        0: copyright_,
        1: family,
        2: "Regular",
        3: f"{postscript};{version}",
        4: f"{family} {style}",
        5: version,
        6: postscript,
        13: (
            "This Font Software is licensed under the SIL Open Font License, Version 1.1. "
            f"Modified from {SOURCES[source]['name']}: instanced, subset and renamed."
        ),
        14: "https://openfontlicense.org",
    }
    name.names = []
    for name_id, value in records.items():
        name.setName(value, name_id, 3, 1, 0x409)


def build(spec: dict) -> Path:
    source, wght = spec["source"], spec["wght"]
    font = instance(source, "latin", wght)
    graft_rupee(font, instance(source, "latin-ext", wght))
    ensure_thin_space(font)
    freeze(font, spec["freeze"])

    options = subset.Options()
    options.layout_features = []  # jsPDF applies no OpenType features, so GSUB/GPOS are dead weight
    options.hinting = False  # PDF viewers render outlines unhinted anyway
    options.glyph_names = False
    options.name_IDs = ["*"]  # rename() below decides which records survive
    options.notdef_outline = True
    options.recalc_timestamp = False
    options.drop_tables += ["STAT", "MVAR", "HVAR", "gasp", "DSIG", "GDEF", "GPOS", "GSUB"]
    subsetter = subset.Subsetter(options)
    subsetter.populate(unicodes=[ord(c) for c in CHARSET])
    subsetter.subset(font)

    rename(font, spec["family"], spec["style"], source)
    font["OS/2"].usWeightClass = wght
    # Keep the source's own timestamp, so the output is byte-for-byte reproducible.
    font.recalcTimestamp = False
    font["head"].modified = font["head"].created

    missing = [c for c in CHARSET if ord(c) not in font.getBestCmap()]
    if missing:
        raise SystemExit(f"{spec['file']}: no glyph for {[hex(ord(c)) for c in missing]}")

    # The source is woff2 and fontTools keeps that flavour on save; jsPDF reads only plain TrueType.
    font.flavor = None
    target = OUT / f"{spec['file']}.ttf"
    buffer = BytesIO()
    font.save(buffer, reorderTables=True)
    target.write_bytes(buffer.getvalue())
    return target


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    total = 0
    for spec in FONTS:
        path = build(spec)
        size = path.stat().st_size
        total += size
        print(f"{path.relative_to(ROOT)}  {size / 1024:.1f} KB")

    # The PDF code reads this to decide which characters it may draw.
    charset = OUT / "charset.json"
    payload = json.dumps({"chars": "".join(CHARSET)}, ensure_ascii=False) + "\n"
    charset.write_text(payload, encoding="utf-8", newline="\n")
    for source, meta in SOURCES.items():
        licence = (PACKAGES / source / "LICENSE").read_text(encoding="utf-8")
        (OUT / meta["licence"]).write_text(licence, encoding="utf-8", newline="\n")
    print(f"total {total / 1024:.1f} KB, {len(CHARSET)} characters")


if __name__ == "__main__":
    main()
