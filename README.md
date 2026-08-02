# gh-stats — GitHub Repository Statistics Tool

![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=flat&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-F7DF1E?style=flat&logo=javascript&logoColor=black)
![No Frameworks](https://img.shields.io/badge/Frameworks-None-3fb950?style=flat)
![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat)

A single-page tool that looks up any public GitHub username and shows their
profile, repository statistics, and top starred repositories — built with
plain HTML, CSS, and vanilla JavaScript. No frameworks, no build step, no
backend. Open `index.html` and it works.

## Table of Contents

- [Features](#features)
- [Technologies Used](#technologies-used)
- [How to Run](#how-to-run)
- [GitHub API Used](#github-api-used)
- [Screenshots](#screenshots)
- [Folder Structure](#folder-structure)
- [Accessibility & Performance](#accessibility--performance)
- [Future Improvements](#future-improvements)
- [License](#license)

## Features

- **GitHub Profile Card** — avatar, name, bio, company, location, blog,
  join date, and follower/following/repo/gist counts, with buttons to view
  the profile on GitHub, copy the profile link, or share it (Web Share API
  with a clipboard fallback).
- **Statistics Cards** — total repositories, total stars, total forks,
  total watchers, open issues, and average stars per repository, each with
  an animated count-up.
- **Top Repositories** — the user's 5 most-starred repositories, sorted by
  `stargazers_count` descending. Each card shows the repo name, description
  (or "No description"), primary language with a color dot, star count,
  fork count, last-updated date, and an **Open on GitHub** button.
- **Loading Spinner** — an animated spinner while data is being fetched.
- **Error Handling** — friendly error cards for an empty username, a 404
  (user not found), a hit GitHub API rate limit, and generic network
  failures. Every search is guarded against race conditions, so a slow or
  stale request can never overwrite a newer one on screen.
- **Search History** — the last 5 searched usernames are saved to
  `localStorage` and shown as clickable chips for quick re-search.
- **Dark / Light Theme** — a toggle in the header that persists the chosen
  theme in `localStorage`.
- **Animated Counters** — every number on the page (profile stats and
  statistics cards) eases up from 0 to its final value.
- **Responsive Design** — the layout adapts down to mobile widths,
  including the profile card, statistics grid, and repository grid.

## Technologies Used

- HTML5 (semantic markup, Open Graph / Twitter Card meta tags)
- CSS3 (custom properties / theming, Flexbox, CSS Grid, keyframe
  animations, no framework)
- Vanilla JavaScript (ES6+: `async`/`await`, `fetch`, classes, arrow
  functions, template literals, `Promise`-based error handling)
- [GitHub REST API](https://docs.github.com/en/rest) (no auth, no backend)

## How to Run

1. Download or clone this folder.
2. Open `index.html` directly in any modern browser.

That's it — there is no build step, no `npm install`, and no server
required. (A local dev server such as VS Code's "Live Server" works fine
too, but is not required.)

### Deploying

This project is static, so it can be hosted anywhere that serves plain
files — GitHub Pages, Netlify, Vercel, or similar. For GitHub Pages:

1. Push this folder to a GitHub repository.
2. In the repo's **Settings → Pages**, set the source to the branch/folder
   containing `index.html`.
3. Once live, update the `og:url` meta tag in `index.html` to your deployed
   URL so link previews (Slack, Discord, Twitter/X, LinkedIn) point to the
   right place.

## GitHub API Used

| Endpoint | Purpose |
|---|---|
| `GET https://api.github.com/users/{username}` | Profile card data |
| `GET https://api.github.com/users/{username}/repos?per_page=100` | Repository list, used for statistics and the Top Repositories section |

Both requests are unauthenticated, so they share GitHub's public rate
limit (60 requests/hour per IP). Hitting that limit shows a dedicated
"Rate limit reached" error card instead of a generic failure.

## Screenshots

> _Add screenshots here once available._

- `screenshots/profile-card.png` — Profile card + statistics
- `screenshots/top-repositories.png` — Top Repositories section
- `screenshots/error-state.png` — Error handling
- `screenshots/light-theme.png` — Light theme

## Folder Structure

```
github-stats/
├── index.html            # Markup: header, search bar, state panels, profile/stats/top-repos sections
├── style.css              # GitHub-Dark-inspired theme, light theme override, layout, animations
├── script.js               # Fetch logic, rendering, theme toggle, history, state management
└── README.md               # This file
```

## Accessibility & Performance

The project has been reviewed with deployment in mind:

- Loading, error, and empty states use `role="status"` / `role="alert"`
  with `aria-live` so screen readers announce state changes.
- Decorative icons and emoji are marked `aria-hidden="true"`; the theme
  toggle exposes `aria-pressed`.
- A "Skip to main content" link is available for keyboard users.
- Visible focus outlines on every interactive element; `prefers-reduced-motion`
  is respected.
- The avatar `<img>` has explicit `width`/`height` to avoid layout shift,
  plus `loading="lazy"` / `decoding="async"`.
- Font requests are trimmed to only the weights actually used, with
  `preconnect` hints for both Google Fonts origins.
- Meta description, `robots`, `theme-color`, and Open Graph / Twitter Card
  tags are in place for search engines and link previews.

## Future Improvements

- Live search/filter across all fetched repositories (not just the top 5)
- Sort repositories by stars, forks, recently updated, or name
- Full language breakdown with per-language repo counts and progress bars
- Pagination for users with more than 100 repositories
- Optional personal access token input to raise the API rate limit

## License

This project is released under the [MIT License](https://opensource.org/licenses/MIT).
Feel free to use, modify, and share it.

---

Built with HTML, CSS & Vanilla JavaScript · Developed by **Dilkhush Choudhary**
