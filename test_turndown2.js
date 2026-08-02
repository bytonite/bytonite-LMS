
const TurndownService = require('turndown');
const turndownService = new TurndownService();
turndownService.addRule('syntaxHighlighter', {
    filter: (node) => node.className === 'code-block-wrapper',
    replacement: (_content, node) => {
        let codeText = 'line1\nline2\nline3';
        return '<pre><div class=\'code-block-wrapper\' data-language=\'auto\'><div class=\'code-block-content\'>' + codeText + '</div></div></pre>';
    }
});
const markdown = turndownService.turndown('<div class=\'code-block-wrapper\'>foo</div>');
console.log(JSON.stringify(markdown));
