const TurndownService = require('turndown');
const td = new TurndownService();
td.keep(['div', 'span', 'br']);
console.log("Output:");
console.log(td.turndown('<div class="grid-cell"><br class="empty-cell-placeholder" style="display:none" /></div>'));
