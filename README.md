# Cookie Run combi codes

A Cookie Run combi stores a cookie, relay, pet, and treasure, but nothing else — the run's goal, whether it plays itself, the episode, boosts, and cookie power+ selections would otherwise live only in your head. The combi name is 10 characters, which is enough room to carry all of it. An optional loadout section goes further still, writing down the cookie, relay, pet, and treasure choices themselves, so a whole build travels as one code even without the game in front of you.

Every slot is a character you can read at a glance: a letter from the name of what it holds, a digit where the thing is a number, and `0` for off or none.

## Format

```
slot:  1  2  3  4  5  6  7 8 9  10
       V  M  G  E  B  R  P P P  A
ex:    1  H  M  3  2  R  F W 0  J
SE2:   1  A  E  T  0  4  2 0 0  0
```

| Slot | Field | Encoding |
| --- | --- | --- |
| 1 | Format version | `1` |
| 2 | Mode | `0` Manual, `A` Auto, `H` Semi-auto |
| 3 | Goal | `S` Score, `M` Money, `E` Exp, `B` Box, `0` Any (auto only) |
| 4 | Episode | `0` Any, `1`-`7` Episode 1-7, `C` Special Episode 1 (Island of Coins), `T` Special Episode 2 (Tower of Frozen Waves), `R` Special Episode 3 (Mysterious Rabbit Hole), `X` Special Exp Episode (XP-Elixir Workshop) |
| 5 | Boosts | One character for the whole set, below |
| 6 | Random boost | `0` none, otherwise one of the eleven below |
| 7-9 | Cookie power+ | One slot per group of powers, below |
| 10 | Action | `0` none, `J` jump at start — an auto run only |

`0` means off or none in every slot. The combi name is letters and digits only: the game field takes it as is, and a `-` inside it would read as the section separator below.

An auto run aims for Money, Exp, or Box, or for nothing in particular — Any, `0`; Score is played by hand. A code that says Score beside `A` or `H`, or Any beside a manual `0`, still decodes, with a warning. A manual run has no starting action: a `J` beside a manual `0` is dropped, with a warning.

### Boosts (slot 5)

Each of the sixteen sets of boosts has a fixed character. A single boost is its own letter and all four is `A`; the pairs and triples have no letter of their own, so they run in order, digits first — a digit in slot 5 always means more than one boost:

| Char | Boosts | Char | Boosts | Char | Boosts |
| --- | --- | --- | --- | --- | --- |
| `0` | none | `1` | HP Extension + Power Jelly | `7` | HP Extension + Power Jelly + Fast Start |
| `H` | HP Extension | `2` | HP Extension + Fast Start | `8` | HP Extension + Power Jelly + Double XP |
| `P` | Power Jelly Boost | `3` | HP Extension + Double XP | `9` | HP Extension + Fast Start + Double XP |
| `F` | Fast Start | `4` | Power Jelly + Fast Start | `B` | Power Jelly + Fast Start + Double XP |
| `X` | Double XP | `5` | Power Jelly + Double XP | `A` | all four |
| | | `6` | Fast Start + Double XP | | |

Cookie Relay is not here: a run that uses one says so by naming a relay cookie in the loadout section.

### Random boost (slot 6)

Each boost is a letter from its own name.

| Char | Boost | Char | Boost |
| --- | --- | --- | --- |
| `D` | Double Coins | `G` | Gold Coin Magic |
| `S` | +15% Score | `X` | -30% Collision Damage (X for crash) |
| `H` | 15% HP Drain | `P` | +20% HP from Potions |
| `R` | Revive once with 80 HP | `M` | Magnetic Aura |
| `C` | 70% Crush Chance | `L` | 2 Pit Lifts |
| `B` | +17% Base Speed | | |

### Cookie power+ (slots 7-9)

Any number of the seven can be on, so they are split into three groups with a slot each. A slot works like the boost slot: `0` for none of its group, a power's own letter when it is the only one of its group, and a running digit for two or more.

| Slot | Powers | Combinations |
| --- | --- | --- |
| 7 | `C` Cheerleader, `S` Special Force, `F` Fairy | `1` C+S, `2` C+F, `3` S+F, `4` all three |
| 8 | `K` Cheesecake, `W` Sea Fairy (W for water) | `1` both |
| 9 | `L` Serenade of Love, `E` EXP Party | `1` both |

Fairy plus Sea Fairy is `FW0`; Cheerleader, Fairy and EXP Party is `20E`; all seven is `411`.

### Special episodes

Some episodes take less than a full run:

