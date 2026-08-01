export const setupInteractions = (container: HTMLElement) => {
    const onClick = async (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        const btn = target.closest('.copy-code-btn');
        
        if (btn) {
            e.preventDefault();
            e.stopPropagation();
            
            const wrapper = btn.closest('.code-block-wrapper');
            if (wrapper) {
                const contentDiv = wrapper.querySelector('.code-block-content');
                if (contentDiv) {
                    const text = contentDiv.textContent || '';
                    try {
                        await navigator.clipboard.writeText(text);
                        const originalHtml = btn.innerHTML;
                        const checkIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-check"><path d="M20 6 9 17l-5-5"/></svg>';
                        btn.innerHTML = checkIcon;
                        (btn as HTMLElement).style.color = '#4ade80';
                        setTimeout(() => {
                            btn.innerHTML = originalHtml;
                            (btn as HTMLElement).style.color = '#b0b0b0';
                        }, 2000);
                    } catch (err) {
                        console.error('Copy failed:', err);
                    }
                }
            }
        }

        // Handle collapsible callout toggle
        const calloutTitle = target.closest('.callout-title');
        if (calloutTitle) {
            const callout = calloutTitle.closest('.callout[data-collapsible="true"]');
            if (callout) {
                e.stopPropagation();
                callout.classList.toggle('is-collapsed');
            }
        }
    };

    const onInput = (e: Event) => {
        const target = e.target as HTMLElement;
        // Only process if we're typing in a text node or paragraph
        if (!target.closest('.code-block-wrapper')) {
            const selection = window.getSelection();
            if (!selection || selection.rangeCount === 0) return;
            
            const range = selection.getRangeAt(0);
            const textNode = range.startContainer;
            if (textNode.nodeType !== Node.TEXT_NODE) return;
            
            const text = textNode.textContent || '';
            // Match opening ``` with optional language, content, and closing ```
            const codeFenceRegex = /```(\w*)\n([\s\S]*?)```/;
            const match = text.match(codeFenceRegex);
            
            if (match) {
                const language = match[1] || 'plaintext';
                const codeContent = match[2].trim();
                const fullMatch = match[0];
                
                // Create code block HTML
                const codeBlockHtml = `<pre><div class="code-block-wrapper" data-language="${language}" style="position: relative;"><div class="code-block-content">${codeContent.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div></div></pre>`;
                
                // Find the parent element to replace content in
                const parentEl = textNode.parentElement;
                if (parentEl) {
                    const beforeText = text.substring(0, text.indexOf(fullMatch));
                    const afterText = text.substring(text.indexOf(fullMatch) + fullMatch.length);
                    
                    // Create a temporary container for the new content
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = beforeText + codeBlockHtml + afterText;
                    
                    // Replace textNode content with the HTML
                    const fragment = document.createDocumentFragment();
                    while (tempDiv.firstChild) {
                        fragment.appendChild(tempDiv.firstChild);
                    }
                    
                    // Replace the text node with our new content
                    const parentOfText = textNode.parentNode;
                    if (parentOfText) {
                        parentOfText.replaceChild(fragment, textNode);
                    }
                }
            }
        }
    };

    container.addEventListener('click', onClick);
    container.addEventListener('input', onInput);

    return () => {
        container.removeEventListener('click', onClick);
        container.removeEventListener('input', onInput);
    };
};
