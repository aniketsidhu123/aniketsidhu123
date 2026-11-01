# Publish your profile

1. Create a **public** GitHub repository named exactly `aniketsidhu123` under your account. Use `main` as the default branch.
2. Put the contents of this folder at the repository root, including the hidden `.github` folder. Do not upload the ZIP itself or an extra enclosing folder.
3. Commit and push. Your README will appear on your GitHub profile.
4. Open **Actions → Refresh profile art → Run workflow** to verify the refresh.

The workflow runs daily around 11:47 AM India time (06:17 UTC); GitHub can delay scheduled runs. It uses the built-in repository token to commit changes. No personal access token or external stats service is required. Repository settings or branch protection must permit the workflow's push.

## Upload using Git

From this folder after creating the empty repository:

```sh
git init -b main
git add .
git commit -m "Add animated profile README"
git remote add origin https://github.com/aniketsidhu123/aniketsidhu123.git
git push -u origin main
```

Git will use your own GitHub authentication. These files have not been published automatically.

## Customize

Edit `profile.json` to update the name and info rows. With Node.js 22 or newer, run `node scripts/build.mjs` to rebuild. No packages are needed. `node scripts/build.mjs --offline` uses saved contribution data. Edit `README.md` for project links.

Open `preview.html` in a browser to view the animation. SVGs use a dark background in both GitHub themes and reveal once on load. Reduced-motion preferences disable the animation. The README images can wrap on small screens.

The AS monogram is intentional: your public avatar was a generated identicon. A personal photo can be used for an ASCII portrait later. Bio text comes from your public GitHub profile; edit it as needed.

The contribution scraper checks for missing or malformed data and fails without replacing the saved calendar if GitHub's HTML format changes. Counts match the public calendar's visibility. GitHub may cache images briefly and may disable scheduled workflows in inactive public repositories.

Design inspired by Avi Vashishta's guide: https://www.avivashishta.com/blog/build-animated-github-profile-readme . This implementation is original and uses dependency-free Node.js.
