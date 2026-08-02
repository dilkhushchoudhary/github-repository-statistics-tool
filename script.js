/* =====================================================================
   gh-stats — script.js
   Phase 1: username search -> GitHub API fetch -> Profile Card + Stats
   Everything is vanilla JS, no build step, no dependencies.
   ===================================================================== */

/* ---------------------------------------------------------------------
   1. DOM REFERENCES
   Grouped in one place so the rest of the file just reads like prose.
   --------------------------------------------------------------------- */
const searchForm = document.getElementById('searchForm');
const usernameInput = document.getElementById('usernameInput');
const searchBtn = document.getElementById('searchBtn');

const loadingState = document.getElementById('loadingState');
const errorState = document.getElementById('errorState');
const emptyState = document.getElementById('emptyState');
const resultsWrapper = document.getElementById('resultsWrapper');

const errorTitle = document.getElementById('errorTitle');
const errorMessage = document.getElementById('errorMessage');

const historyRow = document.getElementById('historyRow');
const historyChips = document.getElementById('historyChips');

const themeToggle = document.getElementById('themeToggle');
const backToTop = document.getElementById('backToTop');

// Profile card elements
const avatarImg = document.getElementById('avatarImg');
const profileName = document.getElementById('profileName');
const profileUsername = document.getElementById('profileUsername');
const profileBio = document.getElementById('profileBio');
const viewProfileBtn = document.getElementById('viewProfileBtn');
const copyLinkBtn = document.getElementById('copyLinkBtn');
const shareBtn = document.getElementById('shareBtn');

const metaCompany = document.getElementById('metaCompany');
const metaLocation = document.getElementById('metaLocation');
const metaBlog = document.getElementById('metaBlog');
const metaJoined = document.getElementById('metaJoined');

const followersCount = document.getElementById('followersCount');
const followingCount = document.getElementById('followingCount');
const publicReposCount = document.getElementById('publicReposCount');
const publicGistsCount = document.getElementById('publicGistsCount');

// Statistic cards (numbers get counted up)
const statTotalRepos = document.getElementById('statTotalRepos');
const statTotalStars = document.getElementById('statTotalStars');
const statTotalForks = document.getElementById('statTotalForks');
const statTotalWatchers = document.getElementById('statTotalWatchers');
const statTotalIssues = document.getElementById('statTotalIssues');
const statAvgStars = document.getElementById('statAvgStars');

// Top Repositories
const topReposGrid = document.getElementById('topReposGrid');

/* ---------------------------------------------------------------------
   2. CONSTANTS
   --------------------------------------------------------------------- */
const GITHUB_API = 'https://api.github.com';
const HISTORY_KEY = 'ghStats.recentUsernames';
const THEME_KEY = 'ghStats.theme';
const MAX_HISTORY = 5;
const TOP_REPOS_COUNT = 5;

// A small set of common language accent colors (roughly GitHub's own
// language colors) purely for the little dot next to each repo's language.
// Anything not in this list falls back to the theme's default accent blue.
const LANGUAGE_COLORS = {
  JavaScript: '#f1e05a',
  TypeScript: '#3178c6',
  Python: '#3572A5',
  Java: '#b07219',
  'C++': '#f34b7d',
  C: '#555555',
  'C#': '#178600',
  Go: '#00ADD8',
  Rust: '#dea584',
  Ruby: '#701516',
  PHP: '#4F5D95',
  HTML: '#e34c26',
  CSS: '#563d7c',
  Shell: '#89e051',
  Swift: '#F05138',
  Kotlin: '#A97BFF',
  Dart: '#00B4AB',
};

// Keep the last fetched repos around in memory (used by later phases:
// search / sort / repo cards will read from this array).
let currentRepos = [];
let currentUser = null;

// Guards against race conditions when a search fires while a previous one
// is still in flight (e.g. double submit, clicking a history chip quickly,
// pressing Enter twice). Each search gets an id; an older request's abort
// or resolution is only allowed to touch the UI if it is still the latest.
let latestRequestId = 0;
let activeAbortController = null;

/* ---------------------------------------------------------------------
   3. THEME (dark/light toggle + localStorage persistence)
   --------------------------------------------------------------------- */
function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  const preferred = saved || 'dark';
  document.documentElement.setAttribute('data-theme', preferred);
  themeToggle.setAttribute('aria-pressed', String(preferred === 'light'));
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem(THEME_KEY, next);
  themeToggle.setAttribute('aria-pressed', String(next === 'light'));
}

themeToggle.addEventListener('click', toggleTheme);

/* ---------------------------------------------------------------------
   4. STATE PANEL HELPERS
   Only one of: loading / error / empty / results is visible at a time.
   --------------------------------------------------------------------- */
