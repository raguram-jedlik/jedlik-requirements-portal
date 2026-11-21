#!/usr/bin/env python3
"""Generate responsive WebP/JPEG variants for the requirement portal photos.

Run from the repo root:

    python3 scripts/optimize_images.py

What it does
------------
1. Parses ``src/pages/requirementSchema.ts`` and works out which
   ``/req-images/*`` references the renderer actually shows:
     - question level ``image:``  -> rendered by ``QuestionImage``
     - option level   ``image:``  -> rendered ONLY for ``imagechoice``
       questions. ``radio``/``select`` render a text-only ``OptionChip``,
       so their option images are never fetched by the browser.
2. Moves the never-rendered option images out of ``public/`` into
   ``assets-unrendered/`` so they stop shipping to the CDN while the schema
   data stays intact.
3. Deletes dead assets: files in ``public/req-images`` that are byte identical
   duplicates of an asset we keep.
4. Writes, for every rendered photo:
     ``public/req-images/<name>-<w>.webp``  WebP, quality 78, method 6
     ``public/req-images/<name>-<w>.jpg``   JPEG, quality 80, progressive
   for the target widths 400 / 800 / 1200, never upscaling beyond the source
   width.  The native width JPEG stays at its original path (``<name>.jpg``)
   so every URL that already works keeps working; the native width WebP is
   ``<name>-<w>.webp``.
5. Writes ``src/data/reqImageVariants.ts``: the manifest the React renderer
   uses to emit ``<picture>`` / ``srcset`` / ``sizes`` / ``width`` / ``height``.

Pillow is the only dependency (system python3).
"""
from __future__ import annotations

import hashlib
import re
import shutil
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
SCHEMA = ROOT / "src" / "pages" / "requirementSchema.ts"
IMG_DIR = ROOT / "public" / "req-images"
UNRENDERED_DIR = ROOT / "assets-unrendered"
MANIFEST = ROOT / "src" / "data" / "reqImageVariants.ts"

TARGET_WIDTHS = (400, 800, 1200)
WEBP_QUALITY = 78
JPEG_QUALITY = 80


def parse_schema(text: str) -> list[dict]:
    """Return the questions in requirementSchema.ts with their images."""
    questions: list[dict] = []
    cur: dict | None = None
    for line in text.splitlines():
        m = re.match(r"^    id: '([^']+)'", line)
        if m:
            cur = {"id": m.group(1), "type": None, "image": None, "option_images": []}
            questions.append(cur)
            continue
        m = re.match(r"^    type: '([^']+)'", line)
        if m and cur:
            cur["type"] = m.group(1)
            continue
        m = re.match(r"^    image: '(/req-images/[^']+)'", line)
        if m and cur:
            cur["image"] = m.group(1)
            continue
        m = re.match(r"^        image: '(/req-images/[^']+)'", line)
        if m and cur:
            cur["option_images"].append(m.group(1))
            continue
    return questions


def md5(path: Path) -> str:
    return hashlib.md5(path.read_bytes()).hexdigest()


