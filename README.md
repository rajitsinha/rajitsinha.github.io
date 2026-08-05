# Portfolio site — Rajit Sinha

Static site. No build step, no dependencies.

Dark theme, custom blue cursor, smooth scroll with momentum, and a canvas
background where a rocket launches, orbits Earth, transfers to the Moon, and
flies a free-return trajectory as you scroll: launch, slanted loops around
Earth, a coast out to the Moon, a loop around it, and a return into Earth
orbit. The path is generated as continuous curves — cubic Hermite
coasts and precessing elliptical orbits, with position and heading matched at
every join — then resampled to equal-length steps, so there are no kinks
anywhere and the rocket travels at a constant speed; the rocket pays out the line behind itself, and both the line
and the rocket cut out entirely where they pass behind a body.

Everything degrades gracefully: the momentum scroll and the animation switch
off on phones and on `prefers-reduced-motion`, and all the content is plain
HTML so it still reads with JavaScript disabled.

## Before you publish
1. Search `index.html` for `data-todo="github"` (two places) and replace `href="#"` with your GitHub URL.
2. Confirm `assets/rajit-sinha-resume.pdf` is the version you want people downloading.

## Publish on GitHub Pages (free)
1. Create a repo named `<your-username>.github.io`
2. Upload everything in this folder to the repo root (`index.html` must be at the top level)
3. Settings -> Pages -> Source: `main` branch, `/ (root)` -> Save
4. Live in a minute or two at `https://<your-username>.github.io`

## Editing
- All copy is plain text in `index.html`
- Numbered callouts on photos are `<span class="balloon" style="left:__%;top:__%">` — percentages are positions on that image
- Colors and fonts are CSS variables at the top of the `<style>` block

## Local preview
    python3 -m http.server 8000
Then open http://localhost:8000
