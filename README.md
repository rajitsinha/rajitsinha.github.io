# Portfolio site — Rajit Sinha

Static site. No build step, no dependencies.

## Before you publish

### 1. GitHub link — already done

Both GitHub links now point to `https://github.com/rajitsinha`. Nothing to edit.

### 2. Check the résumé

Confirm `assets/rajit-sinha-resume.pdf` is the version you want people downloading.

## Publish on GitHub Pages (free)

You do not need to install anything or use the command line. All of this happens in the browser.

**Step 1 — make the repository**
1. Go to https://github.com/new (sign in as `rajitsinha`)
2. Repository name: `rajitsinha.github.io` — type it exactly, including the `.github.io`
3. Leave it **Public**
4. Do NOT check "Add a README file"
5. Click **Create repository**

**Step 2 — upload the site**
1. On the empty repo page, click **uploading an existing file** (in the "quick setup" text)
2. Unzip `portfolio-site.zip` on your computer, then open the `portfolio` folder
3. Drag `index.html`, `README.md`, and the whole `assets` folder into the browser window

   Important: drag the *contents* of the `portfolio` folder, not the folder itself. `index.html` has to end up at the top level of the repo.
4. Scroll down, click **Commit changes**
5. Wait for the upload to finish — the videos are the slow part, give it a few minutes

**Step 3 — turn on Pages**
1. In the repo, click **Settings** (top right)
2. In the left sidebar, click **Pages**
3. Under "Build and deployment", set Source to **Deploy from a branch**
4. Branch: `main`, folder: `/ (root)` — click **Save**

**Step 4 — check it**

Wait about two minutes, then open:

    https://rajitsinha.github.io

If you see a 404, wait another minute and refresh — the first build takes a moment.

### Fixing things later
Open the file in the repo, click the pencil icon, edit, then **Commit changes**. The live site updates on its own within a minute.

## Editing
- All copy is plain text in `index.html`
- Numbered callouts on photos are `<span class="balloon" style="left:__%;top:__%">` — percentages are positions on that image
- Colors and fonts are CSS variables at the top of the `<style>` block

## Local preview
    python3 -m http.server 8000
Then open http://localhost:8000
