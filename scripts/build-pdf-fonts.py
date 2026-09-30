"""
Builds the small static fonts embedded in the PDF export.

    python -m pip install --user fonttools brotli   # once; dev-time only
    python scripts/build-pdf-fonts.py               # from the repo root

Output goes to src/assets/pdf-fonts/ and is committed, so the site build never needs Python.
Re-run this script (and commit the result) after upgrading @fontsource-variable/ibm-plex-sans or
changing CHARSET below. The output is deterministic: running it twice gives identical bytes.

Why this exists: jsPDF's built-in fonts have no rupee sign, and it can only embed static TrueType
files. The site already ships IBM Plex Sans as a variable woff2, so we cut two static instances
from it (the site's body and emphasis weights) and keep only the characters the report can print.
The rupee sign lives in Fontsource's latin-ext file, so it is grafted onto the latin instance.

Licence: IBM Plex is under the SIL Open Font License 1.1, which allows subsetting and embedding.
Upstream declares "Plex" a Reserved Font Name, so the subsets are renamed ("InHand Report Sans")
as the OFL requires of modified versions, and the licence text is copied next to them.
"""

from __future__ import annotations

import copy
import json
import shutil
from io import BytesIO
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "node_modules" / "@fontsource-variable" / "ibm-plex-sans"
LATIN = SOURCE / "files" / "ibm-plex-sans-latin-standard-normal.woff2"
LATIN_EXT = SOURCE / "files" / "ibm-plex-sans-latin-ext-standard-normal.woff2"
OUT = ROOT / "src" / "assets" / "pdf-fonts"

FAMILY = "InHand Report Sans"
POSTSCRIPT_FAMILY = "InHandReportSans"

# Weights match the site: body text at 435, headings and figures at 535. Never heavier.
INSTANCES = {
    "text": {"wght": 435, "style": "Text"},
    "medium": {"wght": 535, "style": "Medium"},
}

# Everything the report can print. The PDF code replaces any other character before drawing,
# because jsPDF silently truncates a string at the first character the font cannot map.
CHARSET = (
    [chr(c) for c in range(0x20, 0x7F)]  # Basic Latin
    + [
        " ",  # no-break space
        "·",  # middle dot, for inline separators
        " ",  # thin space
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
RUPEE = "uni20B9"


def instance(path: Path, wght: int) -> TTFont:
    font = TTFont(path)
    return instancer.instantiateVariableFont(font, {"wght": wght, "wdth": 100}, inplace=False)


def graft_rupee(target: TTFont, donor: TTFont) -> None:
    """Copies the rupee glyph (a simple outline, no components) from the latin-ext instance."""
    glyph = donor["glyf"][RUPEE]
    if glyph.isComposite():
        raise SystemExit("The rupee glyph became a composite; graft its components too.")
    order = target.getGlyphOrder()
    if RUPEE not in order:
        target.setGlyphOrder(order + [RUPEE])
    target["glyf"][RUPEE] = copy.deepcopy(glyph)
    target["hmtx"][RUPEE] = donor["hmtx"][RUPEE]
    for table in target["cmap"].tables:
        if table.isUnicode():
            table.cmap[0x20B9] = RUPEE


def rename(font: TTFont, style: str) -> None:
    """Replaces the Reserved Font Name while keeping the copyright and licence records."""
    name = font["name"]
    copyright_ = name.getDebugName(0)
    version = name.getDebugName(5)
    postscript = f"{POSTSCRIPT_FAMILY}-{style}"
    records = {
        0: copyright_,
        1: FAMILY,
        2: "Regular",
        3: f"{postscript};{version}",
        4: f"{FAMILY} {style}",
        5: version,
        6: postscript,
        13: (
            "This Font Software is licensed under the SIL Open Font License, Version 1.1. "
            "Modified from IBM Plex Sans (Copyright 2019 IBM Corp.): instanced, subset and renamed."
        ),
        14: "https://openfontlicense.org",
    }
    name.names = []
    for name_id, value in records.items():
        name.setName(value, name_id, 3, 1, 0x409)


def build(key: str, wght: int, style: str) -> Path:
    latin = instance(LATIN, wght)
    graft_rupee(latin, instance(LATIN_EXT, wght))

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
    subsetter.subset(latin)

    rename(latin, style)
    latin["OS/2"].usWeightClass = wght
    # Keep the source's own timestamp, so the output is byte-for-byte reproducible.
    latin.recalcTimestamp = False
    latin["head"].modified = latin["head"].created

    missing = [c for c in CHARSET if ord(c) not in latin.getBestCmap()]
    if missing:
        raise SystemExit(f"{style}: no glyph for {[hex(ord(c)) for c in missing]}")

    # The source is woff2 and fontTools keeps that flavour on save; jsPDF reads only plain TrueType.
    latin.flavor = None
    target = OUT / f"report-sans-{key}.ttf"
    buffer = BytesIO()
    latin.save(buffer, reorderTables=True)
    target.write_bytes(buffer.getvalue())
    return target


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    total = 0
    for key, spec in INSTANCES.items():
        path = build(key, spec["wght"], spec["style"])
        size = path.stat().st_size
        total += size
        print(f"{path.relative_to(ROOT)}  {size / 1024:.1f} KB")

    # The PDF code reads this to decide which characters it may draw.
    charset = OUT / "charset.json"
    payload = json.dumps({"chars": "".join(CHARSET)}, ensure_ascii=False) + "\n"
    charset.write_text(payload, encoding="utf-8", newline="\n")
    shutil.copyfile(SOURCE / "LICENSE", OUT / "OFL.txt")
    print(f"total {total / 1024:.1f} KB, {len(CHARSET)} characters")


if __name__ == "__main__":
    main()
