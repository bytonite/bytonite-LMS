const TurndownService = require('turndown'); 
const td = new TurndownService(); 
td.addRule('keepEmptyGridCells', {
    filter: function (node) {
        return node.nodeName === 'DIV' && (node.classList.contains('grid-cell') || node.classList.contains('dashboard-grid') || node.classList.contains('flex-row') || node.classList.contains('flex-col'));
    },
    replacement: function (content, node) {
        const cls = node.getAttribute('class') || '';
        const style = node.getAttribute('style') || '';
        const styleAttr = style ? ` style="${style}"` : '';
        const clsAttr = cls ? ` class="${cls}"` : '';
        return `\n<div${clsAttr}${styleAttr}>${content || '&#8203;'}</div>\n`;
    }
});
console.log(td.turndown('<div class="dashboard-grid"><div class="grid-cell grid-span-4"></div><div class="grid-cell grid-span-4"></div></div>'));
