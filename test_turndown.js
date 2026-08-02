
const { JSDOM } = require('jsdom');
const dom = new JSDOM(\
<div class='code-block-content'>
    <div><span class='token'>line1</span></div>
    <div><span class='token'>line2</span></div>
</div>
\);
const extractTextWithNewlines = (node) => {
    let text = '';
    const processNode = (n) => {
        if (n.nodeType === 3) {
            text += n.textContent || '';
        } else if (n.nodeType === 1) {
            const el = n;
            const tagName = el.tagName.toLowerCase();
            if (tagName === 'br') {
                text += '\n';
            } else if (tagName === 'div' || tagName === 'p' || tagName === 'li') {
                if (text.length > 0 && !text.endsWith('\n')) text += '\n';
                Array.from(el.childNodes).forEach(processNode);
                if (text.length > 0 && !text.endsWith('\n')) text += '\n';
            } else {
                Array.from(el.childNodes).forEach(processNode);
            }
        }
    };
    processNode(node);
    return text.replace(/\n$/, '');
};
console.log(JSON.stringify(extractTextWithNewlines(dom.window.document.querySelector('.code-block-content'))));
