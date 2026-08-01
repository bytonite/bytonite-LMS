export const setupResize = (container: HTMLElement) => {
    // Make resizable elements
    const makeResizable = (element: HTMLElement) => {
        // Skip if already has resize handles or is inside code block content
        if (element.querySelector('.resize-handle')) return;
        if (element.closest('.code-block-content')) return;
        if (element.classList.contains('resize-handle')) return;
        
        // Create resize handles - all corners and edges
        const handles = ['nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w'];
        handles.forEach(pos => {
            const handle = document.createElement('div');
            handle.className = `resize-handle handle-${pos}`;
            handle.dataset.handle = pos;
            handle.contentEditable = 'false';
            element.appendChild(handle);
        });
        
        element.style.position = 'relative';
        element.classList.add('resizable');
    };
    
    // Apply resize to ALL block elements that could be resized
    const applyResizeToElements = () => {
        // Comprehensive selector for all resizable elements
        const resizableSelector = [
            '.media-wrapper',
            '.callout',
            '.code-block-wrapper',
            'table',
            'blockquote:not(.callout)',
            'button',
            '.flex-row',
            '.flex-col',
            '.grid-cell',
            'div[style*="background"]',
            'div[style*="border"]',
            'div[style*="padding"]'
        ].join(', ');
        
        container.querySelectorAll(resizableSelector).forEach(el => {
            const htmlEl = el as HTMLElement;
            // Don't add handles to elements inside other resizable elements
            if (!htmlEl.closest('.resizable') || htmlEl.classList.contains('callout') || htmlEl.classList.contains('code-block-wrapper') || htmlEl.classList.contains('grid-cell')) {
                makeResizable(htmlEl);
            }
        });
    };
    
    // Initial setup
    applyResizeToElements();
    
    // Resize state
    let isResizing = false;
    let currentElement: HTMLElement | null = null;
    let currentHandle = '';
    let startX = 0;
    let startY = 0;
    let startWidth = 0;
    let startHeight = 0;
    
    // Mouse down on handle
    container.addEventListener('mousedown', (e) => {
        const target = e.target as HTMLElement;
        if (target.classList.contains('resize-handle')) {
            e.preventDefault();
            e.stopPropagation();
            
            currentHandle = target.dataset.handle || 'se';
            currentElement = target.parentElement as HTMLElement;
            
            if (!currentElement) return;
            
            isResizing = true;
            startX = e.clientX;
            startY = e.clientY;
            startWidth = currentElement.offsetWidth;
            startHeight = currentElement.offsetHeight;
            
            // Freeze siblings in flex row so they don't deform
            const parent = currentElement.parentElement;
            if (parent && parent.classList.contains('flex-row')) {
                Array.from(parent.children).forEach(child => {
                    const el = child as HTMLElement;
                    if (el !== currentElement && (el.classList.contains('resizable') || el.classList.contains('callout') || el.classList.contains('media-wrapper'))) {
                        if (el.style.flex !== 'none') {
                            // Freeze their current computed width
                            el.style.width = `${el.offsetWidth}px`;
                            el.style.flex = 'none';
                        }
                    }
                });
            }
            
            currentElement.classList.add('resizing');
            document.body.style.cursor = getComputedStyle(target).cursor;
            document.body.style.userSelect = 'none';
        }
    });
    
    // Mouse move for resize
    const handleMouseMove = (e: MouseEvent) => {
        if (!isResizing || !currentElement) return;
        
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        
        let newWidth = startWidth;
        let newHeight = startHeight;
        
        const minSize = 30;
        
        // Handle all resize directions
        switch(currentHandle) {
            case 'e':
                 newWidth = Math.max(minSize, startWidth + dx);
                 break;
            case 'w':
                 newWidth = Math.max(minSize, startWidth - dx);
                 break;
            case 's':
                 newHeight = Math.max(minSize, startHeight + dy);
                 break;
            case 'n':
                 newHeight = Math.max(minSize, startHeight - dy);
                 break;
            case 'se':
                 newWidth = Math.max(minSize, startWidth + dx);
                 newHeight = Math.max(minSize, startHeight + dy);
                 break;
            case 'sw':
                 newWidth = Math.max(minSize, startWidth - dx);
                 newHeight = Math.max(minSize, startHeight + dy);
                 break;
            case 'ne':
                 newWidth = Math.max(minSize, startWidth + dx);
                 newHeight = Math.max(minSize, startHeight - dy);
                 break;
            case 'nw':
                 newWidth = Math.max(minSize, startWidth - dx);
                 newHeight = Math.max(minSize, startHeight - dy);
                 break;
        }
        
        // For images and videos, maintain aspect ratio when using corner handles
        if ((currentElement.tagName === 'IMG' || currentElement.tagName === 'VIDEO' || currentElement.classList.contains('media-wrapper')) && 
            ['se', 'sw', 'ne', 'nw'].includes(currentHandle)) {
            const aspectRatio = startWidth / startHeight;
            // Use the larger delta to determine size
            if (Math.abs(dx) > Math.abs(dy)) {
                newHeight = newWidth / aspectRatio;
            } else {
                newWidth = newHeight * aspectRatio;
            }
        }
        
        // Apply dimensions
        if (['e', 'w', 'se', 'sw', 'ne', 'nw'].includes(currentHandle)) {
            if (currentElement.classList.contains('grid-cell')) {
                const parent = currentElement.parentElement;
                if (parent && parent.classList.contains('dashboard-grid')) {
                    const colWidth = parent.offsetWidth / 12;
                    const span = Math.max(1, Math.min(12, Math.round(newWidth / colWidth)));
                    currentElement.style.gridColumn = `span ${span}`;
                    currentElement.style.width = ''; // remove absolute width
                } else {
                    currentElement.style.width = `${newWidth}px`;
                }
            } else {
                currentElement.style.width = `${newWidth}px`;
            }
        }
        
        // Only apply height for elements that need it
        if (['s', 'n', 'se', 'sw', 'ne', 'nw'].includes(currentHandle)) {
            currentElement.style.height = `${newHeight}px`;
        }
        
        // For images - ensure they don't use max-width 100%
        if (currentElement.tagName === 'IMG' || currentElement.tagName === 'VIDEO' || currentElement.classList.contains('media-wrapper')) {
            currentElement.style.maxWidth = 'none';
        }
        
        // Override flex properties if inside a flex container to allow manual sizing
        currentElement.style.flex = 'none';
        
        // Keep element in document flow (don't use position:absolute)
        currentElement.style.boxSizing = 'border-box';
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    
    // Mouse up - finish resize
    const handleMouseUp = () => {
        if (isResizing && currentElement) {
            currentElement.classList.remove('resizing');
            isResizing = false;
            currentElement = null;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        }
    };
    
    document.addEventListener('mouseup', handleMouseUp);
    
    // Re-apply resize handles when content changes (MutationObserver)
    const observer = new MutationObserver(() => {
        applyResizeToElements();
    });
    
    observer.observe(container, { childList: true, subtree: true });
    
    // Return cleanup function
    return () => {
        observer.disconnect();
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
    };
};
