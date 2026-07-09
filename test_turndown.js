const TurndownService = require('turndown'); 
const td = new TurndownService(); 
td.keep(['div']); 
console.log(td.turndown('<div class="dashboard-grid"><div class="grid-cell grid-span-4">&nbsp;</div><div class="grid-cell grid-span-4">&#8203;</div></div>'));
