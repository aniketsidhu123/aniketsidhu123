# Profile README maintenance

This repository's root README appears at [github.com/aniketsidhu123](https://github.com/aniketsidhu123). Open [preview.html](preview.html) locally for the dark layout. If you change README content, GitHub's Markdown preview shows the latest text before you commit.

## Refresh activity

Use Node.js 22 or newer. The existing **Refresh profile art** workflow updates the contribution and public repository snapshots and the generated cards daily. It can also be started from the repository's Actions tab.

- Run `node scripts/build.mjs` to refresh from GitHub.
- Run `node scripts/build.mjs --offline` to rebuild from the committed snapshots.

The dashboard reads GitHub's public profile and contribution calendar. Language percentages reflect the primary language of repositories with a known language, based on the scope stated on the card.

## Artwork and credits

- Layout reference: GitSkins' creative dev template, credited to [@himanshu201031](https://github.com/himanshu201031) in the recording.
- [Workstation banner](assets/workstation.svg): original pixel art made with the built-in image generation tool, with SVG animations for the CRT, LED and steam. Reduced-motion settings pause the animation.
- [Skill Icons](https://github.com/tandpfun/skill-icons): locally bundled icons and [MIT license](assets/skill-icons-license.txt).
- Earlier terminal layout and activity refresh were inspired by [Avi Vashishta's animated README guide](https://www.avivashishta.com/blog/build-animated-github-profile-readme).

<details>
<summary>Banner generation prompt</summary>

Use case: illustration-story. Asset type: wide GitHub profile README hero banner, landscape approx 2:1. Make an original detailed 16-bit pixel-art illustration of a young South Asian developer seen from behind typing at a retro CRT workstation, dark midnight workspace, teal desk light and small amber accents, keyboard, subtle plants and books, diagonal overhead three-quarter composition and a moonlit New Delhi skyline visible through a window. A cool-blue CRT displays abstract graphics and a pale turquoise wireframe solid suggesting spatial CAD and AI. Keep the composition distinct from any existing pixel artist's work. Crisp visible pixels, restrained navy and petrol-green shading and contrast, warm rust hoodie. Image only, no printed words, no signatures, no logos, no margins. The main composition must fit the central 80 percent vertically for a wide banner crop.

</details>
