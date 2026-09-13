# Cookie Run combi codes

A Cookie Run combi stores a cookie, relay, pet, and treasure, but nothing else — the run type, episode, boosts, and cookie power+ selections would otherwise live only in your head. The combi name is 10 characters, which is enough room to carry all of it. An optional loadout section goes further still, writing down the cookie, relay, pet, and treasure choices themselves, so a whole build travels as one code even without the game in front of you.

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

## Loadout section

A full code is `loadout.combi`: an optional loadout section, a `.`, then the ten-character combi name exactly as above. A bare ten-character code — no `.`, no loadout — is still a whole code and decodes exactly as it always has; the loadout is purely additive and every code written before it existed still works, unchanged.

The loadout writes down the cookie, relay, pet, and treasure a build uses. The game already stores those four in its own combi field, so a loadout is never required — add one when you want a build to travel as text on its own, without a screenshot or the game alongside it.

| Tag | Group | Encoding |
| --- | --- | --- |
| `1` | Version | This section's own format version, tracked separately from the combi section's (slot 1 of the table above) |
| `C` | Cookie | 2-character catalog id |
| `R` | Relay | 2-character catalog id, the same catalog as cookie |
| `P` | Pet | 2-character catalog id |
| `T` | Treasures | An order flag (`U` any order, `O` exact order), then up to three slots of 3-character ids joined by `-`; alternatives within a slot are joined by `_` |

`C`, `R`, `P`, and `T` are each written at most once and, when present, always in that order. A group that has nothing to say is simply missing — there is no placeholder character for "unset."

```
1S0HPF014-                   no loadout, exactly as before
1C2L.1S0HPF014-              a cookie only
1C2LR0BP1ZTU0FZ_0RB-0QQ.1H3H-F400J
                             cookie, relay, pet, two treasure slots, any order
```

Encoding always writes the canonical form: ids are sorted within a slot, and whole slots are sorted against each other whenever the order flag is `U` — a single slot is always written `U`, since there is nothing to order with only one slot. That is what keeps one build to exactly one code. Reading a code is more forgiving: a hand-written or otherwise non-canonical loadout still decodes correctly, it just re-encodes into the canonical form rather than back into what you typed.

Every id — cookie, relay, pet, or treasure — is a catalog id from `assets/index.json`. Ids are handed out once, append-only, and never reassigned or reused, so a code you write today still names the same cookie, pet, or treasure years from now, even if that entry is later pulled from the game.

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

The build produces one `index.html` per page with its JavaScript and CSS inlined, so each page works from a file:// URL offline and carries no base-path assumption about where it is served from. The combi page is the one exception: it ships its cookie, pet, and treasure icons as a sibling `assets/` folder rather than inlining them, so that page needs the folder alongside it to show them — every other page stays fully self-contained.

## Development

```bash
bun install
bun run dev        # dev server with hot reload; / is the home pane, /combi-name/ is the combi tool
bun run test       # 177 tests, including an exhaustive round-trip over all 1,769,472 combis
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
| `routes/combi-name/catalog.ts` | Resolves cookie, pet, and treasure ids against `assets/index.json`. |
| `routes/combi-name/loadout.ts` | The loadout section's grammar: `encodeLoadout`, `decodeLoadout`. |
| `routes/combi-name/full-code.ts` | Joins a loadout and a combi into `loadout.combi`, or just the bare combi when there is no loadout. |
| `components/` | Every custom element the pages declare, the sidebar and the light/dark control among them. |
| `lib/` | What more than one route needs: the tool registry, and the link writer that keeps every href relative. |
| `scripts/` | One file per package script — dev server, build, test, the two checks, the formatter, deploy, asset scrape — over a shared `execAsync` in `scripts/utils/`. |
| `tests/` | Test configuration only; every test sits beside the code it covers. |

The `ALL_*` arrays and the label tables derive from the character tables, and a test asserts every value has a label, so adding a boost or episode cannot silently ship a page with a missing option.

## Deployment

The site is a Cloudflare Worker serving static assets. `wrangler.jsonc` points it at `dist/` and has wrangler run `bun run build` itself, so the deploy workflows do not build beforehand.

`.github/workflows/main.yml` runs the tests, both checks, and the build. `deploy-preview.yml` uploads a preview version for every pull request; `deploy-production.yml` deploys on every push to `main`. Both need `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in repository secrets.

Bun's version is pinned by the `packageManager` field in `package.json`, which `oven-sh/setup-bun` reads automatically. Keep it in sync with `mise.toml` when upgrading.
