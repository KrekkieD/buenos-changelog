const $semver = require('semver');

const $constants = require('./constants');

module.exports = {
  sortTags,
  filterUnwantedCommits,
  groupCommitsByTag
};

function sortTags (tags) {
  return tags.sort((a, b) => {
    if (a === b) { return 0; }
    if (a === $constants.UNRELEASED) { return 1; }
    if (b === $constants.UNRELEASED) { return -1; }
    return $semver.gt(a, b) ? 1 : -1;
  });
}

function filterUnwantedCommits (config, commits) {
  return commits.filter(commit => config.includeTypes.indexOf(commit.type) > -1 || commit.notes.length);
}

function groupCommitsByTag (commits) {
  const taggedCommits = {};
  commits.forEach(commit => {
    taggedCommits[commit.tag] = taggedCommits[commit.tag] || [];
    taggedCommits[commit.tag].push(commit);
  });
  return taggedCommits;
}
