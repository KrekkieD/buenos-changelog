const $childProcess = require('child_process');

const $semver = require('semver');
const $conventionalCommitsParser = require('conventional-commits-parser');

const $constants = require('./constants');

module.exports = {
  getCommitTag,
  getAllCommits
};

function getCommitTag (commit) {
  return new Promise((resolve, reject) => {
    $childProcess.exec(`git describe --contains ${commit}`, (err, stdout, stderr) => {

      if (stderr && stderr.indexOf('fatal: cannot describe') === 0) {
        return resolve($constants.UNRELEASED);
      }
      if (err || stderr) {
        return reject(err || stderr);
      }

      const version = stdout.split(/[~^]/)[0].trim();
      return resolve($semver.valid(version) ? version : undefined);
    });
  });
}

function getAllCommits () {

  return new Promise((resolve, reject) => {
    const DELIMITER = '------------------------ >8 ------------------------';

    const gitlog = $childProcess.spawn('git', ['--no-pager', 'log', '--format=%h:%ct:%B%n' + DELIMITER + '']);
    const commits = [];
    gitlog.stdout.on('data', (data) => {
      Array.prototype.push.apply(commits, data.toString().split(DELIMITER));
    });
    gitlog.stdout.on('end', () => {
      resolve(commits.filter(commit => !!commit.trim()));
    });

  }).then(commits => {

    const parsedCommits = [];
    commits.forEach(commit => {

      const [ commitId, unixtime, ...messageParts ] = commit.split(':');
      const commitMessage = messageParts.join(':');

      if (!commitId.trim() || !commitMessage.trim()) {
        return;
      }

      commit = $conventionalCommitsParser.sync(commitMessage, {
        headerPattern: /^(\w*)(?:\(([\w$.\-*@\/ ]*)\))?: (.*)$/
      });

      commit.unixtime = parseInt((unixtime || '').trim(), 10);
      commit.hash = commitId.trim();

      parsedCommits.push(commit);
    });

    return parsedCommits;

  });

}
