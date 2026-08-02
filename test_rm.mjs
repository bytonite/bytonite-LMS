
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';

const markdown = \<pre><div class='code-block-wrapper' data-language='auto'><div class='code-block-content'>line1\nline2\nline3</div></div></pre>\;

const element = React.createElement(ReactMarkdown, {
    rehypePlugins: [rehypeRaw],
    children: markdown
});

const html = ReactDOMServer.renderToStaticMarkup(element);
console.log(html);
