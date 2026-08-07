import TurndownService from 'turndown';

/** Extract text while converting block elements and <br> into newlines */
export const extractTextWithNewlines = (node: Node): string => {
    let text = '';
    const processNode = (n: Node) => {
        if (n.nodeType === 3) {
            text += n.textContent || '';
        } else if (n.nodeType === 1) {
            const el = n as HTMLElement;
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

export const cleanHTML = (root: HTMLElement): string => {
    const clone = root.cloneNode(true) as HTMLElement;
    const traverse = (el: HTMLElement) => {
        // Remove attributes added by DnD or Editor
        el.removeAttribute('draggable');
        el.removeAttribute('contenteditable');
        el.removeAttribute('spellcheck');
        el.removeAttribute('data-collapsible'); 
        el.removeAttribute('data-sourcepos');
        
        // Remove DnD and resize classes
        el.classList.remove('sortable-dragging', 'sortable-drop-target', 'draggable-block', 'draggable-hover', 'cell-drop-active', 'row-drop-active', 'live-highlight', 'resizable', 'resizing', 'selected-block');
        if (el.classList.length === 0) el.removeAttribute('class');

        // Remove specific styles added by our JS (just in case stale ones exist)
        el.style.cursor = '';
        el.style.outline = '';
        el.style.opacity = '';
        
        // Remove 'node' attribute if leaked
        el.removeAttribute('node');

        // If style is empty, remove it
        if (el.getAttribute('style') === '') el.removeAttribute('style');

        Array.from(el.children).forEach(child => traverse(child as HTMLElement));
    };
    
    // Explicitly remove code block headers and resize handles logic BEFORE traversal
    const headers = clone.querySelectorAll('.code-block-header');
    headers.forEach(h => h.remove());
    
    const handles = clone.querySelectorAll('.resize-handle, .custom-drag-handle');
    handles.forEach(h => h.remove());

    // Remove empty <p> and stray <br> that the browser injects inside grid-cell
    // when contenteditable is active (they cause extra bottom space mismatch
    // between Design Mode and Reading Mode)
    clone.querySelectorAll('.grid-cell > p, .grid-cell > br').forEach(el => {
        const isEmptyP = el.tagName === 'P' && (el.textContent || '').trim() === '';
        const isBr = el.tagName === 'BR';
        if (isEmptyP || isBr) el.remove();
    });

    // Fix code-block-wrappers: extract text with newlines and rebuild them cleanly
    const codeWrappers = clone.querySelectorAll('.code-block-wrapper');
    codeWrappers.forEach(wrapper => {
        if (!clone.contains(wrapper)) return;
        
        let deepest = wrapper;
        while (deepest.querySelector('.code-block-wrapper')) {
            deepest = deepest.querySelector('.code-block-wrapper') as HTMLElement;
        }
        
        const codeEl = deepest.querySelector('code');
        const contentWrapper = deepest.querySelector('.code-block-content');
        const language = wrapper.getAttribute('data-language') || '';
        
        let codeText = extractTextWithNewlines(codeEl || contentWrapper || deepest);
        
        // Replace wrapper content with clean structure
        wrapper.innerHTML = '';
        const contentDiv = document.createElement('div');
        contentDiv.className = 'code-block-content';
        contentDiv.textContent = codeText; // Automatically escapes <, >, & safely
        wrapper.appendChild(contentDiv);
        wrapper.setAttribute('data-language', language);
        
        // Wrap in <pre> to preserve whitespace when parsed by react-markdown later
        if (wrapper.parentElement && wrapper.parentElement.tagName !== 'PRE') {
            const pre = document.createElement('pre');
            wrapper.parentElement.insertBefore(pre, wrapper);
            pre.appendChild(wrapper);
        }
    });

    // Clean up media wrappers: transfer styles to inner img/video, then unwrap
    const mediaWrappers = clone.querySelectorAll('.media-wrapper');
    mediaWrappers.forEach(wrapper => {
        const htmlWrapper = wrapper as HTMLElement;
        const innerMedia = htmlWrapper.querySelector('img, video') as HTMLElement;
        if (innerMedia) {
            if (htmlWrapper.style.width) innerMedia.style.width = htmlWrapper.style.width;
            if (htmlWrapper.style.height) innerMedia.style.height = htmlWrapper.style.height;
            if (htmlWrapper.style.maxWidth) innerMedia.style.maxWidth = htmlWrapper.style.maxWidth;
            htmlWrapper.parentNode?.replaceChild(innerMedia, htmlWrapper);
        } else {
            htmlWrapper.remove();
        }
    });

    traverse(clone);
    
    // Prevent Turndown from stripping empty layout elements
    const layoutElements = clone.querySelectorAll('.grid-cell, .dashboard-grid, .flex-row, .flex-col');
    layoutElements.forEach(el => {
        const html = el.innerHTML.trim();
        if (html === '' || html === '&#8203;') {
            el.innerHTML = '<br class="empty-cell-placeholder" style="display:none" />';
        }
    });

    return clone.innerHTML;
};

export const htmlToMarkdown = (html: string): string => {
    const turndownService = new TurndownService({
        headingStyle: 'atx',
        codeBlockStyle: 'fenced',
        emDelimiter: '*'
    });

    // Prevent default pre rule from swallowing custom block outputs
    turndownService.addRule('preWrapper', {
        filter: (node) => {
            if (node.nodeName !== 'PRE') return false;
            // Check if it wraps a custom block
            if (node.firstElementChild) {
                const el = node.firstElementChild as HTMLElement;
                return el.classList.contains('code-block-wrapper') || el.classList.contains('mermaid-diagram-wrapper');
            }
            return false;
        },
        replacement: (content) => content
    });

    // Custom rule for Code Blocks (SyntaxHighlighter)
    turndownService.addRule('syntaxHighlighter', {
        filter: (node) => {
            return node.classList && node.classList.contains('code-block-wrapper');
        },
        replacement: (_content, node) => {
            const element = node as HTMLElement;
            const language = element.getAttribute('data-language') || '';
            
            let codeText = '';
            // Try to find the content wrapper first (new structure)
            const contentWrapper = element.querySelector('.code-block-content');
            if (contentWrapper) {
                const codeEl = contentWrapper.querySelector('code');
                codeText = extractTextWithNewlines(codeEl || contentWrapper);
            } else {
                // Fallback: iterate children and skip header (legacy support)
                element.childNodes.forEach((child) => {
                    const el = child as HTMLElement;
                    if (el.nodeType === 1 && !el.classList.contains('code-block-header')) {
                        codeText += extractTextWithNewlines(el);
                    }
                });
            }
            
            return `\n\`\`\`${language}\n${codeText}\n\`\`\`\n`;
        }
    });

    // Custom rule for Mermaid Diagrams
    turndownService.addRule('mermaidDiagram', {
        filter: (node) => {
            return node.classList && node.classList.contains('mermaid-diagram-wrapper');
        },
        replacement: (_content, node) => {
            const element = node as HTMLElement;
            // Use clean code (no zoom comment) + re-add zoom from current attribute
            const code = element.getAttribute('data-mermaid-code') || '';
            const zoomAttr = element.getAttribute('data-mermaid-zoom');
            const zoomLine = zoomAttr ? `\n%% zoom: ${zoomAttr}` : '';
            return `\n\`\`\`mermaid\n${code}${zoomLine}\n\`\`\`\n`;
        }
    });

    // Custom rule for Diagram Callout (Excalidraw)
    turndownService.addRule('diagramCallout', {
        filter: (node) => {
            return node.nodeName === 'DIV'
                && node.classList.contains('callout')
                && node.classList.contains('callout-diagram');
        },
        replacement: (_content, node) => {
            const element   = node as HTMLElement;
            const titleEl   = element.querySelector('.callout-title-inner');
            const title     = titleEl?.textContent?.trim() || 'Диаграмма';
            const encoded   = element.getAttribute('data-diagram') || '';
            const width     = element.getAttribute('data-diagram-width')  || '0';
            const height    = element.getAttribute('data-diagram-height') || '0';

            // data-diagram is URI-encoded — decode before writing to markdown
            let dataJson = '';
            if (encoded) {
                try { dataJson = decodeURIComponent(encoded); } catch { dataJson = encoded; }
            }

            if (dataJson && (dataJson.startsWith('{') || dataJson.startsWith('<svg'))) {
                // Store SVG/JSON in a fenced code block tagged "drawio"
                const indentedData = dataJson.replace(/\n/g, '\n> ');
                return `\n> [!diagram] ${title}\n> \`\`\`drawio\n> ${indentedData}\n> \`\`\`\n> <!-- w:${width} h:${height} -->\n`;
            }
            // Empty diagram (no data yet)
            return `\n> [!diagram] ${title}\n`;
        }
    });




    turndownService.addRule('image', {
        filter: 'img',
        replacement: function (_content, node) {
            const alt = (node as Element).getAttribute('alt') || '';
            const src = (node as Element).getAttribute('src') || '';
            return src ? `![${alt}](<${src}>)` : '';
        }
    });

    // Custom rule to preserve <p> tags if they have inline styles
    turndownService.addRule('styledParagraphs', {
        filter: (node) => node.nodeName === 'P' && node.hasAttribute('style'),
        replacement: (content, node) => {
            const style = (node as HTMLElement).getAttribute('style');
            return `\n\n<p style="${style}">${content}</p>\n\n`;
        }
    });

    // Preserve standard HTML tags for layout (Moved to end to allow custom rules to fire first)
    turndownService.keep(['div', 'span', 'table', 'tbody', 'tr', 'td', 'th', 'font', 'video', 'br', 'pre'] as any);

    return turndownService.turndown(html);
};

export const markdownToHtmlHelper = (md: string): string => {
    // Callout Detection
    const calloutRegex = /^(?:>\s?)?\[!(\w+)\](.*)/;
    const match = md.match(calloutRegex);
    
    if (match) {
        const type = match[1];
        const title = match[2].trim() || type;
        const contentBody = md.split('\n').slice(1).join('\n').replace(/^>\s?/gm, '').trim();
        
    // Check for collapse syntax (+/-)
    const typeMatch = type.match(/^(\w+)([-+]?)$/);
    const cleanType = typeMatch ? typeMatch[1] : type;
    const collapseChar = typeMatch ? typeMatch[2] : '';
    const isFoldable = collapseChar !== '';
    
    // Dynamic icon selection based on callout type
    const iconSvgMap: Record<string, string> = {
        // Info / Note
        info: '<svg width="18" height="18" viewBox="0 0 512 512" fill="currentColor"><path d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zm0-384c13.3 0 24 10.7 24 24V264c0 13.3-10.7 24-24 24s-24-10.7-24-24V152c0-13.3 10.7-24 24-24zM224 352a32 32 0 1 1 64 0 32 32 0 1 1 -64 0z"/></svg>',
        note: '<svg width="18" height="18" viewBox="0 0 512 512" fill="currentColor"><path d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zm0-384c13.3 0 24 10.7 24 24V264c0 13.3-10.7 24-24 24s-24-10.7-24-24V152c0-13.3 10.7-24 24-24zM224 352a32 32 0 1 1 64 0 32 32 0 1 1 -64 0z"/></svg>',
        // Important / Tip / Hint - Fire
        important: '<svg width="18" height="18" viewBox="0 0 448 512" fill="currentColor"><path d="M159.3 5.4c7.8-7.3 19.9-7.2 27.7 .1c27.6 25.9 53.5 53.8 77.7 84c11-14.4 23.5-30.1 37-42.9c7.9-7.4 20.1-7.4 28 .1c34.6 33 63.9 76.6 84.5 118c20.3 40.8 33.8 82.5 33.8 111.9C448 404.2 348.2 512 224 512C98.4 512 0 404.1 0 276.5c0-38.4 17.8-85.3 45.4-131.7C73.3 97.7 112.7 48.6 159.3 5.4zM225.7 416c25.3 0 47.7-7 68.8-21c42.1-29.4 53.4-88.2 28.1-134.4c-4.5-9-16-9.6-22.5-2l-25.2 29.3c-6.6 7.6-18.5 7.4-24.7-.5c-16.5-21-46-58.5-62.8-79.8c-6.3-8-18.3-8.1-24.7-.1c-33.8 42.5-50.8 69.3-50.8 99.4C112 375.4 162.6 416 225.7 416z"/></svg>',
        tip: '<svg width="18" height="18" viewBox="0 0 448 512" fill="currentColor"><path d="M159.3 5.4c7.8-7.3 19.9-7.2 27.7 .1c27.6 25.9 53.5 53.8 77.7 84c11-14.4 23.5-30.1 37-42.9c7.9-7.4 20.1-7.4 28 .1c34.6 33 63.9 76.6 84.5 118c20.3 40.8 33.8 82.5 33.8 111.9C448 404.2 348.2 512 224 512C98.4 512 0 404.1 0 276.5c0-38.4 17.8-85.3 45.4-131.7C73.3 97.7 112.7 48.6 159.3 5.4zM225.7 416c25.3 0 47.7-7 68.8-21c42.1-29.4 53.4-88.2 28.1-134.4c-4.5-9-16-9.6-22.5-2l-25.2 29.3c-6.6 7.6-18.5 7.4-24.7-.5c-16.5-21-46-58.5-62.8-79.8c-6.3-8-18.3-8.1-24.7-.1c-33.8 42.5-50.8 69.3-50.8 99.4C112 375.4 162.6 416 225.7 416z"/></svg>',
        hint: '<svg width="18" height="18" viewBox="0 0 448 512" fill="currentColor"><path d="M159.3 5.4c7.8-7.3 19.9-7.2 27.7 .1c27.6 25.9 53.5 53.8 77.7 84c11-14.4 23.5-30.1 37-42.9c7.9-7.4 20.1-7.4 28 .1c34.6 33 63.9 76.6 84.5 118c20.3 40.8 33.8 82.5 33.8 111.9C448 404.2 348.2 512 224 512C98.4 512 0 404.1 0 276.5c0-38.4 17.8-85.3 45.4-131.7C73.3 97.7 112.7 48.6 159.3 5.4zM225.7 416c25.3 0 47.7-7 68.8-21c42.1-29.4 53.4-88.2 28.1-134.4c-4.5-9-16-9.6-22.5-2l-25.2 29.3c-6.6 7.6-18.5 7.4-24.7-.5c-16.5-21-46-58.5-62.8-79.8c-6.3-8-18.3-8.1-24.7-.1c-33.8 42.5-50.8 69.3-50.8 99.4C112 375.4 162.6 416 225.7 416z"/></svg>',
        // Question / Help / FAQ
        question: '<svg width="18" height="18" viewBox="0 0 512 512" fill="currentColor"><path d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM169.8 165.3c7.9-22.3 29.1-37.3 52.8-37.3h58.3c34.9 0 63.1 28.3 63.1 63.1c0 22.6-12.1 43.5-31.7 54.8L280 264.4c-.2 13-10.9 23.6-24 23.6c-13.3 0-24-10.7-24-24V250.5c0-8.6 4.6-16.5 12.1-20.8l44.3-25.4c4.7-2.7 7.6-7.7 7.6-13.1c0-8.4-6.8-15.1-15.1-15.1H222.6c-3.4 0-6.4 2.1-7.5 5.3l-.4 1.2c-4.4 12.5-18.2 19-30.6 14.6s-19-18.2-14.6-30.6l.4-1.2zM224 352a32 32 0 1 1 64 0 32 32 0 1 1 -64 0z"/></svg>',
        help: '<svg width="18" height="18" viewBox="0 0 512 512" fill="currentColor"><path d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM169.8 165.3c7.9-22.3 29.1-37.3 52.8-37.3h58.3c34.9 0 63.1 28.3 63.1 63.1c0 22.6-12.1 43.5-31.7 54.8L280 264.4c-.2 13-10.9 23.6-24 23.6c-13.3 0-24-10.7-24-24V250.5c0-8.6 4.6-16.5 12.1-20.8l44.3-25.4c4.7-2.7 7.6-7.7 7.6-13.1c0-8.4-6.8-15.1-15.1-15.1H222.6c-3.4 0-6.4 2.1-7.5 5.3l-.4 1.2c-4.4 12.5-18.2 19-30.6 14.6s-19-18.2-14.6-30.6l.4-1.2zM224 352a32 32 0 1 1 64 0 32 32 0 1 1 -64 0z"/></svg>',
        faq: '<svg width="18" height="18" viewBox="0 0 512 512" fill="currentColor"><path d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM169.8 165.3c7.9-22.3 29.1-37.3 52.8-37.3h58.3c34.9 0 63.1 28.3 63.1 63.1c0 22.6-12.1 43.5-31.7 54.8L280 264.4c-.2 13-10.9 23.6-24 23.6c-13.3 0-24-10.7-24-24V250.5c0-8.6 4.6-16.5 12.1-20.8l44.3-25.4c4.7-2.7 7.6-7.7 7.6-13.1c0-8.4-6.8-15.1-15.1-15.1H222.6c-3.4 0-6.4 2.1-7.5 5.3l-.4 1.2c-4.4 12.5-18.2 19-30.6 14.6s-19-18.2-14.6-30.6l.4-1.2zM224 352a32 32 0 1 1 64 0 32 32 0 1 1 -64 0z"/></svg>',
        // Error / Danger / Warning - Lightning bolt
        error: '<svg width="18" height="18" viewBox="0 0 448 512" fill="currentColor"><path d="M349.4 44.6c5.9-13.7 1.5-29.7-10.6-38.5s-28.6-8-39.9 1.8l-256 224c-10 8.8-13.6 22.9-8.9 35.3S50.7 288 64 288H175.5L98.6 467.4c-5.9 13.7-1.5 29.7 10.6 38.5s28.6 8 39.9-1.8l256-224c10-8.8 13.6-22.9 8.9-35.3s-16.6-20.7-30-20.7H272.5L349.4 44.6z"/></svg>',
        danger: '<svg width="18" height="18" viewBox="0 0 448 512" fill="currentColor"><path d="M349.4 44.6c5.9-13.7 1.5-29.7-10.6-38.5s-28.6-8-39.9 1.8l-256 224c-10 8.8-13.6 22.9-8.9 35.3S50.7 288 64 288H175.5L98.6 467.4c-5.9 13.7-1.5 29.7 10.6 38.5s28.6 8 39.9-1.8l256-224c10-8.8 13.6-22.9 8.9-35.3s-16.6-20.7-30-20.7H272.5L349.4 44.6z"/></svg>',
        fail: '<svg width="18" height="18" viewBox="0 0 448 512" fill="currentColor"><path d="M349.4 44.6c5.9-13.7 1.5-29.7-10.6-38.5s-28.6-8-39.9 1.8l-256 224c-10 8.8-13.6 22.9-8.9 35.3S50.7 288 64 288H175.5L98.6 467.4c-5.9 13.7-1.5 29.7 10.6 38.5s28.6 8 39.9-1.8l256-224c10-8.8 13.6-22.9 8.9-35.3s-16.6-20.7-30-20.7H272.5L349.4 44.6z"/></svg>',
        failure: '<svg width="18" height="18" viewBox="0 0 448 512" fill="currentColor"><path d="M349.4 44.6c5.9-13.7 1.5-29.7-10.6-38.5s-28.6-8-39.9 1.8l-256 224c-10 8.8-13.6 22.9-8.9 35.3S50.7 288 64 288H175.5L98.6 467.4c-5.9 13.7-1.5 29.7 10.6 38.5s28.6 8 39.9-1.8l256-224c10-8.8 13.6-22.9 8.9-35.3s-16.6-20.7-30-20.7H272.5L349.4 44.6z"/></svg>',
        bug: '<svg width="18" height="18" viewBox="0 0 448 512" fill="currentColor"><path d="M349.4 44.6c5.9-13.7 1.5-29.7-10.6-38.5s-28.6-8-39.9 1.8l-256 224c-10 8.8-13.6 22.9-8.9 35.3S50.7 288 64 288H175.5L98.6 467.4c-5.9 13.7-1.5 29.7 10.6 38.5s28.6 8 39.9-1.8l256-224c10-8.8 13.6-22.9 8.9-35.3s-16.6-20.7-30-20.7H272.5L349.4 44.6z"/></svg>',
        warning: '<svg width="18" height="18" viewBox="0 0 448 512" fill="currentColor"><path d="M349.4 44.6c5.9-13.7 1.5-29.7-10.6-38.5s-28.6-8-39.9 1.8l-256 224c-10 8.8-13.6 22.9-8.9 35.3S50.7 288 64 288H175.5L98.6 467.4c-5.9 13.7-1.5 29.7 10.6 38.5s28.6 8 39.9-1.8l256-224c10-8.8 13.6-22.9 8.9-35.3s-16.6-20.7-30-20.7H272.5L349.4 44.6z"/></svg>',
        caution: '<svg width="18" height="18" viewBox="0 0 448 512" fill="currentColor"><path d="M349.4 44.6c5.9-13.7 1.5-29.7-10.6-38.5s-28.6-8-39.9 1.8l-256 224c-10 8.8-13.6 22.9-8.9 35.3S50.7 288 64 288H175.5L98.6 467.4c-5.9 13.7-1.5 29.7 10.6 38.5s28.6 8 39.9-1.8l256-224c10-8.8 13.6-22.9 8.9-35.3s-16.6-20.7-30-20.7H272.5L349.4 44.6z"/></svg>',
        attention: '<svg width="18" height="18" viewBox="0 0 448 512" fill="currentColor"><path d="M349.4 44.6c5.9-13.7 1.5-29.7-10.6-38.5s-28.6-8-39.9 1.8l-256 224c-10 8.8-13.6 22.9-8.9 35.3S50.7 288 64 288H175.5L98.6 467.4c-5.9 13.7-1.5 29.7 10.6 38.5s28.6 8 39.9-1.8l256-224c10-8.8 13.6-22.9 8.9-35.3s-16.6-20.7-30-20.7H272.5L349.4 44.6z"/></svg>',
        // Example - Code brackets  
        example: '<svg width="18" height="18" viewBox="0 0 512 512" fill="currentColor" style="transform: rotate(90deg)"><path d="M260.353,254.878,131.538,33.1a2.208,2.208,0,0,0-3.829.009L.3,254.887A2.234,2.234,0,0,0,.3,257.122L129.116,478.9a2.208,2.208,0,0,0,3.83-.009L260.358,257.113A2.239,2.239,0,0,0,260.353,254.878Zm39.078-25.713a2.19,2.19,0,0,0,1.9,1.111h66.509a2.226,2.226,0,0,0,1.9-3.341L259.115,33.111a2.187,2.187,0,0,0-1.9-1.111H190.707a2.226,2.226,0,0,0-1.9,3.341ZM511.7,254.886,384.9,33.112A2.2,2.2,0,0,0,382.99,32h-66.6a2.226,2.226,0,0,0-1.906,3.34L440.652,256,314.481,476.66a2.226,2.226,0,0,0,1.906,3.34h66.6a2.2,2.2,0,0,0,1.906-1.112L511.7,257.114A2.243,2.243,0,0,0,511.7,254.886ZM366.016,284.917H299.508a2.187,2.187,0,0,0-1.9,1.111l-108.8,190.631a2.226,2.226,0,0,0,1.9,3.341h66.509a2.187,2.187,0,0,0,1.9-1.111l108.8-190.631A2.226,2.226,0,0,0,366.016,284.917Z"/></svg>',
        // Task / Todo - File with code
        task: '<svg width="18" height="18" viewBox="0 0 384 512" fill="currentColor"><path d="M64 464c-8.8 0-16-7.2-16-16V64c0-8.8 7.2-16 16-16H224v80c0 17.7 14.3 32 32 32h80V448c0 8.8-7.2 16-16 16H64zM64 0C28.7 0 0 28.7 0 64V448c0 35.3 28.7 64 64 64H320c35.3 0 64-28.7 64-64V154.5c0-17-6.7-33.3-18.7-45.3L274.7 18.7C262.7 6.7 246.5 0 229.5 0H64zm97 289c9.4-9.4 9.4-24.6 0-33.9s-24.6-9.4-33.9 0L79 303c-9.4 9.4-9.4 24.6 0 33.9l48 48c9.4 9.4 24.6 9.4 33.9 0s9.4-24.6 0-33.9l-31-31 31-31zM257 255c-9.4-9.4-24.6-9.4-33.9 0s-9.4 24.6 0 33.9l31 31-31 31c-9.4 9.4-9.4 24.6 0 33.9s24.6 9.4 33.9 0l48-48c9.4-9.4 9.4-24.6 0-33.9l-48-48z"/></svg>',
        todo: '<svg width="18" height="18" viewBox="0 0 384 512" fill="currentColor"><path d="M64 464c-8.8 0-16-7.2-16-16V64c0-8.8 7.2-16 16-16H224v80c0 17.7 14.3 32 32 32h80V448c0 8.8-7.2 16-16 16H64zM64 0C28.7 0 0 28.7 0 64V448c0 35.3 28.7 64 64 64H320c35.3 0 64-28.7 64-64V154.5c0-17-6.7-33.3-18.7-45.3L274.7 18.7C262.7 6.7 246.5 0 229.5 0H64zm97 289c9.4-9.4 9.4-24.6 0-33.9s-24.6-9.4-33.9 0L79 303c-9.4 9.4-9.4 24.6 0 33.9l48 48c9.4 9.4 24.6 9.4 33.9 0s9.4-24.6 0-33.9l-31-31 31-31zM257 255c-9.4-9.4-24.6-9.4-33.9 0s-9.4 24.6 0 33.9l31 31-31 31c-9.4 9.4-9.4 24.6 0 33.9s24.6 9.4 33.9 0l48-48c9.4-9.4 9.4-24.6 0-33.9l-48-48z"/></svg>',
        // Success / Check - Checkmark
        success: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>',
        check: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>',
        done: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>',
        // Quote / Cite
        quote: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>',
        cite: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>'
    };
    
    // ── Special: Diagram callout — generates HTML with a "Create" button
    if (cleanType.toLowerCase() === 'diagram') {
        // contentBody has blockquote markers stripped. Extract JSON from ```excalidraw block.
        // Normalize: remove any remaining '> ' prefixes
        const normalizedBody = contentBody.replace(/^>\s?/gm, '').trim();
        const excalidrawMatch = normalizedBody.match(/```(?:excalidraw|drawio)\s*([\s\S]*?)\s*```/);
        const savedJson = excalidrawMatch ? excalidrawMatch[1].trim() : null;
        const dimMatch  = normalizedBody.match(/<!--\s*w:(\d+)\s*h:(\d+)\s*-->/);
        const savedW    = dimMatch ? dimMatch[1] : '0';
        const savedH    = dimMatch ? dimMatch[2] : '0';

        const diagramSvgIcon = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>';

        // Check if savedJson is SVG or old JSON
        const isSvg = savedJson && savedJson.startsWith('<svg');
        const renderedContent = isSvg 
            ? savedJson 
            : `<div style="padding:12px;text-align:center;color:var(--text-muted);font-size:13px;">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="display:block;margin:0 auto 8px"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
                Диаграмма сохранена — дважды кликните для редактирования
               </div>`;

        const contentHtml = savedJson
            ? `<div class="diagram-saved-indicator" style="display:flex;justify-content:center;overflow:hidden;border-radius:6px;padding:8px;">
                    ${renderedContent}
               </div>`
            : `<div class="diagram-callout-empty" style="display:flex;flex-direction:column;align-items:center;gap:12px;padding:32px 24px;text-align:center;">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" style="color:#89b4fa;opacity:0.6"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
                    <p style="font-size:13px;color:var(--text-muted);margin:0;">Диаграмма не создана</p>
                    <button class="diagram-create-btn" contenteditable="false" style="display:flex;align-items:center;gap:8px;padding:9px 20px;background:linear-gradient(135deg,#4ade80,#22c55e);color:#052e16;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        Создать диаграмму
                    </button>
               </div>`;

        return `
            <div class="callout callout-diagram" data-diagram="${savedJson ? encodeURIComponent(savedJson) : ''}" data-diagram-width="${savedW}" data-diagram-height="${savedH}">
                <div class="callout-title">
                    <div class="callout-icon">${diagramSvgIcon}</div>
                    <button class="diagram-edit-btn" contenteditable="false" style="${savedJson ? 'display:flex' : 'display:none'};align-items:center;gap:5px;padding:5px 12px;margin-right:8px;background:linear-gradient(135deg,#4ade80,#22c55e);border:none;border-radius:6px;font-size:11px;font-weight:600;color:#052e16;cursor:pointer;">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        Редактировать
                    </button>
                    <div class="callout-title-inner">${title || 'Диаграмма'}</div>
                </div>
                <div class="callout-content">${contentHtml}</div>
            </div>
        `;
    }

    const iconSvg = iconSvgMap[cleanType.toLowerCase()] || iconSvgMap.note;
    
    return `
        <div class="callout callout-${cleanType.toLowerCase()}${isFoldable ? ' is-collapsible' : ''}" data-collapsible="${isFoldable}">
            <div class="callout-title">
                <div class="callout-icon">${iconSvg}</div>
                <div class="callout-title-inner">${title}</div>
                ${isFoldable ? '<div class="callout-fold"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg></div>' : ''}
            </div>
            <div class="callout-content"><p>${contentBody}</p></div>
        </div>
    `;
    }

    
    // Strip blockquote markers
    let processed = md.replace(/^>\s?/gm, '');
    
    // Basic Headers
    processed = processed.replace(/^### (.*$)/gm, '<h3>$1</h3>');
    processed = processed.replace(/^## (.*$)/gm, '<h2>$1</h2>');
    processed = processed.replace(/^# (.*$)/gm, '<h1>$1</h1>');

    // Simple line breaks for non-headers
    processed = processed.replace(/\n/g, '<br>');
    
    return processed;
};
