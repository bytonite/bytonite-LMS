const TurndownService = require('turndown');
const td = new TurndownService();
td.addRule('keepGrid', {
    filter: function(node) {
        return node.nodeName === 'DIV' && 
               (node.classList.contains('dashboard-grid') || 
                node.classList.contains('grid-cell') || 
                node.classList.contains('flex-row') || 
                node.classList.contains('flex-col'));
    },
    replacement: function(content, node) {
        const cls = node.getAttribute('class') || '';
        const style = node.getAttribute('style') || '';
        const styleAttr = style ? ` style="${style}"` : '';
        const clsAttr = cls ? ` class="${cls}"` : '';
        
        // Ensure content is not entirely empty/whitespace
        let inner = content;
        if (!inner || inner.trim() === '') {
            inner = '&#8203;'; // Zero-width space
        }
        
        return `\n<div${clsAttr}${styleAttr}>${inner}</div>\n`;
    }
});
td.keep(['div', 'span']); 
console.log(td.turndown('<div class="dashboard-grid"><div class="grid-cell grid-span-4"></div><div class="grid-cell grid-span-4"></div></div>'));
