const TurndownService = require('turndown'); 
const td = new TurndownService({
    blankReplacement: function (content, node) {
        if (node.nodeName === 'DIV') {
            const cls = node.getAttribute('class') || '';
            const style = node.getAttribute('style') || '';
            const styleAttr = style ? ` style="${style}"` : '';
            const clsAttr = cls ? ` class="${cls}"` : '';
            return `\n<div${clsAttr}${styleAttr}></div>\n`;
        }
        return content;
    }
}); 
td.keep(['div']); 
console.log(td.turndown('<div class="dashboard-grid"><div class="grid-cell grid-span-4"></div><div class="grid-cell grid-span-4"></div></div>'));
