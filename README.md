# Cookie Run combi codes

A Cookie Run combi stores a cookie, relay, pet, and treasure, but nothing else — the run type, episode, boosts, and cookie power+ selections live only in your head. The combi name is 10 characters, which is enough room to carry all of it.

The full configuration space is 6 types x 12 episodes x 8 boost subsets x 12 random-boost choices x 128 cookie-power+ subsets x 2 actions = 1,769,472 combinations, or about 21 bits. Ten characters of `A-Z0-9` hold roughly 52 bits, so this encoding spends the surplus on legibility instead of packing: every field gets a fixed slot you can read at a glance.

## Format

```
slot:  1  2  3  4 5 6  7  8 9  10
       V  T  E  B B B  R  C C  A
ex:    1  H  3  H - F  4  1 4  J
```

| Slot | Field | Encoding |
| --- | --- | --- |
| 1 | Format version | `1` |
| 2 | Type | `S` Score, `M` Money, `E` Exp, `B` Box, `A` Auto, `H` Semi-auto |
| 3 | Episode | `0` Any, `1`-`7` Episode 1-7, `A`/`B`/`C` Special Episode 1-3, `X` Special Exp Episode |
| 4 | HP Extension | `H` on, `-` off |
| 5 | Power Jelly Boost | `P` on, `-` off |
| 6 | Fast Start | `F` on, `-` off |
| 7 | Random boost | `0` none, otherwise one of the eleven below |
| 8-9 | Cookie power+ | Bitmask as two uppercase hex digits, `00`-`7F` |
| 10 | Action | `-` none, `J` jump at start |

`-` means off or none in a flag slot; `0` means none in a numeric slot.

### Random boost (slot 7)

| Char | Boost | Char | Boost |
| --- | --- | --- | --- |
| `1` | Double Coins | `7` | Gold Coin Magic |
| `2` | +15% Score | `8` | -30% Collision Damage |
| `3` | 15% HP Drain | `9` | +20% HP from Potions |
| `4` | Revive once with 80 HP | `A` | Magnetic Aura |
| `5` | 70% Crush Chance | `B` | 2 Pit Lifts |
| `6` | +17% Base Speed | | |

### Cookie power+ bitmask (slots 8-9)

| Value | Cookie | Value | Cookie |
| --- | --- | --- | --- |
| `01` | Cheerleader | `10` | Sea Fairy |
| `02` | Special Force | `20` | Serenade of Love |
| `04` | Fairy | `40` | EXP Party |
| `08` | Cheesecake | | |

Add the values of everything you selected and write the sum in hex. Fairy plus Sea Fairy is `04 + 10 = 14`.

## Auto vs semi-auto

Semi-auto is a run that needs manual work each time. A combi is semi-auto when **any** of these is true: Fast Start is on (slot 6), a random boost is selected (slot 7), or there is a jump action (slot 10).

Slot 2 stores `A` or `H` for readability, but those three slots are the authority. `encode` normalizes slot 2 so a generated code never contradicts itself. `decode` accepts a hand-typed code that does contradict, keeps `combi.type` as written, and returns a warning; `isSemiAuto` always answers from the flag slots.

Full auto is therefore one visual pattern — `-` at slot 6, `0` at slot 7, `-` at slot 10:

```
1A3H---00-    full auto
1H3H-F400-    semi-auto (Fast Start + Revive)
1H3H---00J    semi-auto (jump only)
```

## Usage

```ts
import { encode, decode, isSemiAuto } from "./src/codec.ts";

encode({
  type: "score",
  episode: "any",
  boosts: ["hpExtension", "powerJellyBoost", "fastStart"],
  randomBoost: null,
  cookiePowers: ["fairy", "seaFairy"],
  action: "none",
});
// "1S0HPF014-"

const { combi, warnings } = decode("1E3-PF400J");
isSemiAuto(combi); // true
```

`decode` throws on a code it cannot read — wrong length, unknown version, an unknown character in a slot, or a cookie mask above `7F`. Contradictions between slot 2 and the flag slots are soft: they come back in `warnings`.

## Web app

<https://kamontat.github.io/cookierun/>

Two panels: pick a configuration and the 10-character code updates as you go, or paste a code and read it back in plain words. The page also carries the slot legend so you can read a code by eye without it. Everything runs in the browser — no network calls, no analytics.

The build produces a **single self-contained `index.html`** with all JavaScript and CSS inlined, so the page works from a file:// URL offline and needs no base-path configuration when served from a GitHub Pages project subpath.

## Development

```bash
bun install
bun run dev        # dev server with hot reload at http://localhost:3000
bun test           # 35 tests, including an exhaustive round-trip over all 1,769,472 combis
bun run typecheck
bun run build      # writes dist/index.html
```

The exhaustive test asserts that encoding produces exactly 1,474,560 distinct codes — 1,769,472 inputs collapse to that many because the auto/semi-auto character is derived rather than free. DOM tests run against `web/index.html` under happy-dom, preloaded via `bunfig.toml`.

### Layout

| Path | Role |
| --- | --- |
| `src/codec.ts` | Slot tables, `encode`, `decode`, `isSemiAuto`. No DOM, no dependencies. |
| `src/labels.ts` | Display names for every enum value. |
| `src/describe.ts` | Turns a combi into rows and an auto/semi-auto verdict. |
| `web/` | The page: markup, styles, and thin DOM wiring. |

The `ALL_*` arrays and the label tables derive from the character tables, and a test asserts every value has a label, so adding a boost or episode cannot silently ship a page with a missing option.

## Deployment

`.github/workflows/deploy.yml` runs on every push to `main` and on manual dispatch: it installs with a frozen lockfile, runs the tests and typecheck, builds, and publishes `dist/` to GitHub Pages.

Bun's version is pinned by the `packageManager` field in `package.json`, which `oven-sh/setup-bun` reads automatically. Keep it in sync with `mise.toml` when upgrading.

The repository must have **Settings → Pages → Source** set to **GitHub Actions** for the deploy job to succeed.