function showLoading() {
  loadingState.hidden = false;
  errorState.hidden = true;
  emptyState.hidden = true;
  resultsWrapper.hidden = true;
}

function showError(title, message) {
  errorTitle.textContent = title;
  errorMessage.textContent = message;
  errorState.hidden = false;
  loadingState.hidden = true;
  emptyState.hidden = true;
  resultsWrapper.hidden = true;
}

function showResults() {
  resultsWrapper.hidden = false;
  loadingState.hidden = true;
  errorState.hidden = true;
  emptyState.hidden = true;
}

function showEmpty() {
  emptyState.hidden = false;
  loadingState.hidden = true;
  errorState.hidden = true;
  resultsWrapper.hidden = true;
}

/* ---------------------------------------------------------------------
   5. FETCH LOGIC
   Fetches the user profile and their repositories in parallel with
   Promise.all, and handles every failure mode the brief calls out:
   empty username, 404, rate limiting, and generic network errors.
   --------------------------------------------------------------------- */
async function fetchGitHubData(username, signal) {
  const profileRes = await fetch(`${GITHUB_API}/users/${encodeURIComponent(username)}`, { signal });

  // GitHub returns 403 with a specific message when the rate limit is hit.
  if (profileRes.status === 403) {
    const rateLimitRemaining = profileRes.headers.get('x-ratelimit-remaining');
    if (rateLimitRemaining === '0') {
      throw new ApiError(
        'Rate limit reached',
        'GitHub’s API rate limit has been hit for your network. Please wait a few minutes and try again.'
      );
    }
    throw new ApiError('Request blocked', 'GitHub refused this request (403). Please try again later.');
  }

  if (profileRes.status === 404) {
    throw new ApiError('User not found', `We couldn’t find a GitHub account named "${username}". Double-check the spelling and try again.`);
  }

  if (!profileRes.ok) {
    throw new ApiError('GitHub API error', `GitHub responded with status ${profileRes.status}. Please try again.`);
  }

  const profile = await profileRes.json();

  // Repos are fetched separately (paginated up to 100 per page, which is
  // plenty for the vast majority of accounts).
  const reposRes = await fetch(`${GITHUB_API}/users/${encodeURIComponent(username)}/repos?per_page=100&sort=updated`, { signal });

  if (!reposRes.ok) {
    throw new ApiError('Could not load repositories', `GitHub responded with status ${reposRes.status} while fetching repositories.`);
  }

  const repos = await reposRes.json();

  return { profile, repos };
}

// Small custom error class so we can carry a friendly title + message together.
class ApiError extends Error {
  constructor(title, message) {
    super(message);
    this.title = title;
  }
}

/* ---------------------------------------------------------------------
   6. RENDER: PROFILE CARD
   --------------------------------------------------------------------- */
function renderProfile(profile) {
  avatarImg.src = profile.avatar_url;
  avatarImg.alt = `${profile.login}'s avatar`;

  profileName.textContent = profile.name || profile.login;
  profileUsername.textContent = `@${profile.login}`;
  profileUsername.href = profile.html_url;

  profileBio.textContent = profile.bio || '';
  profileBio.hidden = !profile.bio;

  viewProfileBtn.href = profile.html_url;

  // Optional meta fields: only show the row if the data exists.
  setMetaItem(metaCompany, profile.company);
  setMetaItem(metaLocation, profile.location);

  if (profile.blog) {
    metaBlog.hidden = false;
    const link = metaBlog.querySelector('.meta-link');
    const href = profile.blog.startsWith('http') ? profile.blog : `https://${profile.blog}`;
    link.href = href;
    link.textContent = profile.blog;
  } else {
    metaBlog.hidden = true;
  }

  const joinedDate = new Date(profile.created_at);
  metaJoined.querySelector('.meta-text').textContent =
    `Joined ${joinedDate.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}`;

  // Top-line stats
  animateCountUp(followersCount, profile.followers);
  animateCountUp(followingCount, profile.following);
  animateCountUp(publicReposCount, profile.public_repos);
  animateCountUp(publicGistsCount, profile.public_gists);
}

function setMetaItem(el, value) {
  if (value) {
    el.hidden = false;
    el.querySelector('.meta-text').textContent = value;
  } else {
    el.hidden = true;
  }
}

/* ---------------------------------------------------------------------
   7. RENDER: STATISTICS
   --------------------------------------------------------------------- */
