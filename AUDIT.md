# Publication audit

Two rounds with the course audit prompt, run by Claude Code (Claude Sonnet 5.5) from the project root. The audit passes were read-only; fixes were made afterwards. The same assistant helped build the project, so this is not an independent review.

## Round 1

- **Date:** 2026-11-25
- **Commit audited:** `8f690cd`

### What was checked

- Git status, tracked and ignored files, and every file path in the history of all branches.
- Pattern search of all commits for API keys, tokens, passwords and private keys. The pattern was tested against fake samples.
- Tracked text for email addresses and local user paths; commit author metadata; PNG text and EXIF chunks.
- `.gitignore`, `.env.example`, `package.json` against `package-lock.json`, imported packages, lockfile download hosts.
- Source code, tests and README against the required topics.
- That the repository page opens without being logged in (HTTP 200).

No secrets, local paths or tracked `.env`, `data/` or `node_modules/` files were found.

### Findings and decisions

| # | Type | Finding | Location | Decision and fix |
|---|---|---|---|---|
| 1 | Confirmed | Lockfile listed different versions and license than `package.json`, so `npm ci` failed. First noticed during installation, just before this audit. | `package-lock.json` | **Fixed:** regenerated from `package.json`. |
| 2 | Confirmed | Learning section described no challenge or how it was approached. | `README.md` | **Fixed:** added the lockfile challenge. |
| 3 | Confirmed | Audit record was an empty template. | `AUDIT.md` | **Fixed:** this document. |
| 4 | Improvement | `.env.local` and similar files were not ignored. | `.gitignore` | **Fixed:** added `.env.*`, keeping `.env.example`. |
| 5 | Improvement | A watchlist file configured outside `data/` would not be ignored. | `.env.example` | **Fixed:** comment now says to keep it inside `data/`. |
| 6 | Improvement | Placeholder file no longer needed. | `docs/screenshots/.gitkeep` | **Fixed:** removed. |
| 7 | Improvement | The 28 reported tests include a helper file that contains no test. | `test/fixtures.js` | **Documented** in the README; no code change. |
| 8 | Improvement | AI assistance note did not mention the audit or the lockfile fix. | `README.md` | **Fixed.** |
| 9 | Improvement | `package.json` says MIT, but there is no `LICENSE` file. | repository root | **Open:** the choice of license is the author's. |
| 10 | Possible concern | Commit metadata includes the author's name, and some commits use a private relay email address. | Git history | **Accepted:** a relay address hides the real one; history was not rewritten. |
| 11 | Possible concern | The server does not check the `Host` header (DNS rebinding). | `src/app.js` | **Accepted:** listens on localhost only and holds only a watchlist. |
| 12 | Possible concern | Screenshots show posters and cast photos served by TVmaze; rights to individual images may differ from the data license. | `docs/screenshots/` | **Accepted** for coursework, with attribution in the README. |

### Checks after the fixes

`npm ci` on a fresh copy of the files succeeded with 0 reported vulnerabilities, and `npm test` reported 28 passed, 0 failed. The ignore rules were checked for `.env`, `.env.local`, `data/` and `node_modules/`.

## Round 2

- **Date:** 2026-11-25
- **Commit audited:** `961e835`

### What was checked

The same prompt and the round 1 checks, repeated on the updated commit. Additionally: README section headings and relative links, environment variables used against `.env.example`, and the content of the default branch.

### Results

- No secrets, local paths or email addresses in tracked text, and no secret patterns in any commit.
- `package-lock.json` and `package.json` match on name, license, dependencies and Node version.
- All seven README topics are present, relative links resolve, and both environment variables are documented.

### Findings and decisions

| # | Type | Finding | Location | Decision and fix |
|---|---|---|---|---|
| 13 | Confirmed | The default branch does not yet contain the app, so the README setup steps only work after the merge. | `main` | **To resolve** by merging the pull request for this branch. |
| 14 | Improvement | Limitations did not mention missing error messages on the watchlist page, request timeouts or a cache size limit. | `README.md`, `public/app.js`, `src/tvmaze.js` | **Documented** in the README; code unchanged. |
| 15 | Possible concern | Setup claims Node.js 20 or newer, but only Node.js 26 on macOS was used. | `README.md`, `package.json` | **Documented** in the README. |

### Remaining limitations and accepted risks

- No `LICENSE` file (finding 9).
- Author name and relay email address in Git history (finding 10).
- No `Host` header check (finding 11).
- Rights to individual TVmaze images (finding 12).
- The watchlist page error handling, request timeout and cache limit (finding 14).

### Not verified

- Behaviour on Node.js 20, Windows or Linux.
- The two other course projects and any shared root README; this audit covers this project only.
- A pattern search and manual review cannot prove that no sensitive data or security problem exists.
