# FediScope

A personal read-only reader for selected public Fediverse sources and RSS/Atom feeds. ActivityPub is recipient-based federation, not a global firehose; this app never offers complete coverage or global search.

## Features

- Read public Mastodon, Pixelfed, PeerTube, Lemmy, and RSS/Atom sources in one feed.
- Filter by platform or content type, search loaded posts, and save bookmarks.
- Pause or remove sources and open posts on their original service.
- Keep reader state locally in SQLite.

## Getting started

Install Node.js 22 or newer and npm. If you use nvm, run `nvm install` and `nvm use` to select the version in `.nvmrc`.

From the repository root:

```sh
npm ci
npm run dev
```

Open http://localhost:5101 and add a public server or feed. No API keys or environment variables are required.

The Express server listens on `0.0.0.0:5101`; Vite middleware serves React and the same origin serves `/api`. The health endpoint is `/api/health`. Port 5101 must be available.

SQLite is stored in `data/fediscope.db` (ignored by git). This initial deployment is a single shared personal workspace; sources, bookmarks, loaded posts and filter preferences are shared by visitors. There are no accounts or native social interactions.

## Development and validation

```sh
npm run check   # TypeScript validation
npm test        # Adapter and URL safety tests
npm run build  # Build the frontend into dist/
```

The current server runs through `npm run dev` and uses Vite middleware. The build command produces frontend assets only; serving `dist/` alone does not provide the API or SQLite backend. GitHub Pages cannot host the full app. Use a Node.js host with writable persistent storage for `data/`. This version has no authentication, so restrict access to the running app if your sources or bookmarks should remain private.

The native SQLite dependency may require a C/C++ build toolchain and Python if a prebuilt binary is unavailable for your system.

## Repository contents

- `src/`: React interface and styles.
- `server/`: Express API, SQLite persistence, source adapters, URL safety checks, and tests.
- `package-lock.json`: dependency lockfile; use `npm ci` for installation.
- `.github/workflows/ci.yml`: automated checks, tests, and frontend build.

Local databases, environment files, dependencies, build output, and browser verification artifacts are excluded by `.gitignore`. Keep credentials and personal reader data out of commits.

## Contributing

Describe the problem or proposed change in an issue or pull request. Run the validation commands above before submitting code. Tests use deterministic fixtures and do not require live services.

## License

FediScope is licensed under the [GNU Affero General Public License v3.0 only](LICENSE) (`AGPL-3.0-only`).

If you distribute a modified or combined work covered by this license, you must license that covered work under the AGPL and provide its corresponding source as required by the license. If you modify FediScope and let users interact with it over a network, you must prominently offer those users access to the corresponding source of your version at no charge.

Commercial use is allowed. Private use without distribution or remote network interaction does not require publishing source, and independent software is not automatically covered merely because it runs alongside FediScope. Third-party dependencies retain their own licenses. See the full license for the governing terms.

## Adapters and policies

- Mastodon-compatible and Pixelfed: `/api/v1/timelines/public?local=true&limit=20`, `max_id` pagination. Pixelfed explicitly reports unavailable compatible capability. Restricted timelines need authentication, which is outside this version.
- PeerTube: `/api/v1/videos`, chronological publication order, offset pagination. Videos open on their original service, with no embedded player or autoplay.
- Lemmy: stable v3 `/api/v3/post/list`, `New`, `Local`, `next_page` cursor. Servers that remove v3 report an error.
- RSS/Atom: direct feed URL, bounded publisher-provided entries; no invented pagination.

Normalized objects retain author, server, canonical URL, published date, warnings, image descriptions, and adapter/remote-ID metadata. Canonical URLs deduplicate across subscriptions. HTML is allowlist-sanitized, sensitive content is collapsed, and outbound links allow HTTP(S). Source subscriptions can be paused or removed; bookmarked posts survive source removal. Search covers loaded content only. At most 2,000 chronological posts are cached.

Outbound fetches use DNS validation and pinned validated addresses, reject nonpublic IP ranges (including mapped IPv6 and CGNAT), revalidate every redirect, permit only HTTP(S) on standard ports, cap bodies at 3 MB and requests at 12 seconds, cache for 60 seconds and space requests per host. A failing source cannot suppress other sources. There is no crawler, inbox, OAuth, or federated posting.

## Primary references verified during implementation

- https://www.w3.org/TR/activitypub/
- https://docs.joinmastodon.org/methods/timelines/
- https://docs.joinpeertube.org/api/rest-getting-started
- https://docs.joinpeertube.org/api-rest-reference.html
- https://join-lemmy.org/docs/contributors/04-api.html
- https://join-lemmy.org/docs/contributors/09-api-v4.html

Live smoke checks on implementation: Mastodon.world (20 posts), framatube.org (20 videos), lemmy.world (20 discussions), W3C blog feed (25 entries). Mastodon.social rejected anonymous access. Automated tests use deterministic adapter fixtures and local URL validation; they do not depend on upstream uptime.
