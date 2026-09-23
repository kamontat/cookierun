# Cookie Run combi codes

A Cookie Run combi stores a cookie, relay, pet, and treasure, but nothing else — the run type, episode, boosts, and cookie power+ selections would otherwise live only in your head. The combi name is 10 characters, which is enough room to carry all of it. An optional loadout section goes further still, writing down the cookie, relay, pet, and treasure choices themselves, so a whole build travels as one code even without the game in front of you.

The full configuration space is 6 types x 12 episodes x 16 boost subsets x 12 random-boost choices x 128 cookie-power+ subsets x 2 actions = 3,538,944 combinations, or about 22 bits. Ten characters of `A-Z0-9` hold roughly 52 bits, so this encoding spends the surplus on legibility instead of packing: every field gets a fixed slot you can read at a glance.

## Format

```
slot:  1  2  3  4  5 6  7  8 9  10
       V  T  E  B  . .  R  C C  A
ex:    1  H  3  5  - -  4  1 4  J
```

| Slot | Field | Encoding |
| --- | --- | --- |
| 1 | Format version | `1` |
| 2 | Type | `S` Score, `M` Money, `E` Exp, `B` Box, `A` Auto, `H` Semi-auto |
| 3 | Episode | `0` Any, `1`-`7` Episode 1-7, `A`/`B`/`C` Special Episode 1-3, `X` Special Exp Episode |
| 4 | Boosts | Bitmask as one uppercase hex digit, `0`-`F` |
| 5-6 | Reserved | Always `-`, both |
| 7 | Random boost | `0` none, otherwise one of the eleven below |
| 8-9 | Cookie power+ | Bitmask as two uppercase hex digits, `00`-`7F` |
| 10 | Action | `-` none, `J` jump at start |

`-` means off or none in a flag slot; `0` means none in a numeric slot.

Slots 5 and 6 are held open, not used. The boosts had a flag slot each until a fourth boost arrived and there were only ten characters to have; they moved into one slot, and the two that came free stay where they are so every field after them keeps its position — and so the next field to arrive has somewhere to go. A code that writes anything but `-` in either one is rejected outright.

### Boost bitmask (slot 4)

| Value | Boost | Value | Boost |
| --- | --- | --- | --- |
| `1` | HP Extension | `4` | Fast Start |
| `2` | Power Jelly Boost | `8` | Double XP |

Add the values of every boost you turned on and write the sum in hex, the same way as the cookie power+ mask below. HP Extension plus Fast Start is `1 + 4 = 5`; all four is `F`.

Cookie Relay is not here: a run that uses one says so by naming a relay cookie in the loadout section.

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
1S07--014-                   no loadout, exactly as before
1C2L.1S07--014-              a cookie only
1C2LR0BP1ZTU0FZ_0RB-0QQ.1H35--400J
                             cookie, relay, pet, two treasure slots, any order
```

Encoding always writes the canonical form: ids are sorted within a slot, and whole slots are sorted against each other whenever the order flag is `U` — a single slot is always written `U`, since there is nothing to order with only one slot. That is what keeps one build to exactly one code. Reading a code is more forgiving: a hand-written or otherwise non-canonical loadout still decodes correctly, it just re-encodes into the canonical form rather than back into what you typed.

Every id — cookie, relay, pet, or treasure — is a catalog id from `assets/index.json`. Ids are handed out once, append-only, and never reassigned or reused, so a code you write today still names the same cookie, pet, or treasure years from now, even if that entry is later pulled from the game.

An id must not repeat within one treasure slot — `TU0FZ_0FZ` is invalid, since listing the same treasure as its own alternative says nothing. The same id may repeat across two different slots, though: that is how overlapping alternatives are written, and `loadout.ts` enforces the no-repeat rule per slot, not across the whole group.

## Auto vs semi-auto

Semi-auto is a run that needs manual work each time. A build is semi-auto when **any** of these is true: Fast Start is on (bit `4` of slot 4), a random boost is selected (slot 7), there is a jump action (slot 10), or the loadout carries a relay cookie (the `R` group). The other three boosts do nothing to it — Double XP included, since it changes what a run pays out rather than what it asks of you.

The relay is the one reason that lives outside the ten characters: a relay cookie is swapped in by hand, so a run carrying one never plays itself through. Slot 2 is written from the whole build, so the ten characters you paste into the game say `H` when a relay is in front of them — while a bare combi code, having no loadout to read, answers for its own three flags alone.

Slot 2 stores `A` or `H` for readability, but those four reasons are the authority. `encodeFull` normalizes slot 2 so a generated code never contradicts itself. `decodeFull` accepts a hand-typed code that does contradict, keeps `combi.type` as written, and returns a warning; `isSemiAutoBuild` always answers from the fields above.

```
1A31--000-    full auto (HP Extension only)
1H35--400-    semi-auto (Fast Start + Revive)
1H31--000J    semi-auto (jump only)
1A39--000-    full auto (HP Extension + Double XP)
```

## Usage

```ts
import { encode, decode, isSemiAuto } from "./src/routes/combi-name/codec";

encode({
  type: "score",
  episode: "any",
  boosts: ["hpExtension", "powerJellyBoost", "fastStart"],
  randomBoost: null,
  cookiePowers: ["fairy", "seaFairy"],
  action: "none",
});
// "1S07--014-"

