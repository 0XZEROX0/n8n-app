// Writes the notes for the rolling "android" release. The app reads them (public/app.js, checkForUpdate):
//   - the title carries "build N"
//   - each "- N|text" line is a change and the build that brought it; older lines are carried over.
// Env: BUILD, SHA, PREV_SHA (the previous release's commit, may be empty), PREV_BODY.
import { execSync } from 'node:child_process';

const build = Number(process.env.BUILD);
const prevSha = (process.env.PREV_SHA || '').trim();
const sh = (c) => { try { return execSync(c, { encoding: 'utf8' }); } catch { return ''; } };

let changes = [];
if (prevSha && sh(`git cat-file -t ${prevSha}`).trim() === 'commit') {
  // First-parent history: one entry per merged PR (its title) or direct commit (its subject).
  const log = sh(`git log --first-parent --format=%s%x1f%b%x1e ${prevSha}..${process.env.SHA}`);
  changes = log.split('\x1e').map((e) => e.trim()).filter(Boolean).map((e) => {
    const [subject, body] = e.split('\x1f');
    return /^Merge pull request #\d+/.test(subject) ? (body || '').split('\n')[0].trim() || subject : subject;
  }).filter((t) => t && !/^Merge branch/.test(t));
} else {
  const [subject, body] = sh(`git log -1 --format=%s%x1f%b ${process.env.SHA}`).split('\x1f');
  changes = [/^Merge pull request #\d+/.test(subject) ? (body || '').trim().split('\n')[0] || subject : subject.trim()];
}

const old = [...(process.env.PREV_BODY || '').matchAll(/^- (\d+)\|(.+)$/gm)].map((m) => `- ${m[1]}|${m[2].trim()}`);
const lines = [...changes.map((c) => `- ${build}|${c}`), ...old].slice(0, 40);

console.log(`Latest Android build of n8n Mobile. Download **n8n-mobile.apk** below, or update from inside the app (Settings → Check for updates).

Commit: ${process.env.SHA}

### Changes (build|change)
${lines.join('\n')}`);
