# Image optimisation

Every photo the requirement portal renders ships as a responsive
WebP + JPEG ladder. The renderer (`src/components/ResponsiveImage.tsx`) emits a
`<picture>` element so browsers that support WebP fetch the smaller WebP file,
while the `<img>` keeps a JPEG `srcset` as the universal fallback.

## Regenerating the variants

```bash
python3 scripts/optimize_images.py
```

Requires Pillow (`python3 -c "import PIL"`). The script is idempotent: running
it twice produces byte-identical output.

It does four things:

1. Parses `src/pages/requirementSchema.ts` and works out which
   `/req-images/*` references the renderer actually shows — question-level
   `image:` fields always, option-level `image:` fields only for
   `imagechoice` questions.
2. Moves never-rendered option images into `assets-unrendered/` so they stop
   shipping to the CDN while the schema data stays intact.
3. Writes the per-photo variants (see below).
4. Writes the manifest `src/data/reqImageVariants.ts`.

## The width ladder

Target widths are **400 / 800 / 1200**, never upscaling past the source width.
A photo narrower than a target simply does not get that rung.

| Format | Quality | Notes |
| --- | --- | --- |
| WebP | 78, method 6 | primary format, served via `<source type="image/webp">` |
| JPEG | 80, progressive, optimised, 4:2:0 | fallback, served via the `<img srcset>` |

File naming:

- `<name>-<width>.webp` — WebP candidate for every ladder width, including the
  native width.
- `<name>-<width>.jpg` — JPEG candidate for every width **below** native.
- `<name>.jpg` — the native-width JPEG. This is the untouched original path, so
  every URL that already worked keeps working. It is the final JPEG candidate
  in the `srcset` and the `src` of the `<img>`.

## The manifest is generated — do not hand-edit it

`src/data/reqImageVariants.ts` is written by `scripts/optimize_images.py`. It
starts with an `AUTO-GENERATED` banner. Editing it by hand will be silently
overwritten on the next run, and a wrong entry makes the browser request a
file that does not exist.

Each entry maps a schema image path to its intrinsic dimensions and the
candidate widths that exist on disk:

```ts
'/req-images/v2x.jpg': { width: 1200, height: 675, widths: [400, 800, 1200] },
```

`ResponsiveImage` looks the path up in the manifest. **If the path is not in
the manifest it falls back to a plain `<img src=...>`** — no `srcset`, no
`<picture>`, no broken URLs.

## Explicit dimensions prevent layout shift

Every `<img>` gets `width` and `height` set to the manifest's intrinsic pixel
size. The browser uses those to reserve the box before the bytes arrive, so
the page does not shift as images load (no CLS). `loading="lazy"` and
`decoding="async"` are also set.

The `sizes` attribute tells the browser how wide the image renders, so it can
pick the right candidate. It is derived from the real container, not guessed:

- Question photos render inside a `max-w-4xl` (896px) container with `px-4`,
  a question card padded `p-5 sm:p-6` and indented `sm:pl-9`, inside a 1px
  bordered wrapper. Measured rendered width: **776px at a 1280px viewport**,
  **314px at a 390px viewport**.
- `imagechoice` option thumbnails render one per column of a `sm:grid-cols-2`
  grid, so roughly half that width.

If the layout changes, re-measure and update `PHOTO_SIZES` / `THUMB_SIZES` in
`src/components/ResponsiveImage.tsx`.

## `assets-unrendered/` — assets the renderer does not show

`assets-unrendered/` holds photos that are referenced by the schema but are
**never rendered**. Currently these five are option images of `radio`
questions, whose renderer draws text-only `OptionChip`s and never fetches an
option image:

- `battery-fixed.jpg` (option of `batteryType`)
- `delivery-exw.jpg`, `delivery-fob.jpg`, `delivery-fca.jpg`, `delivery-ddp.jpg`
  (options of `deliveryBasis`)

They live outside `public/` so they are not deployed. The schema still holds
the references, and each one carries a comment saying so.

**Rule: if a renderer change makes one of these visible, move it back to
`public/req-images/` before shipping.** The `imagechoice` branch does render
option images — if any of these five questions ever becomes an `imagechoice`
question, the file must go back to `public/req-images/`, get a variant ladder
from `scripts/optimize_images.py`, and end up in the manifest. Otherwise the
browser requests a URL that returns 404.

`scripts/optimize_images.py` performs the move automatically, driven by the
question `type` in the schema, so the fix is usually just to change the type
and re-run the script.

## Verifying after a change

```bash
# every candidate the renderer would emit exists on disk
python3 - <<'PY'
import pathlib, re
root = pathlib.Path('.')
man = (root / 'src/data/reqImageVariants.ts').read_text()
missing = 0
total = 0
for path, w, h, widths in re.findall(
    r"'(/req-images/[^']+)':\s*\{\s*width:\s*(\d+),\s*height:\s*(\d+),\s*widths:\s*\[([\d, ]+)\]",
    man,
):
    widths = [int(x) for x in widths.split(',')]
    base = path.rsplit('.', 1)[0]
    cands = [f'{base}-{x}.webp' for x in widths]
    cands += [f'{base}-{x}.jpg' for x in widths if x < int(w)]
    cands += [path.rsplit('/', 1)[1]]
    for c in cands:
        total += 1
        if not (root / 'public' / c.lstrip('/')).exists():
            missing += 1
            print('MISSING', c)
print(f'{total} candidates checked, {missing} missing')
PY
```
