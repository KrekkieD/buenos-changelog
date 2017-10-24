const $fs = require('fs');
const $path = require('path');

const $marked = require('marked');
const $markdownToConfluence = require('markdown2confluence');
const $stripTags = require('striptags');

module.exports = {
  asMarkdown,
  asHtml,
  asConfluenceMarkup
};

function asMarkdown (markdown, targets) {
  _writeTargets(targets, markdown);
}

function asConfluenceMarkup (markdown, targets) {
  const confluenceMarkdown = $stripTags($markdownToConfluence(markdown));
  _writeTargets(targets, confluenceMarkdown);
}

function asHtml (markdown, targets) {
  const html = _markdownToHtml(markdown);
  _writeTargets(targets, html);
}

function _markdownToHtml (markdown) {

  $marked.setOptions({
    renderer: new $marked.Renderer(),
    gfm: true,
    tables: true,
    breaks: false,
    pedantic: false,
    sanitize: false,
    smartLists: false,
    smartypants: false
  });

  return $marked(markdown);

}

function _writeTargets (targets, content) {
  targets.forEach(target => {
    $fs.writeFileSync($path.resolve('.', target), content);
  });
}
