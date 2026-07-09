import React from 'react';
import { renderToString } from 'react-dom/server';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { visit } from 'unist-util-visit';

function rehypeSourceLine() {
  return (tree) => {
    visit(tree, 'element', (node) => {
      if (node.position && node.position.start && node.position.end) {
        node.properties = node.properties || {};
        node.properties['data-sourcepos'] = `${node.position.start.line}:${node.position.start.column}-${node.position.end.line}:${node.position.end.column}`;
      } else {
        node.properties = node.properties || {};
        node.properties['data-no-pos'] = 'true';
      }
    });
  };
}

const markdown = `
# Hello
<div class="test">Raw HTML</div>
* list item
`;

const html = renderToString(
  React.createElement(ReactMarkdown, {
    remarkPlugins: [remarkGfm],
    rehypePlugins: [rehypeRaw, rehypeSourceLine],
    children: markdown
  })
);

console.log(html);