const { combi, warnings } = decode("1E36--400J");
isSemiAuto(combi); // true
```

`decode` throws on a code it cannot read — wrong length, unknown version, an unknown character in a slot, or a cookie mask above `7F`. Contradictions between slot 2 and the flag slots are soft: they come back in `warnings`.

## Web app

Every page carries a sidebar listing the available tools, generated from the registry rather than written out. The site root is a short home pane; the combi builder itself lives at `/combi-name/`.

The code is the whole interface. It leads the page, updating as you pick a configuration below it, and it is also where a code goes in: press **Edit** and type or paste one, and every control below follows it as you type. Pasting a code anywhere on the page loads it without opening the editor at all. A half-typed code says how far along it is rather than complaining, and a code that contradicts itself loads with a warning rather than being refused.

The code and what it says in words stay pinned at the top of the page as you work the controls under them; the auto/semi-auto verdict, any warnings and the tip sit just below, where you read them once.

Each field of the code is drawn as its own run. Hover one and it names its slot and what it currently says; click it and the page jumps to the control that writes it. That is why the slot tables sit folded away at the bottom — they confirm the format rather than being where you look things up.

Below the code, one board: the run type and episode, then the loadout and its treasures, then boosts, random boost and action, then cookie power+. Every value it shows is the control that writes it. There is no Semi-auto chip — pick **Auto**, and the build turns semi-auto by itself the moment Fast Start, a random boost, a jump action or a relay cookie is in play, which is what the format says anyway. The chip itself then reads Semi-auto, and the badge on the board says so too. Random boost and Action each open with a none of their own, and clicking the chip you already picked goes back to it. Cookie power+ wears the portrait of the cookie it belongs to. The cookie, relay and pet controls stand the face of what they hold under the role they fill; clicking one opens a filterable grid of faces in a dialog over the page, which Escape or a click on its backdrop closes again. A treasure slot is its name over its alternatives, one to a line, each with a button that drops just that one; the name opens the same grid, where picks are a draft until **Done** and Escape throws the draft away whole. The treasure grid offers only what a run can equip — the consumable and commemorative families, 208 of the 1,144 entries, are left out of the picker, though a code that already carries one still reads and still keeps it.

Your code lives in the address bar, so a build is a link you can send, and it is remembered between visits — a link wins over the remembered one, and **Reset** goes back to an empty code. Pasting a link into the address bar of a tab that is already open works too: the page notices the new code rather than overwriting it. **Copy** takes the code, **Copy link** takes the whole address. The sidebar carries a light/dark control that defaults to following your system. Everything runs in the browser — no network calls, no analytics.

The build produces one `index.html` per page, the JavaScript and CSS they share as chunks beside them, and the cookie, pet, and treasure icons under `assets/`. Everything is linked relatively, so `dist/` carries no assumption about the base path it is served from — but it does have to be served: module scripts over a `file://` URL are blocked by the browser. `bun run preview` is the local way to open it.

## Development

```bash
bun install
bun run dev           # dev server on :3000; / is the home pane, /combi-name/ is the combi tool
bun run test          # 332 tests, including an exhaustive round-trip over all 3,538,944 combis
bun run check         # typecheck and Biome, in one pass
bun run build         # writes dist/index.html, dist/combi-name/index.html, their chunks, and dist/assets/
bun run preview       # serves the built dist/ on :4000; build first
bun run verify:assets # asks cookierundb.com whether assets/index.json is still complete
```

The exhaustive test asserts that encoding produces exactly 2,949,120 distinct codes — 3,538,944 inputs collapse to that many because the auto/semi-auto character is derived rather than free. DOM tests run against the combi page and against every component under happy-dom, registered by `tests/happydom.ts` and preloaded via `bunfig.toml`.

### Layout

| Path | Role |
| --- | --- |
| `src/routes/` | One directory per page — markup, stylesheet, page script, and that page's own logic. `src/routes/index.*` is the home pane. |
| `src/routes/combi-name/codec.ts` | Slot tables, `encode`, `decode`, `isSemiAuto`. No DOM, no dependencies. |
| `src/routes/combi-name/labels.ts` | Display names for every enum value. |
| `src/routes/combi-name/describe.ts` | Turns a combi into rows and an auto/semi-auto verdict. |
| `src/routes/combi-name/catalog.ts` | Resolves cookie, pet, and treasure ids against `assets/index.json`. |
| `src/routes/combi-name/loadout.ts` | The loadout section's grammar: `encodeLoadout`, `decodeLoadout`. |
| `src/routes/combi-name/full-code.ts` | Joins a loadout and a combi into `loadout.combi`, or just the bare combi when there is no loadout. |
| `src/routes/combi-name/hints.ts` | What each character of a code means, one entry per character, for the tooltips on the built code. |
| `src/routes/combi-name/state.ts` | The code in the address bar and in `localStorage`: what a link carries and what a return visit restores. |
| `src/components/` | Every custom element the pages declare, the sidebar and the light/dark control among them. |
| `src/lib/` | What more than one route needs: the tool registry, and the link writer that keeps every href relative. |
| `scripts/` | The two asset programs and their helpers: `fetch-assets.ts` scrapes, `verify-assets.ts` checks the result offline. Every other package script is the command itself, in `package.json`. |
| `tests/` | Test configuration only; every test sits beside the code it covers. |

The `ALL_*` arrays and the label tables derive from the character tables, and a test asserts every value has a label, so adding a boost or episode cannot silently ship a page with a missing option.

## Deployment

The site is a Cloudflare Worker serving static assets. `wrangler.jsonc` points it at `dist/` and has wrangler run `bun run build` itself, so the deploy workflows do not build beforehand.

`.github/workflows/main.yml` runs the tests, both checks, and the build. `deploy-preview.yml` uploads a preview version for every pull request; `deploy-production.yml` deploys on every push to `main`. Both need `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in repository secrets.

Bun's version is pinned by the `packageManager` field in `package.json`, which `oven-sh/setup-bun` reads automatically. Keep it in sync with `mise.toml` when upgrading.
