# Hosting MARGIN CALL on Render, with leaderboards

The game you run with `npm start` is the **local version**. This guide puts the same game on the
internet as the **hosted version**, with three **leaderboards** that every player can see.

There is only one copy of the game. Both versions are served from the same files on the same
branch, so anything added to the game reaches both: `npm start` updates the local version, and
Render redeploys the hosted one by itself. The leaderboards are kept in a separate database that a
deploy never touches, so updates never wipe them.

It takes about 15 minutes and costs nothing.

---

## What you will set up

| Piece | What it does | Cost |
|---|---|---|
| **Render** web service | Runs `server/hosted.mjs`: serves the game and the leaderboard API, and redeploys whenever the game's branch changes | Free (sleeps when nobody is playing; see below) |
| **Upstash** Redis database | Holds the leaderboards, outside Render, so redeploys cannot wipe them | Free |

You need a GitHub account with access to this repository. You already have one.

---

## Step 1 — Make the database (Upstash)

1. Go to **https://upstash.com** and sign up. The *Continue with GitHub* button is quickest.
2. In the console, open **Redis** and click **Create Database**.
   - **Name:** `margin-call`
   - **Type / region:** pick the region closest to where you will run Render. Render's default
     region is *Oregon (US West)*, so choose a US West region if you are not sure.
   - **Plan:** Free.
   - Click **Create**.
3. On the database's page, scroll to the **REST API** section and find the two values:
   - `UPSTASH_REDIS_REST_URL`, which looks like `https://something-12345.upstash.io`
   - `UPSTASH_REDIS_REST_TOKEN`, a long string

   Keep this tab open. You will paste both into Render in step 2.

> The token is a password to your leaderboard data. Paste it into Render and nowhere else, and
> never commit it to GitHub.

---

## Step 2 — Put the game on Render

1. Go to **https://render.com** and sign up with **GitHub**.
2. In the dashboard, click **New +** (top right) and choose **Blueprint**.
3. Connect your GitHub account if asked, and give Render access to the **Daytradinggame**
   repository.
4. Pick the repository. For **Branch**, choose the game's default branch,
   **`claude/roguelike-day-trading-game-vy5qsg`**. That is the branch every release is merged into,
   so it always holds the newest version.
5. Render reads `render.yaml` from the repository and shows one service, **margin-call**. It asks
   for the two values it cannot know. Paste them from Upstash:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`

   `ADMIN_TOKEN` is filled in for you with a random value. It is your moderator key; see step 5.
6. Click **Apply** (or **Deploy Blueprint**). The first deploy takes a minute or two.
7. When it says **Live**, open the address Render gives you, something like
   `https://margin-call-abcd.onrender.com`. That is your hosted game. Send it to your friends.

### Check it is set up right

Open `https://YOUR-ADDRESS.onrender.com/api/health` in your browser. You should see:

```json
{"ok":true,"game":"margin-call","version":"v1.14.0", ... "storage":{"kind":"upstash","persistent":true}, ...}
```

- `"kind":"upstash"` and `"persistent":true` mean the leaderboards are safe across updates.
- If it says `"kind":"local"`, the two Upstash values did not arrive. Go to your service, then
  **Environment**, add them, and click **Save, rebuild and deploy**. Until then, scores are lost
  on every deploy.

On the game's title screen there is now a **LEADERBOARDS** card. It only appears on the hosted
version.

---

## Step 3 — Updates are automatic

Every time a new version of the game is merged into the default branch, Render rebuilds and
redeploys the hosted game on its own, usually within a couple of minutes. Nothing to do.

- **The leaderboards stay.** They live in Upstash, not on the machine Render rebuilds.
- **Players who have the game open get a banner** saying a new version is live, with a button to
  reload. Their run is saved, mid-deadline included, so reloading loses nothing.
- To see or control this, open the service in Render, then **Settings → Build & Deploy**.
  **Auto-Deploy** should be **On Commit**. **Events** lists every deploy, and **Manual Deploy →
  Deploy latest commit** forces one.