function renderStats(repos) {
  const totalRepos = repos.length;
  const totalStars = repos.reduce((sum, r) => sum + (r.stargazers_count || 0), 0);
  const totalForks = repos.reduce((sum, r) => sum + (r.forks_count || 0), 0);
  const totalWatchers = repos.reduce((sum, r) => sum + (r.watchers_count || 0), 0);
  const totalIssues = repos.reduce((sum, r) => sum + (r.open_issues_count || 0), 0);
  const avgStars = totalRepos > 0 ? (totalStars / totalRepos) : 0;

  animateCountUp(statTotalRepos, totalRepos);
  animateCountUp(statTotalStars, totalStars);
  animateCountUp(statTotalForks, totalForks);
  animateCountUp(statTotalWatchers, totalWatchers);
  animateCountUp(statTotalIssues, totalIssues);
  animateCountUp(statAvgStars, avgStars, avgStars % 1 !== 0 ? 1 : 0); // one decimal if needed
}

/* ---------------------------------------------------------------------
   7b. RENDER: TOP 5 MOST STARRED REPOSITORIES
   Sorts a copy of the repos array (never mutates currentRepos) by
   stargazers_count descending and renders cards for the top 5.
   --------------------------------------------------------------------- */
function renderTopRepos(repos) {
  // Sort a copy — never mutate the array other parts of the app rely on.
  const topRepos = [...repos]
    .sort((a, b) => (b.stargazers_count || 0) - (a.stargazers_count || 0))
    .slice(0, TOP_REPOS_COUNT);

  topReposGrid.innerHTML = '';

  if (topRepos.length === 0) {
    const emptyMsg = document.createElement('p');
    emptyMsg.className = 'repo-grid-empty';
    emptyMsg.textContent = 'This user has no public repositories yet.';
    topReposGrid.appendChild(emptyMsg);
    return;
  }

  topRepos.forEach((repo, index) => {
    topReposGrid.appendChild(buildRepoCard(repo, index));
  });
}

// Builds a single repository card element. Kept separate from
// renderTopRepos so it can be reused later without duplicating markup.
function buildRepoCard(repo, index) {
  const card = document.createElement('article');
  card.className = 'repo-card';

  const language = repo.language || 'N/A';
  const languageColor = LANGUAGE_COLORS[repo.language] || 'var(--clr-accent-blue)';
  const description = repo.description || 'No description';
  const updated = formatDate(repo.updated_at || repo.pushed_at);

  card.innerHTML = `
    <div class="repo-card-header">
      <h4 class="repo-name">${escapeHtml(repo.name)}</h4>
      <span class="repo-rank">#${index + 1}</span>
    </div>
    <p class="repo-description">${escapeHtml(description)}</p>
    <div class="repo-meta-row">
      <span class="repo-meta-item">
        <span class="repo-language-dot" style="background:${languageColor}"></span>${escapeHtml(language)}
      </span>
      <span class="repo-meta-item">⭐ ${(repo.stargazers_count || 0).toLocaleString()}</span>
      <span class="repo-meta-item">🍴 ${(repo.forks_count || 0).toLocaleString()}</span>
    </div>
    <p class="repo-updated">Updated ${updated}</p>
    <a class="btn btn-ghost" href="${repo.html_url}" target="_blank" rel="noopener noreferrer">Open on GitHub</a>
  `;

  return card;
}

// Formats an ISO date string the same friendly way everywhere in the app.
function formatDate(isoString) {
  if (!isoString) return 'recently';
  return new Date(isoString).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// Minimal HTML-escaping so repo names/descriptions can never break markup
// or inject tags (GitHub content is generally safe, but this costs nothing).
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/* ---------------------------------------------------------------------
   8. COUNT-UP ANIMATION
   A tiny requestAnimationFrame-driven number tween, reused by both the
   profile stat row and the statistics cards.
   --------------------------------------------------------------------- */
function animateCountUp(el, target, decimals = 0, duration = 900) {
  const start = 0;
  const startTime = performance.now();

  function tick(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    // Ease-out cubic for a pleasant deceleration
    const eased = 1 - Math.pow(1 - progress, 3);
    const value = start + (target - start) * eased;
    el.textContent = decimals > 0 ? value.toFixed(decimals) : Math.round(value).toLocaleString();

    if (progress < 1) {
      requestAnimationFrame(tick);
    } else {
      el.textContent = decimals > 0 ? target.toFixed(decimals) : Math.round(target).toLocaleString();
    }
  }

  requestAnimationFrame(tick);
}

/* ---------------------------------------------------------------------
   9. SEARCH HISTORY (localStorage, max 5, clickable chips)
   --------------------------------------------------------------------- */
function getHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
  } catch {
    return [];
  }
}

