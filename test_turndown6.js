const TurndownService = require('turndown');
const td = new TurndownService();
td.keep(['div', 'span']);
const jsdom = require('jsdom');
const dom = new jsdom.JSDOM('<div class="dashboard-grid"><div class="grid-cell grid-span-4"></div><div class="grid-cell grid-span-4"></div></div>');
const doc = dom.window.document;

doc.querySelectorAll('.grid-cell, .dashboard-grid, .flex-row, .flex-col').forEach(el => {
    if (el.innerHTML.trim() === '') {
        el.innerHTML = '&#8203;';
    }
});

console.log(td.turndown(doc.body.innerHTML));
