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
import { encode, decode, isSemiAuto } from "./routes/combi-name/codec.ts";

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

Every page carries a sidebar listing the available tools, generated from the registry rather than written out. The site root is a short home pane; the combi builder itself lives at `/combi-name/`.

The code leads the page and updates as you pick a configuration below it, or paste one into the reader and it comes back in plain words. The slot legend is on the page too, so you can learn to read a code by eye and stop needing the tool. The sidebar carries a light/dark control that defaults to following your system. Everything runs in the browser — no network calls, no analytics.

The build produces a **self-contained `index.html` per page** with all JavaScript and CSS inlined, so each page works from a file:// URL offline and carries no base-path assumption about where it is served from.

## Development

```bash
bun install
bun run dev        # dev server with hot reload; / is the home pane, /combi-name/ is the combi tool
bun run test       # 90 tests, including an exhaustive round-trip over all 1,769,472 combis
bun run check      # typecheck and Biome, in one pass
bun run build      # writes dist/index.html and dist/combi-name/index.html
```

The exhaustive test asserts that encoding produces exactly 1,474,560 distinct codes — 1,769,472 inputs collapse to that many because the auto/semi-auto character is derived rather than free. DOM tests run against the combi page and against every component under happy-dom, registered by `tests/happydom.ts` and preloaded via `bunfig.toml`.

### Layout

| Path | Role |
| --- | --- |
| `routes/` | One directory per page — markup, stylesheet, page script, and that page's own logic. `routes/index.*` is the home pane. |
| `routes/combi-name/codec.ts` | Slot tables, `encode`, `decode`, `isSemiAuto`. No DOM, no dependencies. |
| `routes/combi-name/labels.ts` | Display names for every enum value. |
| `routes/combi-name/describe.ts` | Turns a combi into rows and an auto/semi-auto verdict. |
| `components/` | Every custom element the pages declare, the sidebar and the light/dark control among them. |
| `lib/` | What more than one route needs: the tool registry, and the link writer that keeps every href relative. |
| `scripts/` | One file per package script — dev server, build, test, the two checks, the formatter, deploy, asset scrape — over a shared `execAsync` in `scripts/utils/`. |
| `tests/` | Test configuration only; every test sits beside the code it covers. |

The `ALL_*` arrays and the label tables derive from the character tables, and a test asserts every value has a label, so adding a boost or episode cannot silently ship a page with a missing option.

## Deployment

The site is a Cloudflare Worker serving static assets. `wrangler.jsonc` points it at `dist/` and has wrangler run `bun run build` itself, so the deploy workflows do not build beforehand.

`.github/workflows/main.yml` runs the tests, both checks, and the build. `deploy-preview.yml` uploads a preview version for every pull request; `deploy-production.yml` deploys on every push to `main`. Both need `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in repository secrets.

Bun's version is pinned by the `packageManager` field in `package.json`, which `oven-sh/setup-bun` reads automatically. Keep it in sync with `mise.toml` when upgrading.
