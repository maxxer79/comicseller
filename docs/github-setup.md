# Getting Comicseller onto GitHub — step by step

You only do the one-time setup once. After that, shipping an update is 3 commands.

## 0. Prerequisites (one time)

- **A GitHub account** — sign in or create one at https://github.com (use your
  robert.a.agron@gmail.com email).
- **Git installed on your PC** — https://git-scm.com/download/win. During
  install, keep the default that includes **Git Credential Manager** (handles
  login automatically).
- Optional but easiest for auth: **GitHub CLI** — https://cli.github.com. If you
  install it, run `gh auth login` once and pushing "just works."

## 1. Create an empty repo on GitHub

1. Go to https://github.com/new
2. **Repository name:** `comicseller`
3. **Private** (recommended) or Public — either works.
4. **Do NOT** check "Add a README", ".gitignore", or "license" — the project
   already has these. The repo must start empty.
5. Click **Create repository**.
6. Leave that page open — you'll need the URL, which looks like
   `https://github.com/maxxer79/comicseller.git` (this is your repo path).

## 2. Push the code (run in your project folder)

Open **PowerShell** (or Git Bash) and run these, replacing `maxxer79`:

```powershell
cd C:\dev\Comicseller
git init
git add .
git commit -m "Comicseller v0.2.1"
git branch -M main
git remote add origin https://github.com/maxxer79/comicseller.git
git push -u origin main
```

On `git push`, a browser window pops up to sign in to GitHub (Git Credential
Manager). Approve it once and it remembers you.

> If it says `remote origin already exists`, run
> `git remote set-url origin https://github.com/maxxer79/comicseller.git`
> and push again.

## 3. Watch CI build it

1. On your repo page, open the **Actions** tab.
2. You'll see the **CI** workflow running. It typechecks and builds both apps,
   then builds the Docker image and pushes it to GitHub Container Registry.
3. Green check = everything works. First run takes a few minutes (it builds for
   both amd64 and arm64).

## 4. Make the image pullable by your NAS

1. On your repo page (or your profile), open **Packages** → the `comicseller`
   package.
2. **Package settings** → **Change visibility** → **Public** (simplest), so
   Portainer can pull it with no login.
   - Prefer to keep it private? Instead, in Portainer add a registry
     (`ghcr.io`, your username, a token with `read:packages`).

## 5. Deploy on the NAS

Follow [deployment-portainer.md](deployment-portainer.md): add the stack, set
`JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, deploy, open `http://<NAS-IP>:4000`.

## Shipping an update later

Any time we change the app:

```powershell
cd C:\dev\Comicseller
node scripts/bump-version.mjs        # bumps the version so it shows in the app
git add .
git commit -m "Describe the change"
git push
```

CI rebuilds the image automatically; then in Portainer **re-pull & redeploy** the
stack. The new version number appears in the app header and Admin page.

## Alternative: let Claude push for you

Instead of the CLI, you can authorize the **GitHub connector** in Claude
(Settings → Connectors → GitHub). Once it's connected, tell Claude and it can
create the repo and push directly — no terminal needed.
