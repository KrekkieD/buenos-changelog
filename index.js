const $through = require('through2');
const $conventionalChangelogWriter = require('conventional-changelog-writer');

const $git = require('./lib/git');
const $constants = require('./lib/constants');
const $config = require('./lib/config');
const $utils = require('./lib/utils');
const $output = require('./lib/output');

const changelogConfig = $config.getConfig();

Promise.all([changelogConfig, $git.getAllCommits()])
  .then(([ config, commits ]) => $utils.filterUnwantedCommits(config, commits))
  .then(commits => {

    return commits.reduce((promise, commit) => {
      return promise
        .then(() => $git.getCommitTag(commit.hash))
        .then(tag => commit.tag = tag)
        .then(() => commits);

    }, Promise.resolve());

  })
  .then(commits => commits.filter(commit => !!commit.tag))
  .then(commits => Promise.all([ commits, changelogConfig ]))
  .then(([ commits, config ]) => {

    // sort commits by git tag
    const taggedCommits = $utils.groupCommitsByTag(commits);

    // sort the tags by order
    const orderedTags = $utils.sortTags(Object.keys(taggedCommits));

    let previousTag;
    const markdownPromise = orderedTags.reduce((promise, tag) => {
      return promise.then(markdownSoFar => new Promise(resolve => {

        // sort commits in tag
        taggedCommits[tag].sort((a, b) => {
          if (a.unixtime === b.unixtime) { return 0; }
          return a.unixtime > b.unixtime ? -1 : 1;
        });

        const changelogWriter = $conventionalChangelogWriter({
          version: tag,
          repoUrl: config.repositoryUrl,
          linkCompare: !!previousTag && tag !== $constants.UNRELEASED,
          previousTag: previousTag,
          currentTag: tag
        }, config.writerOpts);

        const upstream = $through.obj();
        taggedCommits[tag].forEach(commit => upstream.write(commit));
        upstream.end();

        upstream
          .pipe(changelogWriter)
          .on('data', data => {
            previousTag = tag;
            resolve(data + markdownSoFar);
          });

      }));

    }, Promise.resolve(''));

    return Promise.all([ markdownPromise, config ]);

  })
  .then(([ markdown, config ]) => {
    if (config.targetsMarkdown && config.targetsMarkdown.length) {
      $output.asMarkdown(markdown, config.targetsMarkdown);
    }
    if (config.targetsConfluenceMarkup && config.targetsConfluenceMarkup.length) {
      $output.asConfluenceMarkup(markdown, config.targetsConfluenceMarkup);
    }
    if (config.targetsHtml && config.targetsHtml.length) {
      $output.asHtml(markdown, config.targetsHtml);
    }
    return markdown;
  })
  .then(result => console.log(result))
  .catch(err => console.error(err));
