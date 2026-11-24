import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const readJson = async (name) => JSON.parse(await fs.readFile(path.join(root, name), 'utf8'));
const config = await readJson('profile.json');
const actor = encodeURIComponent(config.username);
const number = new Intl.NumberFormat('en-US');
const monthName = new Intl.DateTimeFormat('en', { month: 'short', timeZone: 'UTC' });
const DAY = 86_400_000;
const WIDTH = 880;
const userAgent = 'github-profile-readme-builder';

const escapeXml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
})[character]);

function extractAttributes(source) {
  return Object.fromEntries(
    [...source.matchAll(/([\w-]+)="([^"]*)"/g)].map((match) => [match[1], match[2]]),
  );
}

async function request(url, headers = {}) {
  const response = await fetch(url, {
    headers: { 'User-Agent': userAgent, ...headers },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error('GitHub returned ' + response.status + ' for ' + new URL(url).pathname + '. Existing assets were preserved.');
  return response;
}

function parseCalendar(html) {
  const tips = new Map(
    [...html.matchAll(/<tool-tip\b([^>]*)>([\s\S]*?)<\/tool-tip>/g)].map((match) => [
      extractAttributes(match[1]).for, match[2].replace(/<[^>]+>/g, '').trim(),
    ]),
  );
  const days = [...html.matchAll(/<td\b([^>]*)>/g)]
    .map((match) => extractAttributes(match[1]))
    .filter((cell) => cell['data-date'])
    .map((cell) => {
      const tip = tips.get(cell.id) ?? '';
      const count = /^No contributions/.test(tip)
        ? 0
        : Number(tip.match(/^([\d,]+) contribution/)?.[1]?.replaceAll(',', ''));
      return { date: cell['data-date'], count, level: Number(cell['data-level']) };
    })
    .sort((left, right) => left.date.localeCompare(right.date));
  validateCalendar(days);
  return days;
}

const parseDate = (date) => Date.parse(date + 'T00:00:00Z');

function validateCalendar(days) {
  const complete = Array.isArray(days) && days.length >= 350 && days.length <= 370;
  if (!complete || days.some((day, i) =>
    !/^\d{4}-\d{2}-\d{2}$/.test(day.date) ||
    !Number.isFinite(parseDate(day.date)) ||
    !Number.isInteger(day.count) || day.count < 0 ||
    !Number.isInteger(day.level) || day.level < 0 || day.level > 4 ||
    (i > 0 && parseDate(day.date) - parseDate(days[i - 1].date) !== DAY))) {
    throw new Error('Incomplete or unrecognized GitHub calendar. Existing assets were preserved.');
  }
}

async function fetchRepositories() {
  const headers = { Accept: 'application/vnd.github+json' };
  const endpoint = 'https://api.github.com/users/' + actor;
  const userRequest = request(endpoint, headers).then((response) => response.json());
  const reposRequest = (async () => {
    const repos = [];
    for (let page = 1; ; page += 1) {
      const url = endpoint + '/repos?type=owner&per_page=100&page=' + page;
      const response = await request(url, headers);
      const entries = await response.json();
      if (!Array.isArray(entries)) throw new Error('GitHub did not return a repository list.');
      repos.push(...entries);
      if (!response.headers.get('link')?.includes('rel="next"')) return repos;
    }
  })();
  const [user, repos] = await Promise.all([userRequest, reposRequest]);
  if (user.login?.toLowerCase() !== config.username.toLowerCase() ||
      !Number.isInteger(user.followers) ||
      new Set(repos.map((repo) => repo.id)).size !== repos.length ||
      repos.some((repo) => repo.private || !Number.isInteger(repo.stargazers_count) ||
        repo.owner?.login?.toLowerCase() !== config.username.toLowerCase())) {
    throw new Error('GitHub returned incomplete or inconsistent profile metadata.');
  }
  const counts = new Map();
  for (const repo of repos) {
    if (repo.language) counts.set(repo.language, (counts.get(repo.language) ?? 0) + 1);
  }
  return {
    asOf: new Date().toISOString().slice(0, 10),
    repositories: repos.length,
    stars: repos.reduce((total, repo) => total + repo.stargazers_count, 0),
    followers: user.followers,
    languages: Object.fromEntries([...counts].sort(([a], [b]) => a.localeCompare(b))),
  };
}

function validateProfile(snapshot) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(snapshot.asOf) ||
      !['repositories', 'stars', 'followers'].every((key) => Number.isInteger(snapshot[key]) && snapshot[key] >= 0) ||
      !snapshot.languages || typeof snapshot.languages !== 'object' || Array.isArray(snapshot.languages) ||
      Object.values(snapshot.languages).some((count) => !Number.isInteger(count) || count < 1) ||
      Object.values(snapshot.languages).reduce((sum, count) => sum + count, 0) > snapshot.repositories) {
    throw new Error('Invalid public GitHub snapshot. Existing assets were preserved.');
  }
}