function addToHistory(username) {
  let history = getHistory().filter(u => u.toLowerCase() !== username.toLowerCase());
  history.unshift(username);
  history = history.slice(0, MAX_HISTORY);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  renderHistory();
}

function renderHistory() {
  const history = getHistory();
  historyChips.innerHTML = '';

  if (history.length === 0) {
    historyRow.hidden = true;
    return;
  }

  historyRow.hidden = false;
  history.forEach(username => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'history-chip';
    chip.textContent = username;
    chip.addEventListener('click', () => {
      usernameInput.value = username;
      handleSearch(username);
    });
    historyChips.appendChild(chip);
  });
}

/* ---------------------------------------------------------------------
   10. SHARE / COPY LINK
   --------------------------------------------------------------------- */
copyLinkBtn.addEventListener('click', async () => {
  if (!currentUser) return;
  try {
    await navigator.clipboard.writeText(currentUser.html_url);
    const original = copyLinkBtn.textContent;
    copyLinkBtn.textContent = 'Copied!';
    setTimeout(() => (copyLinkBtn.textContent = original), 1500);
  } catch {
    // Clipboard API can fail (e.g. insecure context) — fail quietly.
    alert('Could not copy the link automatically. Please copy it manually.');
  }
});

shareBtn.addEventListener('click', async () => {
  if (!currentUser) return;
  const shareData = {
    title: `${currentUser.login} on GitHub`,
    text: `Check out ${currentUser.login}'s GitHub profile`,
    url: currentUser.html_url,
  };

  if (navigator.share) {
    try {
      await navigator.share(shareData);
    } catch {
      /* user cancelled the share sheet — nothing to do */
    }
  } else {
    // Fallback for browsers without the Web Share API
    copyLinkBtn.click();
  }
});

/* ---------------------------------------------------------------------
   11. BACK TO TOP
   --------------------------------------------------------------------- */
window.addEventListener('scroll', () => {
  backToTop.hidden = window.scrollY < 400;
});

backToTop.addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

/* ---------------------------------------------------------------------
   12. MAIN SEARCH HANDLER
   --------------------------------------------------------------------- */
async function handleSearch(rawUsername) {
  const username = rawUsername.trim();

  // Every call gets its own id. If a newer search starts before this one
  // finishes, this id stops being "latest" and this call is no longer
  // allowed to change what's on screen — that's what was letting a slow,
  // stale request (or its error) clobber a newer/successful one.
  const requestId = ++latestRequestId;

  // Cancel whatever request was previously in flight — only one search
  // should ever be "live" at a time.
  if (activeAbortController) {
    activeAbortController.abort();
  }

  if (!username) {
    showError('Username required', 'Please enter a GitHub username before running the search.');
    return;
  }

  const abortController = new AbortController();
  activeAbortController = abortController;

  showLoading();
  searchBtn.disabled = true;

  try {
    const { profile, repos } = await fetchGitHubData(username, abortController.signal);

    // A newer search has since started — drop this result silently instead
    // of showing it (it would be stale) and instead of hiding whatever the
    // newer search is currently displaying.
    if (requestId !== latestRequestId) return;

    // GitHub can return a non-array error payload (e.g. for rate limiting
    // on the repos endpoint specifically) — guard against that.
    currentRepos = Array.isArray(repos) ? repos : [];
    currentUser = profile;

    renderProfile(profile);
    renderStats(currentRepos);
    renderTopRepos(currentRepos);

    showResults();
    addToHistory(profile.login);
  } catch (err) {
    // Ignore aborts entirely — they only happen when a newer search
    // superseded this one, so there is nothing to show here.
    if (err.name === 'AbortError') return;

    // A newer search has since started — never show this error over it.
    if (requestId !== latestRequestId) return;

    if (err instanceof ApiError) {
      showError(err.title, err.message);
    } else if (err instanceof TypeError) {
      // fetch() throws a TypeError on network failure (offline, DNS, CORS, etc.)
      showError('Network error', 'Could not reach the GitHub API. Check your internet connection and try again.');
    } else {
      showError('Unexpected error', 'Something went wrong while fetching data. Please try again.');
    }
  } finally {
    // Only the latest request should re-enable the button / clear the
    // in-flight controller — an older, superseded request finishing later
    // must not touch state that belongs to the newer one.
    if (requestId === latestRequestId) {
      searchBtn.disabled = false;
      activeAbortController = null;
    }
  }
}

searchForm.addEventListener('submit', (e) => {
  e.preventDefault();
  handleSearch(usernameInput.value);
});

/* ---------------------------------------------------------------------
   13. INIT
   --------------------------------------------------------------------- */
function init() {
  initTheme();
  renderHistory();
  showEmpty();
}

init();