| Episode | Takes |
| --- | --- |
| Special Episode 1 (`C`) | cookie, pet, treasures |
| Special Episode 2 (`T`) | cookie, pet, treasures, and a tower floor |
| Special Exp Episode (`X`) | cookie and pet |

None of the three takes a relay, boosts, a random boost, or cookie power+, so slots 5-9 read `0`. Special Episode 2 spends slots 5-7 on the floor instead — `001` to `100`, or `000` for any floor — and slots 8-9 stay `0`. The goal, mode, and action apply as they do anywhere else.

Encoding drops what the episode has no room for. Decoding a code that carries it anyway drops it too, with a warning, rather than refusing the code.

## Loadout section

A full code is `loadout-combi`: an optional loadout section, a `-`, then the ten-character combi name exactly as above. A bare ten-character code — no `-`, no loadout — is still a whole code; the loadout is purely additive.

The separators are picked for word-wise selection (double-click, or Option+Shift+Arrow). Editors and browsers stop a word at `-` but not at `_` or `.`, so the loadout selects as one word and the combi name — the part you paste into the game — as another.

The loadout writes down the cookie, relay, pet, and treasure a build uses. The game already stores those four in its own combi field, so a loadout is never required — add one when you want a build to travel as text on its own, without a screenshot or the game alongside it.

| Tag | Group | Encoding |
| --- | --- | --- |
| `1` | Version | This section's own format version, tracked separately from the combi section's (slot 1 of the table above) |
| `C` | Cookie | 2-character catalog id, or `__` for any cookie |
| `R` | Relay | 2-character catalog id, the same catalog as cookie, or `__` for any relay |
| `P` | Pet | 2-character catalog id, or `__` for any pet |
| `T` | Treasures | An order flag (`U` any order, `O` exact order), then up to three slots of 3-character ids joined by `.`; alternatives within a slot are joined by `_`, and each id may be followed by a level — a treasure whose levels are not one run is listed once per run |

`C`, `R`, `P`, and `T` are each written at most once and, when present, always in that order. A group that has nothing to say is simply missing — there is no placeholder character for "unset."

"Any" is not that placeholder, and the difference is the point: a missing group is a build that never mentions the slot, while `__` is one that says anything fits there. `_` is outside the `[0-9A-Z]` alphabet ids are drawn from, so it can never collide with a catalog id however far the catalog grows. Only `C`, `R`, and `P` accept it — a treasure slot already holds a list of acceptable alternatives, which is a different idea, and `TU___` is rejected like any other malformed id (there `_` is the alternative separator, so it reads as empty ids).

An `R__` counts as a relay for everything a named relay counts for: the build is semi-auto, and slot 2 is written `H`. Which cookie relays in is not what makes the run need a hand.

```
10S070FW00                          no loadout
1C2L-10S070FW00                     a cookie only
1C__R__P__-1HM0000000               any cookie, any relay, any pet
1C2LR0BP1ZTU0FZ_0RB.0QQ-1HM32R000J  cookie, relay, pet, two treasure slots, any order
1TU0FZ02_0FZ59_0RB3.0QQ9-10S0000000 slot 1: 0FZ at +0-2 or +5-9, or 0RB at +3; slot 2: 0QQ at +9
```

Encoding always writes the canonical form: ids are sorted within a slot, and whole slots are sorted against each other whenever the order flag is `U` — a single slot is always written `U`, since there is nothing to order with only one slot. That is what keeps one build to exactly one code. Reading a code is more forgiving: a hand-written or otherwise non-canonical loadout still decodes correctly, it just re-encodes into the canonical form rather than back into what you typed.

Every id — cookie, relay, pet, or treasure — is a catalog id from `assets/index.json`, `__` aside. Ids are handed out once, append-only, and never reassigned or reused, so a code you write today still names the same cookie, pet, or treasure years from now, even if that entry is later pulled from the game.

Within one slot, an id repeats only to list another run of its levels, and reading a code merges every copy of an id in a slot into one treasure — so `TU0FZ_0FZ` is simply 0FZ at +0, and `TU0FZ03_0FZ25` is 0FZ at +0-5. The same id may also repeat across two different slots: that is how overlapping alternatives are written.

### Treasure levels

A treasure is upgraded from +0 to +9, and each treasure in a slot says which levels it is accepted at. The level follows its id directly — ids are always three characters, so it needs no separator:

| Written | Levels |
| --- | --- |
| `0FZ` | +0, not upgraded |
| `0FZ5` | +5 |
| `0FZ58` | +5 to +8 |
| `0FZ09` | +0 to +9, any level |
| `0FZ9` | +9 |
| `0FZ02_0FZ59` | +0 to +2, and +5 to +9 |
| `0FZ_0FZ9` | +0 and +9 |

