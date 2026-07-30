import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeRaw from 'rehype-raw';
import rehypeStringify from 'rehype-stringify';
import { visit } from 'unist-util-visit';

function rehypeSourceLine() {
  return (tree) => {
    visit(tree, 'element', (node) => {
      if (node.position && node.position.start && node.position.end) {
        node.properties = node.properties || {};
        node.properties['data-sourcepos'] = `${node.position.start.line}:${node.position.start.column}-${node.position.end.line}:${node.position.end.column}`;
      }
    });
  };
}

function remarkInjectSourcePos() {
  return (tree) => {
    visit(tree, 'html', (node) => {
      if (node.position && node.position.start) {
        if (node.value && typeof node.value === 'string') {
           const lines = node.value.split('\n');
           const startLine = node.position.start.line;
           for (let i = 0; i < lines.length; i++) {
               const currentLineNum = startLine + i;
               const pos = `${currentLineNum}:1-${currentLineNum}:100`;
               lines[i] = lines[i].replace(/<([a-zA-Z0-9-]+)(?=\s|>)/g, `<$1 data-sourcepos="${pos}"`);
           }
           node.value = lines.join('\n');
        }
      }
    });
  };
}

const processor = unified()
  .use(remarkParse)
  .use(remarkInjectSourcePos)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeRaw)
  .use(rehypeSourceLine)
  .use(rehypeStringify);

const markdown = `<div class="dashboard-grid">
  <div class="grid-cell"></div>
</div>`;

const result = processor.runSync(processor.parse(markdown));
console.log(JSON.stringify(result, null, 2));
