# Variants

## Make something swappable

```tsx
import { variant } from "stageboard/react"
function HeroImpl(props: HeroProps) { /* … */ }
export const Hero = variant("landing.hero", HeroImpl)
```

For inline JSX, use `<Variant id="landing.cta">…</Variant>`. Ids are stable and dotted: `<area>.<thing>`. Production always renders the original.

## A variant file

One file per alternative, next to the original, named `<component>.<slug>.variant.tsx`. The key is the file name without `.variant.tsx`.

```tsx
export const variant = {
  of: "landing.hero",
  label: "Calm",
  description: "One sentence on what is different and why.",
  job: "<job id, when you were asked for this by a stageboard request>",
}
export default function HeroCalm(props: HeroProps) { /* self-contained, same props */ }
```

- Keep the same props and data contract, so a variant can replace the original anywhere.
- Never edit the original or `stageboard.variants.ts`; the registry regenerates itself.
- Variants must be real alternatives, not tweaks. Two or three distinct directions beat five near-copies.

## Handling an annotation request

The prompt has a marked region, a cropped screenshot path, the components under it, reference image paths, and maybe the variant the user was looking at.
1. Open the crop and every reference image first.
2. If a variant was in view, compare it with its siblings (`compare_variants`, or one `shot` per variant) before deciding.
3. **Variants requested:** create N new files that build on what the user pointed at.
4. **Edit requested on a variant:** change that variant's file only.
5. **Edit on the original:** change the component in place.
6. Shoot every result at desktop and mobile width (`--width 390`) and fix anything broken.
7. Finish with one line per change.

## Adopting a variant

Port the variant's implementation into the original component, keep the `variant()` boundary and its id, then delete that variant file.