No digits means +0, which is also how every code written before levels existed reads. A treasure whose levels are not one run repeats its id once per run, lowest first. Encoding writes the shortest form: runs are merged, a one-level run is one digit, and +0 is nothing. A range that runs backwards, like `95`, is rejected.

## Auto vs semi-auto

Semi-auto is an auto run that needs manual work each time. An auto build is semi-auto when **any** of these is true: Fast Start is on (slot 5), a random boost is selected (slot 6), there is a jump action (slot 10), or the loadout carries a relay cookie (the `R` group, `R__` included) on an episode that takes one. The other three boosts do nothing to it — Double XP included, since it changes what a run pays out rather than what it asks of you.

The relay is the one reason that lives outside the ten characters: a relay cookie is swapped in by hand, so a run carrying one never plays itself through. Slot 2 is written from the whole build, so the ten characters you paste into the game say `H` when a relay is in front of them — while a bare combi code, having no loadout to read, answers for its own three flags alone.

Slot 2 stores `A` or `H` for readability, but those four reasons are the authority. `encodeFull` normalizes slot 2 so a generated code never contradicts itself. `decodeFull` accepts a hand-typed code that does contradict, keeps `combi.mode` as written, and returns a warning; `isSemiAutoBuild` always answers from the fields above.

```
1AM3H00000    full auto, money (HP Extension only)
1A03H00000    full auto, no goal in particular
1HM32R0000    semi-auto (HP Extension + Fast Start, Revive)
1HE3H0000J    semi-auto (jump only)
1AB3300000    full auto, box (HP Extension + Double XP)
1AMT042000    full auto on the tower, floor 42
```

## Usage

```ts
import { encode, decode, isSemiAuto } from "./src/routes/combi-name/codec";

encode({
  goal: "score",
  mode: "manual",
  episode: "any",
  floor: null,
  boosts: ["hpExtension", "powerJellyBoost", "fastStart"],
  randomBoost: null,
  cookiePowers: ["fairy", "seaFairy"],
  action: "none",
});
// "10S070FW00"

const { combi, warnings } = decode("1HE34R000J");
isSemiAuto(combi); // true
```

`decode` throws on a code it cannot read — wrong length, unknown version, an unknown character in a slot, or a tower floor that is not `000`-`100`. Everything else is soft and comes back in `warnings`: slot 2 disagreeing with the flag slots, Score on an auto run or Any on a manual one, an action on a manual run, or anything the episode has no room for.

## Web app

Every page carries a top bar in place of a sidebar: the brand ("Cookie Run"), a tool menu naming the current page (or "All tools" on the home pane) that opens a list of everything in the registry, and the theme control. The site root is a short home pane; the combi builder itself lives at `/combi-name/`.

The code is the whole interface. It leads the page, updating as you pick a configuration below it, and it is also where a code goes in: press **Edit** and type or paste one, and every control below follows it as you type. Pasting a code anywhere on the page loads it without opening the editor at all. A half-typed code says how far along it is rather than complaining, and a code that contradicts itself loads with a warning rather than being refused.

The code panel stays in reach while you work: pinned to the top of the page on a wide screen, docked to the bottom of the screen on a phone. It shows three buttons: **Edit**, **Save** (or **Update** while a saved entry is open), and a **⋯** menu holding **Show full code**, **Copy code**, **Copy link**, **Reset**, and **Save as new** and **Cancel** while an entry is open. The panel also carries the page's one notification banner, so a message is in view however far down the page you are: under the code and its buttons on a wide screen, at the top of the dock on a phone. Under the panel, in order: a note for the code in the panel — "Note · new code", or "Note · editing a saved code" while an entry is open — and a summary of the whole build.

Every message the page has goes in that banner — a strip of one line under the code, always there so nothing jumps when a message comes or goes — and nowhere else, as one of three kinds: **info** (a copy that worked, a code saved, updated, loaded or deleted, typing progress), **warn** (a code read with changes, an import that skipped lines, nothing to import or export) or **error** (a code that does not read, a clipboard or a store the browser refused). Info clears itself after a few seconds, except typing progress, which stays while the editor is open; a warning or an error stays until you dismiss it with **✕** or something replaces it. A message about the code on screen — its warnings, a paste, a copy — goes once the build changes, and an error about a code you were typing goes when you close the editor. A message of several lines folds to its title and a count, like **Read with changes (2) ▾**; tap it to read them. A link that reads with changes and carries a note shows both: the note offer is one more line under the warning. While the Saved or Help drawer is open the banner moves into it, under its header, since a drawer covers the page behind it.

