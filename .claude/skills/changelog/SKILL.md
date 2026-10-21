---
name: changelog
description: Create or update CHANGELOG.md entries for this project in its fixed format (`## YYYY-MM-DD: <summary>` with BREAKING CHANGES, Features, Improvements, Bug fixes and Decisions sections). Use this whenever the user asks to add, write, update, fix up or reformat a changelog entry, record what shipped, summarise recent commits or a merged PR into the changelog, or says things like "log this change", "add release notes", or "update the changelog" -- even if they don't name the file.
---

# Changelog

`CHANGELOG.md` at the repo root is the project's history of what changed and why. The reasons
don't show up in the code, so the changelog is where they live. Keep that purpose in mind: an
entry that only lists files touched is worth much less than one that says what a reader of the
app, the data or the code will now see differently.

## Entry format

Entries are newest first, directly under the file's intro paragraph.

```markdown
## YYYY-MM-DD: <short summary>

### BREAKING CHANGES

- ...

### Features

- ...

### Improvements

- ...

### Bug fixes

- ...

### Decisions

- ...
```

- **Heading**: `## ` + ISO date + `: ` + a short summary in sentence case, no trailing period.
  The summary names the theme of the entry ("Dark mode and theme settings"), not a list of
  every change. Use today's date for new work unless the user gives one or the
  changes clearly landed on another day (check `git log --date=short`).
- **Sections** always appear in the order above, with exactly these headings. Leave out any
  section that has nothing in it -- don't write `- None`.
- **Nothing else** goes at the `###` level. If a big entry has phases or parts, say so inside
  the bullets (e.g. "Phase B: ...") rather than inventing new headings.

## Which section a change belongs in

Decide by asking how the change relates to the behaviour *before* this entry:

| Section | Ask | Examples |
|---|---|---|
| BREAKING CHANGES | Does something that used to work now work differently, so a user, stored data, or calling code has to adapt? | a removed or renamed route, a renamed component attribute or event, a changed storage key that drops saved data |
| Features | Is this a new thing that didn't exist before? | a new panel, page, setting, component, API endpoint, domain function |
| Improvements | Did an existing thing get better without breaking anyone? | clearer layout, faster load, better wording, refactors worth noting |
| Bug fixes | Did something not work as it was meant to, and now it does? | wrong total, button shown when it shouldn't be, crash on empty input |
| Decisions | Why was it done this way, and what was rejected? | alternatives considered, trade-offs, why no migration |

BREAKING CHANGES works differently from the other three. Features, Improvements and Bug fixes
say *what kind* of change it is, and every change belongs in exactly one of them. BREAKING
CHANGES is an extra flag on top: a change that breaks something appears there **and** in its
own section. Readers use the two views for different things -- BREAKING CHANGES is the
checklist of what they must act on, the rest is the full story of what's new -- so each view
has to be complete on its own.

- Write the two bullets from their own angle, not as copies. The BREAKING CHANGES bullet says
  what stops working and what to do about it; the other says what the change is and gives.
  Example: BREAKING CHANGES "The `/settings` route moved to `/preferences`; update bookmarks."
  plus Features "A `/preferences` page groups theme and language settings."
- A "fix" that changes behaviour someone could reasonably have relied on goes in Bug fixes
  and BREAKING CHANGES.
- A change that only removes something (a route, a prop) has no natural home among the
  three; list it in BREAKING CHANGES alone.
- Internal refactors with no visible effect usually don't need an entry. Include one only when
  it changes how future code must be written (a new convention, a moved module), and file it
  under Improvements -- or BREAKING CHANGES if existing code or imports stop working.
- Commit prefixes are hints, not rules: `feat:` is often an improvement to something existing,
  and `ci:`/`chore:`/`docs:` changes rarely belong unless they affect deployment or users.

## Writing the bullets

Match the voice of the existing file:

- Plain, complete sentences. Say what changed and, briefly, the effect or reason.
- Wrap code identifiers, keys, paths, routes and values in backticks: `HelloWorld`,
  `app:theme`, `/about`, `data-variant="quiet"`.
- One idea per bullet; wrap lines at about 95 characters with a two-space continuation indent.
- Say what a reader will notice, not the commit mechanics. "The menu starts collapsed on
  phones" beats "Updated site-menu.ts to set open=false".
- Put the *why* in Decisions when it's a real choice between options (and name the rejected
  option). A short "because ..." inside the bullet is fine for small things.

## Workflow

### Adding an entry for new work

1. Read `CHANGELOG.md` to find the newest entry's date and see the current voice. If the file
   does not exist yet, create it with a `# Changelog` heading and a one-line intro paragraph
   ("What changed in this project and why, newest first.") before adding the first entry.
2. Gather the changes. If the user described them, use that. Otherwise look at what landed
   since the last entry: `git log --date=short --format='%h %ad %s' <since>..HEAD` and, for
   anything unclear, `git show --stat <sha>` or the diff. Merged PR bodies often hold the
   reasons -- read them for the Decisions section.
3. Group related commits into one bullet. Several commits that together restyle three pages
   are one improvement, not three.
4. Sort each change into Features, Improvements or Bug fixes, then ask separately whether it
   also breaks anything and, if so, add it to BREAKING CHANGES too.
5. If an entry for the same date already exists, extend it instead of adding a second heading
   with that date: add bullets to its sections and extend its title with `, and <this
   change>`.
6. Insert the entry above the current newest entry and show the user the result.

### Updating an existing entry

Edit in place. Keep the date unless the user asks to change it. If you move an item between
sections, keep the section order and drop any section that becomes empty.

### Reformatting an old-style entry

Older entries may use `### Added`, `### Changed`, `### Phase ...` or other headings. When
converting one, re-sort every bullet using the table above rather than mapping headings
one-to-one: "Changed" usually splits between Improvements and Bug fixes, "Added" is usually
Features, and any of them may also need a BREAKING CHANGES bullet. Keep every fact and every reason -- reformatting must not lose history.
Keep `### Decisions` as it is.

## Don'ts

- Don't rewrite the file's intro paragraph or reorder existing entries.
- Don't invent reasons. If the why isn't in the conversation, commits, PR or code, leave the
  Decisions section out or ask the user.
- Don't pad sections with trivia to make them look full.
