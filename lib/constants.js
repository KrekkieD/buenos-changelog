const $upTheTree = require('up-the-tree');

module.exports = {
  UNRELEASED: 'UNRELEASED',
  GIT_ROOT: $upTheTree('.git'),
  CONFIG_FILE: '.changelog.json'
};