The panel shows only the ten characters the game takes — what **Copy code** copies — even when the code carries a loadout; **Show full code** in the menu swaps it to the whole code (and Copy code with it) until you switch back, and the choice is remembered in this browser: the loadout is the summary's to show, and it still rides in the link, in saved codes, and in the editor **Edit** opens, which holds the whole code. Each field of those ten characters is drawn as its own run. Hover one and it names its slot and what it currently says; click it and the page switches to the tab that holds the control and jumps to it, the same jump a line of the summary makes. A run for a slot nothing on the page owns — the version character, a reserved slot — or whose tab the episode has no room for is plain text instead, its tooltip still there but nothing behind it to click. That is why the slot tables, and the tip about clicking the code, live in the Help drawer behind the top bar's **?** (Help) button rather than folded away at the bottom of the page — they confirm the format rather than being where you look things up.

Under the note sits the summary: a read-only digest of the build, one row per tab and in the tabs' own order — Run, Cookies, Treasures, Boosts, Random boost, Power+ — each with its pictures and words — cookies, treasures, boosts and Power+ as pictures, their names a click away; an evolved or blessed treasure wears an E or B and a ring in its colour, as in the treasure picker, since both forms share one picture — and each a way to the control behind it. Pictures sit in equal boxes, like a grid; click a row's pictures to show or hide that row's names (on the Run line, the same click shows why a run is semi-auto), and use the › at the right end of a line to switch to its tab and focus the control. Run always shows; every other row only when it has something to say, with a muted hint once nothing else has been picked. On a phone the summary opens folded to one line — the mode, the goal, the episode, the faces and the treasure pictures, and a boost count — and expands on tap.

Below the summary, a row of tabs replaces the old board: **Main**, **Cookies**, **Treasures**, and **Boosts**, each with a badge counting what it holds. A tab the episode has no room for — Treasures on the Special Exp Episode, Boosts on any of the three special episodes — is disabled and says why in its title, and the page shows Main in its place; picking an episode that has room for the stored tab brings it back.

**Main** holds mode and goal chip rows, with the auto/semi-auto verdict sentence under them, the episode, the tower's floor, and the starting action. An auto run is offered Any, Money, Exp, and Box, and a manual one Score, Money, Exp, and Box. There is no Semi-auto chip — pick **Auto**, and the build turns semi-auto by itself the moment Fast Start, a random boost, a jump action or a relay cookie is in play, which is what the format says anyway; the chip itself then reads Semi-auto, and the verdict and the summary's Run row say so too. The episode is an inline grid of its twelve cards, short enough to show whole without a filter box; its own none is **Any**. A field the episode has no room for keeps its heading and says so in place of its control, and switching back brings back what it held. Action opens with a none of its own, and clicking the chip you already picked goes back to it.

**Cookies** holds three role cards — Cookie, Relay, Pet — each showing the face and name of what it holds, or None or Any; the Relay card reads "No relay here" and disables itself where the episode takes none. Picking a card decides which inline grid underneath it writes that role, with a **Clear** button once the role holds something. Each grid is a filterable, uncapped list of faces — cookies for Cookie and Relay, pets for Pet — opening with two answers before the catalog: **Any**, the slot the build says anything fits, and the grid's own **None**, the slot the build never mentions.

**Treasures** holds the order chips, then the three treasure slots, unchanged from the old board: a slot's name over its alternatives, one to a line, each with a button that drops just that one; the name opens a picker dialog over the page, with a level strip per pick, where picks are a draft until **Done** and Escape throws the draft away whole. The picker offers only what a run can equip — the consumable family, 7 of the 1,144 entries, is left out — though a code that already carries one still reads and still keeps it.

**Boosts** holds the boost cards, random boost chips — **None** first, then the eleven — and the cookie power+ cards, which wear the portrait of the cookie or pet each power belongs to.

Your code lives in the address bar, so a build is a link you can send, and it is remembered between visits — a link wins over the remembered one, and **Reset** goes back to an empty code. Pasting a link into the address bar of a tab that is already open works too: the page notices the new code rather than overwriting it. **Copy code** in the panel's menu takes the code as the panel shows it, **Copy link** takes the whole address.