The local version keeps updating itself as before: `npm start` pulls the newest version before it
opens.

---

## Step 4 — The leaderboards

There are three boards. Each trader holds **one place on each**. When you beat your own best, your
entry moves up to the new score, and the old one is replaced, never added to. One player cannot
fill a board.

| Board | What it ranks |
|---|---|
| **THE CAMPAIGN** | The biggest single trade booked in weeks 1–8, before endless mode |
| **ENDLESS** | The biggest single trade booked from week 9 on, in endless mode |
| **OVERKILL** | The most a quota was ever buried by: profit ÷ quota in one deadline (×37.2 means you booked 37.2 times what you needed) |

How players appear:

- **No sign-up.** The first time someone plays the hosted game, their browser becomes a *trader*
  with a random name like *Bullish Otter 42*. They can rename themselves in **LEADERBOARDS**.
  Names are unique: two traders cannot share one, in any mix of upper and lower case.
- **Bests go in the moment they happen**, so closing the tab never loses one. If the internet
  drops, the best waits in the browser and is sent later.
- **Another device:** LEADERBOARDS shows a *trader code*. Entering it on another device carries
  the same trader across. Treat it like a password: whoever has it can post as you.

---

## Step 5 — Moderating (removing a cheater, backups)

Scores are reported by each player's own browser. Someone technical could send a fake one. The
**admin token** lets you remove an entry, ban a trader, or take a backup.

Find it in Render: your service, then **Environment**, then **ADMIN_TOKEN**. Click the eye to reveal
it.

In each command below, replace `TOKEN` with your admin token and `ADDRESS` with your Render
address.

**macOS / Linux (Terminal):**

```bash
# a backup of every board, saved as a file
curl -H "Authorization: Bearer TOKEN" https://ADDRESS/api/admin/export -o leaderboards-backup.json

# take one trader off one board (leave out "board" for every board)
curl -X POST -H "Authorization: Bearer TOKEN" -H "Content-Type: application/json" \
     -d '{"name":"Cheaty McCheat","board":"campaign"}' https://ADDRESS/api/admin/remove

# ban a trader: off every board, and nothing they post shows again ("on":false lifts it)
curl -X POST -H "Authorization: Bearer TOKEN" -H "Content-Type: application/json" \
     -d '{"name":"Cheaty McCheat"}' https://ADDRESS/api/admin/ban

# how many traders and entries there are, and where they are stored
curl -H "Authorization: Bearer TOKEN" https://ADDRESS/api/admin/stats
```

**Windows (PowerShell):**

```powershell
$h = @{ Authorization = "Bearer TOKEN" }
Invoke-RestMethod -Headers $h https://ADDRESS/api/admin/export -OutFile leaderboards-backup.json
Invoke-RestMethod -Method Post -Headers $h -ContentType "application/json" `
  -Body '{"name":"Cheaty McCheat"}' https://ADDRESS/api/admin/ban
```

To **restore a backup**, POST it back as `{"doc": <the backup>}` to `/api/admin/import`. This
replaces every board, so take a fresh backup first.

---

## Good to know

- **The free plan sleeps.** After 15 minutes with no visitors, Render stops the free service. The
  next visitor waits about a minute while it wakes. The leaderboards are not affected. To keep it
  always on, change the instance type to **Starter** (paid) in **Settings**.
- **Run the hosted version on your own computer** to try it before deploying:

  ```bash
  npm run hosted          # then open http://localhost:10000
  ```

  Without the Upstash values set, it keeps the boards in `data/leaderboards.json` in the game
  folder. Git ignores that folder.
- **No Upstash?** On a paid Render instance you can use a disk instead. In the service, open
  **Disks → Add Disk**, set the mount path to `/var/data`, then add the environment variable
  `DATA_DIR=/var/data` and remove the two Upstash ones. A disk also survives deploys.
- **Changing the boards later:** they are defined in `server/leaderboard.mjs` (`BOARDS`), and the
  game posts to them from `src/main.js` (search for `Online.record`). A board added later starts
  empty; the others keep their data.
