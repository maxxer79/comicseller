# Deploying Comicseller to your Docker NAS with Portainer

This runs the whole app as **two containers** — the Comicseller app (one image,
serving both the API and the web UI) and Postgres — from a Portainer stack that
pulls the image CI built and pushed to GitHub Container Registry (GHCR).

## Prerequisites

1. Code is on GitHub and the **CI workflow has run on `main`** (green), so an
   image exists at `ghcr.io/maxxer79/comicseller`. Check the repo's **Actions** tab and
   **Packages** section.
2. Portainer is installed on your NAS and connected to its Docker environment.

## 1. Make the GHCR image pullable

By default GHCR packages are private. Two options:

- **Easiest:** in GitHub → your repo → **Packages** → the `comicseller` package
  → **Package settings** → **Change visibility** → **Public**. Then Portainer can
  pull with no credentials.
- **Private:** keep it private and add registry credentials in Portainer
  (**Registries → Add registry → Custom**, URL `ghcr.io`, your GitHub username,
  and a Personal Access Token with `read:packages`). Then select that registry
  on the stack's image.

## 2. Create the stack

In Portainer: **Stacks → Add stack**, name it `comicseller`, and paste the
contents of [`deploy/portainer-stack.yml`](../deploy/portainer-stack.yml).

The image is already set to `ghcr.io/maxxer79/comicseller` — no edit needed.

## 3. Set environment variables

In the stack's **Environment variables** section add:

| Variable | Required | Notes |
|---|---|---|
| `JWT_SECRET` | ✅ | Long random string. Generate: `openssl rand -base64 48` |
| `ADMIN_EMAIL` | ✅ | Your login email — first admin is auto-created on first boot |
| `ADMIN_PASSWORD` | ✅ | Strong password (min 8 chars) |
| `DB_PASSWORD` | recommended | Postgres password; defaults to `comicseller` if unset |
| `ANTHROPIC_API_KEY` | optional | Enables AI identification |
| `APP_PORT` | optional | Host port, defaults to `4000` |
| `ADMIN_NAME` | optional | Display name |
| `VISION_MOCK` | optional | `1` to test identify without an API key |
| `DATA_DIR` | optional | Base folder on the NAS for data; defaults to `/volume1/docker/comicseller` |

### Prepare the data folder (UGREEN NAS)

Data is bind-mounted to your NAS folder so it lives on `/volume1` and is easy to
back up. Before deploying, create the two subfolders (via SSH or the file
manager):

```bash
mkdir -p /volume1/docker/comicseller/db
mkdir -p /volume1/docker/comicseller/storage
```

- `db/` — Postgres database files
- `storage/` — uploaded comic photos

If you put the app somewhere other than `/volume1/docker/comicseller`, set the
`DATA_DIR` environment variable to that base path and create `db/` and
`storage/` under it.

Then **Deploy the stack**.

## 4. First run

- On boot the app syncs the database schema automatically (`prisma db push`) and
  seeds your admin account from `ADMIN_EMAIL` / `ADMIN_PASSWORD`.
- Open `http://<NAS-IP>:4000` and sign in.
- Change nothing else — photos persist in `/volume1/docker/comicseller/storage`
  and the database in `/volume1/docker/comicseller/db`.

## 5. Updating

When CI pushes a new image after you commit:

1. In Portainer open the `comicseller` stack.
2. **Pull and redeploy** (enable "re-pull image") — or on the container, use
   **Recreate** with "Pull latest image".

The app version shown in the header and Admin page comes from the `VERSION` file
baked into the image, so after redeploy you'll see the new version. See
[versioning.md](versioning.md).

## Notes

- The image is multi-arch (amd64 + arm64), so it runs on Intel Synology/Unraid
  and ARM boards alike — Docker pulls the right one automatically.
- Back up `/volume1/docker/comicseller` (both `db/` and `storage/`) as part of
  your NAS backup routine — everything lives there.
- To put it behind HTTPS, front it with your existing reverse proxy (Nginx
  Proxy Manager, Traefik, Caddy) pointing at the app container's port 4000.
