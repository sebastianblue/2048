import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const cwd = fileURLToPath(new URL('../', import.meta.url));
const git = (...args) => execFileSync('git', args, {cwd, encoding:'utf8'}).trim();
const changes = git('status', '--porcelain', '--', 'dist');
if (changes) throw new Error('Commit the game files in dist before publishing.');
const remote = git('remote', 'get-url', 'origin');
if (!/github\.com[:/]sebastianblue\/2048(?:\.git)?$/.test(remote)) {
  throw new Error('This publisher expects origin to be sebastianblue/2048.');
}
const source = git('rev-parse', 'HEAD');
const tree = git('rev-parse', 'HEAD:dist');
const previous = git('ls-remote', 'origin', 'refs/heads/gh-pages').split(/\s/)[0];
const parents = [];
if (previous) {
  git('fetch', 'origin', 'gh-pages');
  parents.push('-p', git('rev-parse', 'FETCH_HEAD'));
}
const commit = git('commit-tree', tree, ...parents, '-m', `Publish 2048: ANTE from ${source}`);
execFileSync('git', ['push', 'origin', `${commit}:refs/heads/gh-pages`], {cwd, stdio:'inherit'});
console.log('Published game files. GitHub Pages will update https://sebastianblue.github.io/2048/');
