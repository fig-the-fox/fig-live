// The one-line command Terminal hands Fig to install the web4 build on its GPU computer.
// Usage: node scripts/fig-command.mjs <url of fig-live-web4.tgz.b64>   (reads dist-web4/SHA256SUMS)
//
// It must be ONE line (Web4's creator chat sends on newline) and at most 900 characters (the chat caps
// messages near 1,000), with room left for the download URL. In order, it:
//   1. downloads the .b64 into a fresh temp dir, decodes it and checks the tarball's sha256. The hash pins
//      the exact bytes scripts/verify-web4.mjs checked, including that the tarball holds no .sh,
//      install.html or kit-files path (Fig's own files), so the command doesn't re-check names;
//   2. extracts it, lists its files, clears any stale <file>.flb for those paths, and keeps a dated copy
//      of index.html (index.fig-backup-<time>.html);
//   3. copies the site in with GNU cp, which keeps a <file>.flb copy of every file it replaces;
//   4. asks Fig's own server whether /kit/ serves the kit page and JS/CSS come back with the right
//      content-type (the server's directory and MIME handling are unknown from outside).
// If step 3 or 4 fails, every replaced file is put back from its .flb copy (so an update never leaves a
// mix of two releases) and it prints FIG-LIVE-ROLLED-BACK, or FIG-LIVE-ROLLBACK-FAILED if a restore
// failed; either way it exits non-zero. On success it deletes this run's .flb copies and prints
// FIG-LIVE-OK. All backup handling goes through the release's own file list, never a scan of public/.
// Files that are new in this release stay behind after a rollback; nothing links to them.
// Trade-off for the length limit: index.html is copied with everything else, so for the moment the copy
// takes it can arrive before its new chunks.
// It never touches fig-v*.sh, fig.sh, install.html or kit-files/: none of them are in the tarball.
//
// P (the served dir) and H (Fig's local server; curl assumes http://) are plain assignments at the front
// so scripts/verify-web4.mjs can run this exact command against a simulated /workspace/public.
// The URL and paths are used unquoted to save characters: figCommand only accepts URLs without shell
// characters, pack-web4.mjs only packs paths made of [A-Za-z0-9._/-], and P must not contain spaces.

import { readFileSync } from "node:fs";

export const MAX_CHARS = 900;

export function figCommand({ url, sha256, publicDir = "/workspace/public", server = "127.0.0.1:8080" }) {
  if (!/^[0-9a-f]{64}$/.test(sha256)) throw new Error("fig-command: bad sha256");
  // The URL goes into the command unquoted, so refuse anything the shell would treat specially.
  // https only, except plain http to 127.0.0.1 for scripts/verify-web4.mjs.
  if (!/^(https:\/\/|http:\/\/127\.0\.0\.1:\d+\/)[A-Za-z0-9._~:/%+=,@-]+$/.test(url)) {
    throw new Error("fig-command: the URL must be https and use only letters, digits and ._~:/%+=,@- (no spaces, quotes, ?, &, * or other shell characters)");
  }
  return [
    `U=${url};P=${publicDir};H=${server};`,
    // k <glob> <word>: does Fig's server send the first file matching <glob> with a content-type containing <word>?
    // The JS glob only matches _next/static/chunks/ (c*/: chunks or css, and css holds no .js), so a leftover
    // manifest from an older build can't stand in for the app's code.
    `k(){ curl -fs -o/dev/null -w%{content_type} $H/$(cd $P;ls $1|head -1)|grep -q $2;};`,
    // L lists this release's files. Backups are <file>.flb for those paths ONLY, never a scan of public/,
    // so nothing of Fig's (kit-files/, fig-v*.sh, install.html) can match. c deletes them (fails if any rm
    // fails); r puts them back and fails if any restore fails. T=$(...)&& stops the run if mktemp fails.
    `c(){ sed 's,$,.flb,' L|(cd $P&&xargs rm -f);};`,
    `r(){ e=0;while read f;do g=$P/$f;[ ! -e $g.flb ]||mv -f $g.flb $g||e=1;done<L;return $e;};`,
    `T=$(mktemp -d)&&cd $T&&curl -fsL $U|base64 -d>f.tgz&&echo "${sha256}  f.tgz"|sha256sum -c`,
    `&&mkdir x&&tar xzf f.tgz -C x&&(cd x;find . -type f)>L&&c&&cp $P/index.html $P/index.fig-backup-$(date +%s).html`,
    // From here on, a failed copy or check puts back every file this run replaced.
    `&&{ cp -R --backup=simple -S.flb x/. $P`,
    `&&curl -fs $H/kit/|grep -q '<title>Use the kit'&&k '_next/*/c*/*.js' javascript&&k '_next/*/css/*' css`,
    `||{ r&&echo FIG-LIVE-ROLLED-BACK||echo FIG-LIVE-ROLLBACK-FAILED;false;};}`,
    // Only after the checks pass: drop this run's backups. A cleanup failure leaves the new release up.
    `&&c&&echo FIG-LIVE-OK`,
  ].join("");
}

export function shaFromSums(path = "dist-web4/SHA256SUMS") {
  const line = readFileSync(path, "utf8")
    .split("\n")
    .find((l) => l.endsWith("  fig-live-web4.tgz"));
  if (!line) throw new Error(`fig-command: no fig-live-web4.tgz line in ${path}`);
  return line.slice(0, 64);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const url = process.argv[2] ?? "https://HOST/PATH/fig-live-web4.tgz.b64";
  const cmd = figCommand({ url, sha256: shaFromSums() });
  console.log(cmd);
  console.error(`(${cmd.length} characters; limit ${MAX_CHARS})`);
  if (cmd.length > MAX_CHARS) process.exit(1);
}
