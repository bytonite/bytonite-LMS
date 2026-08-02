export const setupResize = (container: HTMLElement) => {
    // Make resizable elements
    const makeResizable = (element: HTMLElement) => {
        // Skip if already has resize handles or is inside code block content
        if (element.querySelector('.resize-handle')) return;
        if (element.closest('.code-block-content')) return;
        if (element.classList.contains('resize-handle')) return;
        
        const isGridCell = element.classList.contains('grid-cell');
        
        // Create resize handles 
        // Grid cells only get right/bottom/bottom-right to prevent margin-left collapse
        const handles = isGridCell ? ['e', 's', 'se'] : ['nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w'];
        
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
            const isGridCell = htmlEl.classList.contains('grid-cell');
            const parentCell = htmlEl.closest('.grid-cell');
            
            // Elements inside a grid cell should not be individually resizable; they adapt to the cell size
            if (parentCell && !isGridCell) return;

            // Don't add handles to elements inside other resizable elements
            if (!htmlEl.closest('.resizable') || htmlEl.classList.contains('callout') || htmlEl.classList.contains('code-block-wrapper') || isGridCell) {
                makeResizable(htmlEl);
            }
        });
    };
    
    // Initial setup
    applyResizeToElements();
    
    // Smart guides state
    let horizontalGuide: HTMLElement | null = null;
    let verticalGuide: HTMLElement | null = null;
    let snapTargets: { el: HTMLElement, rect: DOMRect }[] = [];
    const SNAP_THRESHOLD = 8;
    
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
            
            // Populate snap targets
            snapTargets = [];
            container.querySelectorAll('.resizable').forEach(el => {
                if (el !== currentElement) {
                    snapTargets.push({ el: el as HTMLElement, rect: el.getBoundingClientRect() });
                }
            });
            
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
        
        // Smart Snapping Logic
        let snappedHeight = false;
        let snappedWidth = false;
        let guideY = 0;
        let guideX = 0;
        
        const currentRect = currentElement.getBoundingClientRect();
        
        // Height Snapping (bottom edge)
        if (['s', 'se', 'sw'].includes(currentHandle)) {
            const proposedBottom = currentRect.top + newHeight;
            for (const target of snapTargets) {
                if (Math.abs(proposedBottom - target.rect.bottom) < SNAP_THRESHOLD) {
                    newHeight = target.rect.bottom - currentRect.top;
                    snappedHeight = true;
                    guideY = target.rect.bottom;
                    break;
                }
                if (Math.abs(proposedBottom - target.rect.top) < SNAP_THRESHOLD) {
                    newHeight = target.rect.top - currentRect.top;
                    snappedHeight = true;
                    guideY = target.rect.top;
                    break;
                }
            }
        }
        
        // Width Snapping (right edge)
        if (['e', 'se', 'ne'].includes(currentHandle) && !currentElement.classList.contains('grid-cell')) {
            const proposedRight = currentRect.left + newWidth;
            for (const target of snapTargets) {
                if (Math.abs(proposedRight - target.rect.right) < SNAP_THRESHOLD) {
                    newWidth = target.rect.right - currentRect.left;
                    snappedWidth = true;
                    guideX = target.rect.right;
                    break;
                }
                if (Math.abs(proposedRight - target.rect.left) < SNAP_THRESHOLD) {
                    newWidth = target.rect.left - currentRect.left;
                    snappedWidth = true;
                    guideX = target.rect.left;
                    break;
                }
            }
        }
        
        // Render guides
        if (snappedHeight) {
            if (!horizontalGuide) {
                horizontalGuide = document.createElement('div');
                horizontalGuide.className = 'smart-guide horizontal';
                document.body.appendChild(horizontalGuide);
            }
            horizontalGuide.style.top = `${guideY + window.scrollY}px`;
        } else if (horizontalGuide) {
            horizontalGuide.remove();
            horizontalGuide = null;
        }
        
        if (snappedWidth) {
            if (!verticalGuide) {
                verticalGuide = document.createElement('div');
                verticalGuide.className = 'smart-guide vertical';
                document.body.appendChild(verticalGuide);
            }
            verticalGuide.style.left = `${guideX + window.scrollX}px`;
        } else if (verticalGuide) {
            verticalGuide.remove();
            verticalGuide = null;
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
                    // We purposefully do NOT set absolute width on grid cells to keep layout fluid
                    currentElement.style.width = ''; 
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
            
            // Clean up guides
            if (horizontalGuide) {
                horizontalGuide.remove();
                horizontalGuide = null;
            }
            if (verticalGuide) {
                verticalGuide.remove();
                verticalGuide = null;
            }
            snapTargets = [];
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
