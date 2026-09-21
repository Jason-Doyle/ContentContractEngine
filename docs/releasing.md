# Maintainer Release Process

Releases use npm trusted publishing from `.github/workflows/release.yml`. GitHub
supplies a short-lived OIDC identity, so the repository does not store an npm
publish token. npm generates provenance automatically for trusted publishing
from a public repository.

## First publication

npm requires the package to exist before its trusted publisher can be
configured.

1. Make the GitHub repository public.
2. In GitHub repository settings, open the existing `npm` environment and add
   `Jason-Doyle` as a required reviewer. Leave self-review enabled because this
   is currently a single-maintainer repository.
3. Merge the reviewed release change, fast-forward local `main`, create the
   immutable tag, and push it:

   ```powershell
   git switch main
   git pull --ff-only
   git tag -a v0.1.0 -m "v0.1.0"
   git push origin v0.1.0
   git switch --detach v0.1.0
   ```

4. Sign in to npm with an owner account protected by two-factor authentication.
5. From the checked-out `v0.1.0` tag, run:

   ```powershell
   npm ci
   npm run qa
   npm run release:check -- v0.1.0
   npm publish
   ```

6. Open the package settings on npm and add a GitHub Actions trusted publisher:
   - organisation or user: `Jason-Doyle`
   - repository: `ContentContractEngine`
   - workflow: `release.yml`
   - environment: `npm`
7. Set publishing access to require two-factor authentication and disallow
   traditional tokens.
8. Create the `v0.1.0` GitHub release from the existing tag. The workflow
   verifies that npm's published `gitHead` matches the release commit and does
   not publish the version again.

The first manual publication cannot carry GitHub Actions provenance. Later
versions do.

## Later releases

1. Update `package.json`, every published schema `$id`, and `CHANGELOG.md`.
2. Run `npm run qa` and `npm run release:check -- vX.Y.Z`.
3. Merge the reviewed change.
4. Create and publish the matching GitHub release.

The release workflow checks out the tag, reruns the complete quality suite,
validates the tag and schema IDs, and publishes through OIDC. GitHub prereleases
use the npm `next` tag.

Never move a published release tag or reuse a package version.