def main() -> int:
    questions = parse_schema(SCHEMA.read_text())

    schema_refs: set[str] = set()
    rendered: list[str] = []
    for q in questions:
        if q["image"]:
            schema_refs.add(q["image"])
            rendered.append(q["image"])
        for opt in q["option_images"]:
            schema_refs.add(opt)
            if q["type"] == "imagechoice":
                rendered.append(opt)
    rendered = sorted(set(rendered))
    unrendered = sorted(schema_refs - set(rendered))

    IMG_DIR.mkdir(parents=True, exist_ok=True)
    present = sorted(p for p in IMG_DIR.iterdir() if p.is_file())
    by_name = {p.name: p for p in present}

    # ---- 1. never-rendered option images -> assets-unrendered/ -------------
    UNRENDERED_DIR.mkdir(parents=True, exist_ok=True)
    moved: list[tuple[str, str]] = []
    for ref in unrendered:
        name = Path(ref).name
        src = IMG_DIR / name
        dst = UNRENDERED_DIR / name
        if src.exists():
            shutil.move(str(src), str(dst))
            moved.append((name, "moved to assets-unrendered/"))
        elif dst.exists():
            moved.append((name, "already in assets-unrendered/"))

    # ---- 2. dead assets (not referenced by the schema at all) -------------
    removed: list[tuple[str, str]] = []
    keep_md5 = {md5(UNRENDERED_DIR / Path(r).name) for r in unrendered if (UNRENDERED_DIR / Path(r).name).exists()}
    for p in present:
        if p.name in {Path(r).name for r in rendered}:
            continue
        if (UNRENDERED_DIR / p.name).exists():
            continue
        digest = md5(p)
        if digest in keep_md5:
            p.unlink()
            removed.append((p.name, "deleted (byte-identical duplicate)"))
        else:
            shutil.move(str(p), str(UNRENDERED_DIR / p.name))
            removed.append((p.name, "moved to assets-unrendered/ (unreferenced)"))

    # ---- 3. generate the variants -----------------------------------------
    manifest: dict[str, dict] = {}
    expected: set[str] = set()
    rows: list[tuple[str, int, int, list[int], int, int]] = []
    for ref in rendered:
        name = Path(ref).stem
        source = IMG_DIR / f"{name}.jpg"
        if not source.exists():
            print(f"ERROR: missing source {source}", file=__import__("sys").stderr)
            return 1
        with Image.open(source) as im:
            im = ImageOps.exif_transpose(im).convert("RGB")
            native_w, native_h = im.size
        widths = sorted({w for w in TARGET_WIDTHS if w <= native_w} | {native_w})
        jpeg_total = 0
        webp_total = 0
        for tw in widths:
            th = max(1, round(native_h * tw / native_w))
            with Image.open(source) as im:
                im = ImageOps.exif_transpose(im).convert("RGB")
                resized = im if tw == native_w else im.resize((tw, th), Image.LANCZOS)
                webp_path = IMG_DIR / f"{name}-{tw}.webp"
                resized.save(webp_path, "WEBP", quality=WEBP_QUALITY, method=6)
                expected.add(webp_path.name)
                webp_total += webp_path.stat().st_size
                if tw < native_w:
                    jpg_path = IMG_DIR / f"{name}-{tw}.jpg"
                    resized.save(
                        jpg_path, "JPEG", quality=JPEG_QUALITY,
                        optimize=True, progressive=True, subsampling=2,
                    )
                    expected.add(jpg_path.name)
                    jpeg_total += jpg_path.stat().st_size
        manifest[ref] = {"width": native_w, "height": native_h, "widths": widths}
        rows.append((name, native_w, native_h, widths, jpeg_total, webp_total))

    # ---- 4. drop stale generated files ------------------------------------
    stale = [
        p.name for p in IMG_DIR.iterdir()
        if p.is_file() and re.match(r"^.+-\d+\.(jpg|webp)$", p.name) and p.name not in expected
    ]
    for s in stale:
        (IMG_DIR / s).unlink()

    # ---- 5. write the manifest --------------------------------------------
    MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    out = [
        "// AUTO-GENERATED by scripts/optimize_images.py - do not edit by hand.",
        "//",
        "// Responsive variants for every photo the requirement portal renders.",
        "// width/height: intrinsic pixel size of the source photo.",
        "// widths: candidate widths available for that photo, ascending.",
        "",
        "export interface ReqImageVariant {",
        "  width: number;",
        "  height: number;",
        "  widths: number[];",
        "}",
        "",
        "export const REQ_IMAGE_VARIANTS: Record<string, ReqImageVariant> = {",
    ]
    for ref in sorted(manifest):
        m = manifest[ref]
        out.append(
            f"  '{ref}': {{ width: {m['width']}, height: {m['height']}, "
            f"widths: [{', '.join(str(w) for w in m['widths'])}] }},"
        )
    out.append("};")
    MANIFEST.write_text("\n".join(out) + "\n")

    # ---- 6. report --------------------------------------------------------
    print(f"rendered photos : {len(rendered)}")
    print(f"schema refs     : {len(schema_refs)}")
    print(f"moved out       : {len(moved)}")
    for name, why in moved:
        print(f"   {name:24s} {why}")
    print(f"dead assets     : {len(removed)}")
    for name, why in removed:
        print(f"   {name:24s} {why}")
    if stale:
        print(f"stale variants removed: {len(stale)}")
    print()
    print(f"{'photo':22s} {'source':>11s} {'widths':>22s} {'jpeg ladder':>12s} {'webp ladder':>12s}")
    for name, w, h, widths, jt, wt in rows:
        print(f"{name:22s} {f'{w}x{h}':>11s} {str(widths):>22s} {jt:>12d} {wt:>12d}")
    total = sum(f.stat().st_size for f in IMG_DIR.iterdir() if f.is_file())
    print()
    print(f"public/req-images total : {total} bytes ({len(list(IMG_DIR.iterdir()))} files)")
    print(f"manifest                : {MANIFEST.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
