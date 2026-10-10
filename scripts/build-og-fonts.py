"""
Static Eczar Bold for the social cards (src/lib/og.ts).

satori reads TTF/OTF/WOFF but not WOFF2, and wants one weight per file, so this pins the
variable Eczar files from @fontsource-variable/eczar at weight 700 and saves them as TTF. Latin and
Latin Extended stay separate files (the rupee sign lives in Latin Extended); og.ts loads both.

Run from the project root:  python scripts/build-og-fonts.py
"""

from pathlib import Path

from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

SOURCE = Path('node_modules/@fontsource-variable/eczar/files')
OUT = Path('src/assets/og-fonts')
OUT.mkdir(parents=True, exist_ok=True)

for subset in ('latin', 'latin-ext'):
    font = TTFont(SOURCE / f'eczar-{subset}-wght-normal.woff2')
    static = instancer.instantiateVariableFont(font, {'wght': 700})
    static.flavor = None
    target = OUT / f'eczar-700-{subset}.ttf'
    static.save(target)
    print(target, target.stat().st_size)