Saved codes and the slot-format help each open as a drawer from a button in the top bar, rather than sitting at the bottom of the page. **Saved**, with a count beside it, keeps builds you want to come back to, each with a note of its own, in this browser. Each row shows **Load**, which puts it on the code panel, closes the drawer, and fills the note with its own text, and a **⋯** menu holding the rest. In the note, **Update** writes back whatever the panel and the note then say — the code, the note, or both — while **Save as new** leaves the original alone; **Cancel** or **Reset** lets go of the entry. **Copy link** hands over one entry as a link that carries its note (`#CODE?note=…`, the note as base64url so the link is one unbroken run of letters, digits, `-` and `_`), and **Share**, shown where the browser has a share sheet, sends the same link through it; either way whoever opens it finds the note waiting in their own note box, one click from keeping it. **Import and export**, folded under the list, moves the whole list as plain text — each code on its own line and its note under it, every note line starting with `>` — which reads fine pasted into a chat. Import takes that text, a file of it, bare codes or shared links, adds only the codes you have not saved yet, and says which lines it could not read.

The top bar carries the light/dark control that defaults to following your system. Everything runs in the browser — no network calls, no analytics.

The build produces one `index.html` per page, the JavaScript and CSS they share as chunks beside them, and the cookie, pet, and treasure icons under `assets/`. Everything is linked relatively, so `dist/` carries no assumption about the base path it is served from — but it does have to be served: module scripts over a `file://` URL are blocked by the browser. `bun run preview` is the local way to open it.

## Development

```bash
bun install
bun run dev           # dev server on :3000; / is the home pane, /combi-name/ is the combi tool
bun run test          # 456 tests, including an exhaustive round-trip over all 6,638,610 combis
bun run check         # typecheck and Biome, in one pass
bun run build         # writes dist/index.html, dist/combi-name/index.html, their chunks, and dist/assets/
bun run preview       # serves the built dist/ on :4000; build first
bun run verify:assets # asks cookierundb.com whether assets/index.json is still complete
```

The exhaustive test asserts that encoding produces exactly 3,319,305 distinct codes — 6,638,610 inputs collapse to that many because the auto/semi-auto character is derived rather than free, and a manual run drops its action. DOM tests run against the combi page and against every component under happy-dom, registered by `tests/happydom.ts` and preloaded via `bunfig.toml`.

### Layout

| Path | Role |
| --- | --- |
| `src/routes/` | One directory per page — markup, stylesheet, page script, and that page's own logic. `src/routes/index.*` is the home pane. |
| `src/routes/combi-name/codec.ts` | Slot tables, episode limits, `encode`, `decode`, `normalize`, `isSemiAuto`. No DOM, no dependencies. |
| `src/routes/combi-name/labels.ts` | Display names for every enum value. |
| `src/routes/combi-name/describe.ts` | Turns a combi into rows and an auto/semi-auto verdict. |
| `src/routes/combi-name/catalog.ts` | Resolves cookie, pet, and treasure ids against `assets/index.json`. |
| `src/routes/combi-name/loadout.ts` | The loadout section's grammar: `encodeLoadout`, `decodeLoadout`. |
| `src/routes/combi-name/full-code.ts` | Joins a loadout and a combi into `loadout-combi`, or just the bare combi when there is no loadout. |
| `src/routes/combi-name/hints.ts` | What each character of a code means, one entry per character, for the tooltips on the built code. |
| `src/routes/combi-name/state.ts` | The code in the address bar and in `localStorage`: what a link carries and what a return visit restores. |
| `src/routes/combi-name/saved.ts` | The saved list: save, update and remove entries, and the plain-text form export writes and import reads. |
| `src/components/` | Every custom element the pages declare, the top bar and the light/dark control among them. |
| `src/lib/` | What more than one route needs: the tool registry, and the link writer that keeps every href relative. |
| `scripts/` | The two asset programs and their helpers: `fetch-assets.ts` scrapes, `verify-assets.ts` checks the result offline. Every other package script is the command itself, in `package.json`. |
| `tests/` | Test configuration only; every test sits beside the code it covers. |

The `ALL_*` arrays and the label tables derive from the character tables, and a test asserts every value has a label, so adding a goal or episode cannot silently ship a page with a missing option.

## Deployment

The site is a Cloudflare Worker serving static assets. `wrangler.jsonc` points it at `dist/` and has wrangler run `bun run build` itself, so the deploy workflows do not build beforehand.

`.github/workflows/main.yml` runs the tests, both checks, and the build. `deploy-preview.yml` uploads a preview version for every pull request; `deploy-production.yml` deploys on every push to `main`. Both need `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in repository secrets.

Bun's version is pinned by the `packageManager` field in `package.json`, which `oven-sh/setup-bun` reads automatically. Keep it in sync with `mise.toml` when upgrading.
