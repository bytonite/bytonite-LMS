const { JSDOM } = require('jsdom');
const dom = new JSDOM('<div data-sourcepos="1:1-1:100"></div>');
console.log(dom.window.document.querySelector('[data-sourcepos="1:1-1:100"]') !== null);
