# Versioning

There is one source of truth for the app version: the **`VERSION`** file at the
repo root (currently `0.2.0`). It follows semver (`MAJOR.MINOR.PATCH`).

## Where it shows up

- The header shows `v<version>` on every page.
- **Admin → Version & build** shows the version plus the git commit (`buildSha`)
  and build time that CI stamped into the image, and the environment.
- API: `GET /version` returns `{ version, buildSha, buildTime, nodeEnv }`.

At image build time, CI passes `BUILD_SHA` (the commit) and `BUILD_TIME`, so a
deployed container can always tell you exactly which build it's running.

## Bumping the version each update

Run the bump script, which updates `VERSION` and both `package.json` files so
everything stays in sync:

```bash
node scripts/bump-version.mjs          # patch: 0.2.0 -> 0.2.1
node scripts/bump-version.mjs minor    # 0.2.1 -> 0.3.0
node scripts/bump-version.mjs major    # 0.3.0 -> 1.0.0
node scripts/bump-version.mjs 1.4.2    # set exactly
```

Then commit and push:

```bash
git add VERSION backend/package.json frontend/package.json
git commit -m "Release vX.Y.Z"
git push
```

CI rebuilds the image with the new `VERSION` baked in; after you redeploy in
Portainer, the new number appears in the app.

## Convention

- **patch** — bug fixes, copy tweaks, small changes.
- **minor** — new features (a new page, a new workflow step).
- **major** — breaking changes or big milestones (e.g. eBay auto-posting going live).

Tip: bump as the last step of each change so every deploy has a distinct,
visible version.