function activityStats(days) {
  let longest = 0;
  let run = 0;
  let activeDays = 0;
  let total = 0;
  for (const day of days) {
    total += day.count;
    if (day.count > 0) {
      activeDays += 1;
      run += 1;
      longest = Math.max(longest, run);
    } else {
      run = 0;
    }
  }

  // The last calendar day may still be in progress.
  let current = 0;
  let end = days.length - 1;
  if (days[end].count === 0) end -= 1;
  for (let i = end; i >= 0 && days[i].count > 0; i -= 1) current += 1;
  return { longest, current, total, activeDays };
}

const label = (x, y, value, className = '', options = '') =>
  '<text x="' + x + '" y="' + y + '" class="' + className + '" ' + options + '>' + escapeXml(value) + '</text>';

function frame(height, title, description, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${height}" viewBox="0 0 ${WIDTH} ${height}" role="img" aria-labelledby="title description">
<title id="title">${escapeXml(title)}</title>
<desc id="description">${escapeXml(description)}</desc>
<defs>
  <linearGradient id="surface" x1="0" y1="0" x2="1" y2="1" gradientUnits="objectBoundingBox">
    <stop stop-color="#102137"/><stop offset=".52" stop-color="#0a1220"/><stop offset="1" stop-color="#172039"/>
  </linearGradient>
  <linearGradient id="edge" x1="0" y1="0" x2="1" y2="1" gradientUnits="objectBoundingBox">
    <stop stop-color="#376d95"/><stop offset=".47" stop-color="#304359"/><stop offset="1" stop-color="#4e4380"/>
  </linearGradient>
  <linearGradient id="panel" x1="0" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox">
    <stop stop-color="#182b3e"/><stop offset="1" stop-color="#101a2c"/>
  </linearGradient>
</defs>
<style>
  text { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; fill: #e6f1fb; font-size: 14px; }
  .heading { font-size: 24px; font-weight: 750; }
  .subheading { font-size: 15px; font-weight: 700; fill: #d7e5f7; }
  .small { font-size: 12px; fill: #adc0d8; }
  .detail { font-size: 13px; font-weight: 650; }
  .eyebrow { font: 700 10px ui-monospace, Consolas, monospace; letter-spacing: 1.35px; fill: #9acaff; }
  .metric { font-size: 30px; font-weight: 750; }
  .blue { fill: #8ed8ff; } .violet { fill: #c4abff; } .green { fill: #8ce5c8; }
  .bar { transform-box: fill-box; transform-origin: left; animation: rise .85s cubic-bezier(.22,.61,.36,1) both; }
  @keyframes rise { from { transform: scaleX(0); } to { transform: scaleX(1); } }
  @media (prefers-reduced-motion: reduce) { .bar { animation: none; } .trail { display: none; } }
</style>
<rect x="1" y="1" width="878" height="${height - 2}" rx="15" fill="url(#surface)" stroke="url(#edge)"/>
<path d="M24 17h34" stroke="#77caff" stroke-width="2" stroke-linecap="round"/>
${body}
</svg>` + '\n';
}

function inset(x, y, width, height) {
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="11" fill="url(#panel)" stroke="#30475e"/>`;
}

function statsCard(profile, days, activity) {
  const profileMetrics = [
    ['Public repositories', profile.repositories, 'blue'],
    ['Repository stars', profile.stars, 'violet'],
    ['Followers', profile.followers, 'green'],
  ];
  const activityMetrics = [
    ['Contributions', activity.total, 'blue'],
    ['Current streak', activity.current, 'violet'],
    ['Longest streak', activity.longest, 'green'],
  ];
  const metrics = (items, origin, spacing) => items.map(([name, value, color], index) => {
    const x = origin + index * spacing;
    return (index === 0 ? '' : `<path d="M${x - 12} 113v54" stroke="#30475e"/>`) + label(x, 143, number.format(value), 'metric ' + color) + label(x, 166, name, 'small');
  }).join('');

  const body = label(24, 38, 'GitHub at a glance', 'heading') +
    label(856, 38, '@' + config.username, 'eyebrow', 'text-anchor="end"') +
    inset(24, 59, 405, 128) + inset(441, 59, 415, 128) +
    label(44, 88, 'Profile signal', 'subheading') +
    label(461, 88, 'Contribution streak', 'subheading') +
    metrics(profileMetrics, 44, 121) +
    metrics(activityMetrics, 461, 128) +
    label(24, 211, 'Public repository data · ' + profile.asOf, 'small') +
    label(856, 211, days[0].date + ' to ' + days.at(-1).date + ' · streaks in days', 'small', 'text-anchor="end"');

  return frame(232, 'GitHub at a glance',
    number.format(profile.repositories) + ' public repositories, ' + number.format(profile.stars) +
    ' repository stars and ' + number.format(profile.followers) + ' followers. ' +
    number.format(activity.total) + ' contributions in the displayed year, a current streak of ' +
    activity.current + ' days and longest streak of ' + activity.longest + ' days.', body);
}

const colors = {
  JavaScript: '#f1e05a',
  TypeScript: '#69a8ef',
  Python: '#79d5eb',
  HTML: '#f38b73',
  'Jupyter Notebook': '#e9a65b',
};

function languagesCard(profile) {
  const entries = Object.entries(profile.languages).sort(([left, a], [right, b]) => b - a || left.localeCompare(right));
  const known = entries.reduce((sum, [, count]) => sum + count, 0);
  const visible = entries.slice(0, 5);
  if (entries.length > visible.length) {
    visible.push(['Other', entries.slice(visible.length).reduce((sum, [, count]) => sum + count, 0)]);
  }
  const height = 105 + Math.max(1, visible.length) * 34;
  let body = label(24, 39, 'Language stack', 'heading') +
    label(24, 64, 'Primary language by public repository · ' + known + ' of ' + profile.repositories + ' classified', 'small') +
    label(856, 38, 'REPOSITORIES', 'eyebrow', 'text-anchor="end"');

  if (!visible.length) body += label(24, 105, 'No primary languages reported.', 'detail');
  visible.forEach(([name, count], index) => {
    const y = 100 + index * 34;
    const share = count / known;
    const color = colors[name] ?? '#a590ec';
    body += languageRow(name, count, share, index, y, color);
  });

  return frame(height, 'Language stack',
    visible.length ? visible.map(([name, count]) => name + ': ' + count + ' repositories').join('. ') : 'No primary languages reported.',
    body);
}

function languageRow(name, count, share, index, y, color) {
  const width = Math.max(3, Math.round(495 * share));
  return `<circle cx="30" cy="${y - 4}" r="4" fill="${color}"/>` +
    label(44, y, name, 'detail') +
    label(260, y, number.format(count), 'small', 'text-anchor="end"') +
    `<rect x="280" y="${y - 9}" width="495" height="8" rx="4" fill="#23384d"/>` +
    `<rect class="bar" x="280" y="${y - 9}" width="${width}" height="8" rx="4" fill="${color}" style="animation-delay:${index * 0.08}s"/>` +
    label(856, y, Math.round(share * 100) + '%', 'detail', 'text-anchor="end"');
}

const heatColors = ['#192536', '#164a70', '#1d699b', '#418bd0', '#86ccff'];
function contributionCard(days, activity, snake = false) {
  const first = new Date(parseDate(days[0].date));
  const sunday = first.getTime() - first.getUTCDay() * DAY;
  const columns = Math.floor((parseDate(days.at(-1).date) - sunday) / (7 * DAY)) + 1;
  const step = Math.min(15, 801 / columns);
  const xFor = (col) => +(48 + col * step).toFixed(2);
  const yFor = (row) => 104 + row * 15;
  const side = 12;
  const title = snake ? 'Contribution trail' : 'Contribution activity';
  let body = label(24, 40, title, 'heading') +
    label(24, 65, number.format(activity.total) + ' contributions · ' + number.format(activity.activeDays) + ' active days · last year', 'small') +
    label(856, 39, snake ? 'ANIMATED' : 'GITHUB CALENDAR', 'eyebrow', 'text-anchor="end"');

  for (const [row, name] of [[1, 'M'], [3, 'W'], [5, 'F']]) {
    body += label(25, yFor(row) + 10, name, 'small');
  }
  let lastMonth = '';
  for (const day of days) {
    const date = new Date(parseDate(day.date));
    const col = Math.floor((date.getTime() - sunday) / (7 * DAY));
    const row = date.getUTCDay();
    const month = day.date.slice(0, 7);
    if (row === 0 && month !== lastMonth && col < columns - 2) {
      body += label(xFor(col), 93, monthName.format(date), 'small');
      lastMonth = month;
    }
    const x = xFor(col);
    const y = yFor(row);
    body += `<rect x="${x}" y="${y}" width="${side}" height="${side}" rx="2" fill="${heatColors[day.level]}"><title>${day.date}: ${day.count} contributions</title></rect>`;
  }

  if (snake) {
    // Visit the visible graph in alternating week-by-week rows. The source
    // contribution levels remain visible under the decorative moving trail.
    const points = [];
    for (let row = 0; row < 7; row += 1) {
      const firstCol = row % 2 === 0 ? 0 : columns - 1;
      const lastCol = columns - 1 - firstCol;
      points.push([xFor(firstCol) + side / 2, yFor(row) + side / 2]);
      points.push([xFor(lastCol) + side / 2, yFor(row) + side / 2]);
    }
    const trailPath = 'M' + points.map(([x, y]) => x + ' ' + y).join('L');
    body += `<g class="trail" aria-hidden="true">
  <circle r="3.0" fill="#488ad4" opacity=".5"><animateMotion path="${trailPath}" begin="-0.6s" dur="38s" repeatCount="indefinite" calcMode="paced"/></circle>
  <circle r="3.6" fill="#5aa5eb" opacity=".7"><animateMotion path="${trailPath}" begin="-0.4s" dur="38s" repeatCount="indefinite" calcMode="paced"/></circle>
  <circle r="4.0" fill="#86ccff" opacity=".9"><animateMotion path="${trailPath}" begin="-0.2s" dur="38s" repeatCount="indefinite" calcMode="paced"/></circle>
  <circle r="4.4" fill="#daf1ff" stroke="#86ccff" stroke-width="1.2"><animateMotion path="${trailPath}" dur="38s" repeatCount="indefinite" calcMode="paced"/></circle>
</g>`;
  }
  body += label(24, 236, days[0].date + ' to ' + days.at(-1).date, 'small');
  body += label(715, 236, 'Less', 'small', 'text-anchor="end"');
  heatColors.forEach((color, index) => { body += `<rect x="${726 + index * 17}" y="226" width="12" height="12" rx="2" fill="${color}"/>`; });
  body += label(819, 236, 'More', 'small');

  return frame(256, title,
    number.format(activity.total) + ' contributions over ' + days.length + ' days from ' +
    days[0].date + ' to ' + days.at(-1).date + '. ' +
    (snake ? 'A blue trail moves along the contribution heatmap.' : 'Darker to brighter blue represents lower to higher activity.'), body);
}

const args = process.argv.slice(2);
let days;
let profile;
if (args[0] === '--offline') {
  [days, profile] = await Promise.all([readJson('data/contributions.json'), readJson('data/github-profile.json')]);
} else if (args[0]) {
  // Preserve the existing positional HTML option for reproducible local builds.
  days = parseCalendar(await fs.readFile(args[0], 'utf8'));
  profile = await readJson('data/github-profile.json');
} else {
  const calendarUrl = 'https://github.com/users/' + actor + '/contributions';
  [days, profile] = await Promise.all([
    request(calendarUrl).then((response) => response.text()).then(parseCalendar),
    fetchRepositories(),
  ]);
}
validateCalendar(days);
validateProfile(profile);
const activity = activityStats(days);
const files = new Map([
  ['assets/stats.svg', statsCard(profile, days, activity)],
  ['assets/languages.svg', languagesCard(profile)],
  ['assets/contributions.svg', contributionCard(days, activity)],
  ['assets/snake.svg', contributionCard(days, activity, true)],
  ['data/contributions.json', JSON.stringify(days, null, 2) + '\n'],
  ['data/github-profile.json', JSON.stringify(profile, null, 2) + '\n'],
]);

await Promise.all(['assets', 'data'].map((folder) => fs.mkdir(path.join(root, folder), { recursive: true })));
for (const [name, content] of files) await fs.writeFile(path.join(root, name), content);
console.log('Built 4 SVGs from ' + profile.repositories + ' public repositories and ' + days.length +
  ' calendar days (' + activity.total + ' contributions).');
