const $fs = require('fs');
const $path = require('path');

const $marked = require('marked');

module.exports = {
  asMarkdown,
  asHtml
};

function asMarkdown (markdown, targets) {
  _writeTargets(targets, markdown);
}

function asHtml (markdown, targets) {
  const html = _markdownToHtml(markdown);
  _writeTargets(targets, html);
}

function _markdownToHtml (markdown) {

  $marked.setOptions({
    renderer: new $marked.Renderer(),
    gfm: true,
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
