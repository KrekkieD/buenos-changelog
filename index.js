const $childProcess = require('child_process');
const $path = require('path');
const $fs = require('fs');

const $upTheTree = require('up-the-tree');
const $semver = require('semver');
const $through = require('through2');
const $conventionalCommitsParser = require('conventional-commits-parser');
const $conventionalChangelogWriter = require('conventional-changelog-writer');
const $conventionalChangelogAngular = require('conventional-changelog-angular');

const gitRoot = $upTheTree('.git');
const $packageJson = require($path.resolve(gitRoot, 'package.json'));

const maxConcurrentExec = 5;
let currentConcurrentExec = 0;

const cmdQueue = [];

const DEFAULT_INCLUDE_TYPES = [
    'feature',
    'bugfix',
    'perf',
    'docs',
    'style'
];

const DEFAULT_TYPE_MAP = {
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
};

const changelogConfig = _readConfig(gitRoot);

const includeTypes = changelogConfig.includeTypes || DEFAULT_INCLUDE_TYPES;
const typeMap = changelogConfig.typeMap || DEFAULT_TYPE_MAP;
const repoCompareUrl = changelogConfig.repoCompareUrl || null;
const jiraUrl = changelogConfig.jiraUrl || null;

_getAllCommits()
    .then(commits => {

        const promises = [];

        commits
            .filter(_filterUnwantedCommits)
            .forEach(commit => {

                const promise = _queueCommand(() => _getCommitTag(commit.hash))
                    .then(tag => {
                        commit.tag = tag;
                        return true;
                    });

                promises.push(promise);

            });

        _startQueue();

        return Promise.all(promises).then(() => commits.filter(commit => !!commit.tag));

    })
    .then(commits => {

        getWriterOpts().then(config => {

            // sort commits by git tag
            const taggedCommits = {};
            commits.forEach(commit => {
                taggedCommits[commit.tag] = taggedCommits[commit.tag] || [];
                taggedCommits[commit.tag].push(commit);
            });

            // sort the tags by order
            const orderedTags = Object.keys(taggedCommits).sort((a, b) => {
                if (a === b) { return 0; }
                return $semver.gt(a, b) ? 1 : -1;
            });

            let markdownPromise = Promise.resolve('');
            let previousTag;
            orderedTags.forEach(tag => {

                const markdownTag = (markdownSoFar) => new Promise((resolve) => {

                    // sort commits in tag
                    taggedCommits[tag].sort((a, b) => {
                        if (a.unixtime === b.unixtime) { return 0; }
                        return a.unixtime > b.unixtime ? -1 : 1;
                    });

                    const upstream = $through.obj();
                    taggedCommits[tag].forEach(commit => {
                        upstream.write(commit);
                    });
                    upstream.end();

                    upstream.pipe($conventionalChangelogWriter({
                        version: tag,
                        repoUrl: $packageJson.repository.url,
                        linkCompare: !!previousTag,
                        previousTag: previousTag,
                        currentTag: tag
                    }, config))
                        .on('data', data => {
                            previousTag = tag;
                            resolve(data + (markdownSoFar || ''));
                        });

                });

                markdownPromise = markdownPromise.then(markdownTag);

            });

            markdownPromise.then(result => {
                console.log(result);
            })

        });

    })
    .catch(err => console.error(err));

function _getAllCommits () {

    const DELIMITER = '------------------------ >8 ------------------------';

    const cmd = 'git --no-pager log --format="%h:%ct:%B%n' + DELIMITER + '"';
    return new Promise((resolve, reject) => {
        $childProcess.exec(cmd, (err, stdout, stderr) => {
            if (stderr) {
                reject(stderr);
            } else {
                resolve(stdout.split(DELIMITER));
            }
        });
    }).then(commits => {

        const parsedCommits = [];
        commits.forEach(commit => {

            // console.log(commit);
            const parts = commit.split(':');
            const commitId = (parts.shift() || '').trim();
            const unixtime = parseInt((parts.shift() || '').trim(), 10);
            const commitMessage = parts.join(':');

            if (!commitId.trim()) { return; }
            if (!commitMessage.trim()) { return; }

            commit = $conventionalCommitsParser.sync(commitMessage);
            commit.unixtime = unixtime;
            commit.hash = commitId;

            parsedCommits.push(commit);
        });

        return parsedCommits;

    });

}

function _getCommitTag (commit) {
    return new Promise((resolve, reject) => {
        $childProcess.exec('git describe --contains ' + commit, (err, stdout, stderr) => {
            if (err || stderr) {
                reject(err || stderr);
            } else {
                const version = stdout.split(/[~^]/)[0].trim();
                resolve(version);
            }
        });
    });
}


function _queueCommand (cmd) {

    const promise = new Promise((resolve) => cmdQueue.push(resolve))
        .then(() => cmd());

    promise.then(() => {
        currentConcurrentExec--;
        _runQueue();
    });

    return promise;

}

function _runQueue () {

    const resolver = cmdQueue.shift();

    if (resolver) {
        currentConcurrentExec++;

        resolver();
    }

}

function _startQueue () {
    for (let i = 0; i < maxConcurrentExec; i++) {
        _runQueue();
    }
}


function _filterUnwantedCommits (commit) {

    return includeTypes.indexOf(commit.type) > -1 || commit.notes.length;

}

function getWriterOpts () {

    return $conventionalChangelogAngular.then(config => {

        // overwrite the default transform function so it uses our types (and our jira)
        config.writerOpts.transform = function(commit) {
            const issues = [];

            commit.notes.forEach(note => note.title = 'BREAKING CHANGES');

            commit.type = typeMap[commit.type] || commit.type;

            if (commit.scope === '*') {
                commit.scope = '';
            }

            if (typeof commit.hash === 'string') {
                commit.hash = commit.hash.substring(0, 7);
            }

            if (typeof commit.subject === 'string' && jiraUrl) {
                commit.subject = commit.subject.replace(/</g, '&lt;');
                // add link to jira for things that look like issue numbers
                commit.subject = commit.subject.replace(/((\b[A-Z]{3,}-\d+\b)+)/g, '[$1](' + jiraUrl + '$1)');
            }

            // remove references that already appear in the subject
            commit.references = commit.references.filter(reference => issues.indexOf(reference.issue) === -1);

            return commit;
        };

        if (repoCompareUrl) {
            config.writerOpts.headerPartial = config.writerOpts.headerPartial.replace('/compare/{{previousTag}}...{{currentTag}}', repoCompareUrl);
        }

        return config.writerOpts;

    });

}

function _readConfig (gitRoot) {

    try {
        return JSON.parse($fs.readFileSync($path.resolve(gitRoot, '.changelog.json')).toString());
    } catch (e) {
        return {};
    }

}
