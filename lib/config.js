const $path = require('path');
const $fs = require('fs');

const $conventionalChangelogAngular = require('conventional-changelog-angular');

const $constants = require('./constants');

module.exports = {
  getConfig,
  getWriterOpts
};

const DEFAULT_CONFIG = {
  includeTypes: [
    'feature',
    'bugfix',
    'perf',
    'docs',
    'style'
  ],
  typeMap: {
    feature: 'Features',
    bugfix: 'Bug Fixes',
    perf: 'Performance Improvements',
    docs: 'Documentation',
    style: 'Styles',
    refactor: 'Code Refactoring',
    test: 'Tests',
    build: 'Builds',
    ci: 'Continuous Integration',
    format: 'Code Formatting',
    merge: 'Merges',
    version: 'Versioning'
  },
  repoCompareUrl: null,
  jiraUrl: null
};

function getConfig () {

  const config = Object.assign({}, DEFAULT_CONFIG, _readConfig());

  return getWriterOpts(config)
    .then(writerOpts => Object.assign(config, { writerOpts }));

}
function _readConfig () {

  try {
    return JSON.parse($fs.readFileSync($path.resolve($constants.GIT_ROOT, $constants.CONFIG_FILE)).toString());
  } catch (e) {
    return {};
  }

}

function getWriterOpts (config) {

  return $conventionalChangelogAngular.then(({ writerOpts }) => {

    // overwrite the default transform function so it uses our types (and our jira)
    writerOpts.transform = commit => {
      const issues = [];

      commit.notes.forEach(note => note.title = 'BREAKING CHANGES');

      commit.type = config.typeMap[commit.type] || commit.type;

      if (commit.scope === '*') {
        commit.scope = '';
      }

      if (typeof commit.hash === 'string') {
        commit.hash = commit.hash.substring(0, 7);
      }

      if (typeof commit.subject === 'string' && config.jiraUrl) {
        commit.subject = commit.subject.replace(/</g, '&lt;');
        // add link to jira for things that look like issue numbers
        commit.subject = commit.subject.replace(/((\b[A-Z]{3,}-\d+\b)+)/g, '[$1](' + config.jiraUrl + '$1)');
      }

      // remove references that already appear in the subject
      commit.references = commit.references.filter(reference => issues.indexOf(reference.issue) === -1);

      return commit;
    };

    if (config.repoCompareUrl) {
      writerOpts.headerPartial = writerOpts.headerPartial.replace('/compare/{{previousTag}}...{{currentTag}}', config.repoCompareUrl);
    }

    return writerOpts;

  });

}
