# Checking the parish's Evolution CMS — two settings that shape the import

IMPORT.md assumes the parish runs Evolution CMS 1.4.x. That is *reported and
unconfirmed*, and one system setting — the chunk processor — changes how a
file-based import would be written. This file is the checklist for settling
both questions from a browser, with an ordinary editor login. No shell, no
database, nothing a visitor can see.

Every menu path and label below was verified against a real Evolution 1.4.18
manager in the local sandbox (`npm run evo:up`) on 13 August 2026, not guessed
from documentation.

**Why these two questions matter:** chunk bodies can live as files on disk via
an `@FILE` binding instead of being pasted into the manager one at a time —
verified end-to-end in the sandbox on both processors, all 696 rendering
assertions passing. But the binding *dialect* depends on the
`chunk_processor` setting, and the two dialects fail silently into each
other. Read the setting first; then pick the dialect. Details in the table at
the end.

---

## Before you start

- Checks A and B are read-only. Check C creates and deletes a few things on
  the live site — all invisible to visitors and fully reversible, but skip it
  if you would rather clear it with DIM first.
- Use your own manager credentials (IMPORT.md §2). If a screen does not match
  what is described here, stop and write down what you see instead.

## A. Confirm the version

1. Log in at `https://www.nativity.va.goarch.org/manager/`.
2. In the top toolbar, open the icon menu titled **System** (a gear icon,
   near your username at the top right).
3. Click **System Info**.
4. Record the **EVO version** row, and the **Release date** row while you are
   there.

**Reading the answer.** Anything starting `1.4` (or `1.` generally) confirms
the platform everything in this repo was rehearsed against. One caveat: the
displayed number can lag by one patch release — the official 1.4.18 package
ships a version constant that still reads "1.4.17" — so do not read anything
into an off-by-one. A version starting `3.` means a differently organised
manager and the sandbox's `evo35` instance is the rehearsal target instead.

If **System Info** is missing from the menu, your account lacks the `logs`
permission. The version question then joins the DIM list at the foot of
IMPORT.md.

## B. Read the two parser settings

1. Same **System** menu → **Configuration**.
2. You land on the first tab, **Site**. Scroll to the row labelled
   **"Chunks processing class"** (`[(chunk_processor)]` in small print
   beneath it). Record which radio is selected: **DocumentParser** or
   **DLTemplate**.
3. The row directly below is `[(enable_at_syntax)]`. Record Yes or No.
4. **Leave the page without saving.** The form saves every setting at once;
   an accidental Save could change things you never touched.

**Reading the answer.** This is a dialect selector, not a go/no-go gate —
both processors support file-based chunks (see the table below).
`enable_at_syntax` does not gate `@FILE` either way; record it because it
changes how a stray `{{` followed by a space is handled.

## C. Optional: the five-minute probe that settles it outright

This proves the file binding works on the parish's actual installation and
simultaneously answers IMPORT.md's question about uploading under `assets/`.
The public gets the site's normal 404 for the whole duration; only your
logged-in manager session can see the probe page.

1. **Elements → Manage Files.** Navigate into `assets/`, create a folder
   `chunks` if it does not exist, and upload a file
   `ntgoc-atfile-probe.html` containing one plain line, such as
   `PROBE-OK: this text came from a file on disk.`
   (`.html` is on EVO's default upload allowlist. If the upload is refused,
   that is itself an answer — record it and stop.)
2. **Elements → Chunks → New Chunk.** Name it `ntgocAtFileProbe`. The body
   depends on what step B found:
   - DocumentParser: `{{@FILE:assets/chunks/ntgoc-atfile-probe.html}}`
   - DLTemplate: first re-upload the file under `assets/templates/` instead,
     then use `{{@FILE:ntgoc-atfile-probe}}` — DLTemplate resolves relative
     to `assets/templates/` and appends `.html` itself.
   Paste exactly, with **no space after `{{`** — with a space the tag is
   escaped to a literal and the test silently fails.
3. Create a new resource: any title, content exactly `{{ntgocAtFileProbe}}`,
   **Published unchecked**, **Rich Text unchecked** (the TinyMCE warning in
   IMPORT.md §3 applies even to a probe).
4. Save, then click **Preview**. You can view the unpublished page because
   you are logged into the manager; visitors cannot.
5. Read the result:
   - **"PROBE-OK…"** — the file binding works on the live installation; the
     upload-a-folder import path is real.
   - **The literal `{{…}}` text survives** — the parser did not consume the
     tag; cross-check step B, and re-check for a space after `{{`.
   - **"Could not retrieve string '…'"** (DocumentParser) — the binding works
     but the file is not where expected; check where Manage Files actually
     put it.
   - **The block is simply blank** (DLTemplate) — same meaning as the error
     string above, but silent; this is DLTemplate's failure mode.
6. Clean up in reverse: delete the probe resource (then purge it — deleted
   resources sit in the trash until emptied), delete the chunk, delete the
   uploaded file, and finish with **Tools → Clear Cache**.

## Recording the answers

- The version goes in `data/parish-facts.json`, where it is currently
  recorded as reported-unconfirmed.
- The processor and `enable_at_syntax` values, and the probe outcome, belong
  against the question list at the foot of IMPORT.md.

---

## Appendix: what the two processors mean for a file-based import

Verified in the sandbox on 13 August 2026 by repointing every chunk to
files under each processor in turn; both configurations passed all 696
rendering assertions then current, byte-identical to the database-hosted
chunks. `ntgocPhiloptochosBoard` was added later the same day: it has been
through `npm run evo:verify` on both versions (698 assertions, 0 failed) but
not through the file-based repointing above.

|  | DocumentParser (default) | DLTemplate |
|---|---|---|
| Stub chunk body | `{{@FILE:assets/chunks/ntgoc/foo.html}}` | `{{@FILE:ntgoc-chunks/foo}}` |
| File location | searches `assets/tvs/`, `assets/chunks/`, `assets/templates/`, then site root | under `assets/templates/` only, extension `.html` appended automatically |
| Bad path renders as | visible text: "Could not retrieve string '…'." | empty string — the block silently vanishes |
| Refused outright | `.php` files; anything under `manager/` | any path escaping `assets/templates/` |
| Plain `{{chunkName}}` DB chunks | unaffected | unaffected |

Notes that apply to both:

- A chunk whose entire body is the one-line binding keeps the chunk visible
  in the manager tree while its content lives in the file. File content is
  parsed exactly like a chunk body — nested chunk calls work, and EVO's
  reserved sequences are exactly as dangerous in a file as anywhere else.
- After replacing a file, finish with **Tools → Clear Cache**. A cached page
  serves the old content until then. (Stock 1.4.18 has a caching quirk that
  often masks this; do not rely on it — the parish's build may differ.)
- The dialects are mutually silent-failing. A DocumentParser-style binding
  under DLTemplate renders as an empty string, and vice versa produces an
  error string. Never mix them, and after any bulk upload open one page and
  confirm each block is actually present.
