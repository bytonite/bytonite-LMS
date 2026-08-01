export interface SetupDragAndDropOptions {
    container: HTMLElement;
    markdownToHtmlHelper: (md: string) => string;
}

export const setupDragAndDrop = ({ container, markdownToHtmlHelper }: SetupDragAndDropOptions) => {
    let draggedItem: HTMLElement | null = null;
    let indicator: HTMLElement | null = null;
    
    // Get filePath from window (set by Preview component)
    const getCurrentFilePath = () => (window as any).__currentFilePath || '';
    
    // Interaction State
    let targetElement: HTMLElement | null = null;
    let insertionType: 'before' | 'after' | 'left' | 'right' | 'inside' | null = null;

    // Visual Indicator
    const createIndicator = () => {
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.className = 'drop-indicator';
            document.body.appendChild(indicator);
        }
    };

    const updateIndicator = (rect: DOMRect, type: 'before' | 'after' | 'left' | 'right') => {
        if (!indicator) createIndicator();
        if (!indicator) return;

        indicator.style.display = 'block';
        
        // Reset dimensions and background
        indicator.style.width = '';
        indicator.style.height = '';
        indicator.style.backgroundColor = '';
        
        if (type === 'before') { // Top
            indicator.style.top = `${rect.top - 2}px`;
            indicator.style.left = `${rect.left}px`;
            indicator.style.width = `${rect.width}px`;
            indicator.style.height = '4px';
        } else if (type === 'after') { // Bottom
            indicator.style.top = `${rect.bottom - 2}px`;
            indicator.style.left = `${rect.left}px`;
            indicator.style.width = `${rect.width}px`;
            indicator.style.height = '4px';
        } else if (type === 'left') {
            indicator.style.top = `${rect.top}px`;
            indicator.style.left = `${rect.left - 2}px`;
            indicator.style.height = `${rect.height}px`;
            indicator.style.width = '4px';
        } else if (type === 'right') {
            indicator.style.top = `${rect.top}px`;
            indicator.style.left = `${rect.right - 2}px`;
            indicator.style.height = `${rect.height}px`;
            indicator.style.width = '4px';
        }
    };

    const clearVisuals = () => {
       if (indicator) indicator.style.display = 'none';
       targetElement = null;
       insertionType = null;
    };

    // Recursively make elements draggable
    const makeDraggable = (root: HTMLElement) => {
        const significantSelector = 'p, h1, h2, h3, h4, h5, h6, ul, ol, li, img, button, table, blockquote, .callout, pre, .code-block-wrapper, .flex-row, .flex-col, .dashboard-grid, .grid-cell';
        
        const processNode = (child: any) => {
            if (!child || !child.tagName) return;
            if (child.tagName === 'SCRIPT' || child.tagName === 'STYLE') return;
            if (child.closest && child.closest('.code-block-content')) return; 
            if (child.parentElement && child.parentElement.closest('.callout') && !child.classList.contains('callout')) return; 

            if (!child.classList.contains('draggable-block')) {
                child.classList.add('draggable-block');
                
                child.addEventListener('mouseenter', (e: MouseEvent) => {
                    if (container.contentEditable === 'true' && !draggedItem) {
                        e.stopPropagation();
                        
                        // Remove old hover handle if exists
                        const oldHandle = container.querySelector('.hover-drag-handle');
                        if (oldHandle) oldHandle.remove();

                        // Add new handle
                        const handle = document.createElement('div');
                        handle.className = 'custom-drag-handle hover-drag-handle';
                        handle.contentEditable = 'false';
                        handle.draggable = true;
                        Object.assign(handle.style, {
                            position: 'absolute',
                            right: '8px',
                            top: '8px',
                            width: '32px',
                            height: '32px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'grab',
                            color: '#ffffff',
                            borderRadius: '6px',
                            userSelect: 'none',
                            zIndex: '10',
                            backgroundColor: 'var(--interactive-accent)',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                            opacity: '1',
                            transition: 'all 0.2s ease'
                        });
                        handle.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 5h.01M9 12h.01M9 19h.01M15 5h.01M15 12h.01M15 19h.01"/></svg>';
                        handle.addEventListener('mouseenter', () => {
                            handle.style.transform = 'scale(1.1)';
                            handle.style.backgroundColor = '#2ecc71';
                            handle.style.boxShadow = '0 0 15px rgba(46, 204, 113, 0.8)';
                        });
                        handle.addEventListener('mouseleave', () => {
                            handle.style.transform = 'scale(1)';
                            handle.style.backgroundColor = 'var(--interactive-accent)';
                            handle.style.boxShadow = '0 4px 12px rgba(0,0,0,0.4)';
                        });
                        
                        if (window.getComputedStyle(child).position === 'static') {
                            child.style.position = 'relative';
                        }
                        child.appendChild(handle);
                    }
                });
                child.addEventListener('mouseleave', (e: MouseEvent) => {
                    const handle = child.querySelector('.hover-drag-handle');
                    if (handle && (!e.relatedTarget || !child.contains(e.relatedTarget as Node))) {
                        handle.remove();
                    }
                });
            }
        };

        const elements = root.querySelectorAll(significantSelector);
        Array.from(elements).forEach(processNode);

        const dragObserver = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach((node: any) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        if (node.matches && node.matches(significantSelector)) {
                            processNode(node);
                        }
                        if (node.querySelectorAll) {
                            const nested = node.querySelectorAll(significantSelector);
                            if (nested.length > 0) {
                                Array.from(nested).forEach(processNode);
                            }
                        }
                    }
                });
            });
        });
        
        dragObserver.observe(root, { childList: true, subtree: true });
        return dragObserver;
    };

    // Initial setup and observer
    const dragObserver = makeDraggable(container);

    const onDragStart = (e: any) => {
        if (container.contentEditable !== 'true') return;
        let target = e.target as HTMLElement;
        if (target.classList.contains('custom-drag-handle')) {
            draggedItem = target.parentElement as HTMLElement;
        } else {
            draggedItem = target.closest('.draggable-block') as HTMLElement || target;
        }
        
        if (!draggedItem) return;
        
        // Smart Selection
        const wrapper = draggedItem.closest('.callout, .code-block-wrapper, .flex-row');
        if (wrapper && container.contains(wrapper) && wrapper !== container) {
             draggedItem = wrapper as HTMLElement;
        }

        draggedItem.classList.add('sortable-dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', '');
        e.stopPropagation();
    };

    const onDragEnd = () => {
         if (draggedItem) draggedItem.classList.remove('sortable-dragging');
         clearVisuals();
         draggedItem = null;
         makeDraggable(container);
    };

    const onDragOver = (e: any) => {
        e.preventDefault();
        e.stopPropagation();

        const target = e.target as HTMLElement;
        
        // Find best target block
        let block = target.closest('.draggable-block') as HTMLElement;
        const dropContainer = target.closest('.grid-cell, .callout, blockquote, td, th') as HTMLElement;

        let min = 0, distTop = 0, distBottom = 0, distLeft = 0, distRight = 0;
        let rect: DOMRect | null = null;
        if (block) {
            rect = block.getBoundingClientRect();
            const x = e.clientX;
            const y = e.clientY;
            distTop = Math.abs(y - rect.top);
            distBottom = Math.abs(y - rect.bottom);
            distLeft = Math.abs(x - rect.left);
            distRight = Math.abs(x - rect.right);
            min = Math.min(distTop, distBottom, distLeft, distRight);
        }

        if (dropContainer) {
            const isBlockOutsideContainer = block && !dropContainer.contains(block);
            if (!block || isBlockOutsideContainer || (dropContainer === block && min > 15)) {
                // Drop inside the container
                targetElement = dropContainer;
                insertionType = 'inside';
                
                if (!indicator) createIndicator();
                if (indicator) {
                     indicator.style.display = 'block';
                     indicator.style.top = `${dropContainer.getBoundingClientRect().top}px`;
                     indicator.style.left = `${dropContainer.getBoundingClientRect().left}px`;
                     indicator.style.width = `${dropContainer.offsetWidth}px`;
                     indicator.style.height = `${dropContainer.offsetHeight}px`;
                     indicator.style.backgroundColor = 'rgba(68, 138, 255, 0.2)'; // Highlight color
                }
                return;
            }
        }
        
        if (block && (!draggedItem || !block.contains(draggedItem)) && block !== draggedItem) {
            targetElement = block;
            
            if (min === distTop) insertionType = 'before';
            else if (min === distBottom) insertionType = 'after';
            else if (min === distLeft) insertionType = 'left';
            else insertionType = 'right';

            updateIndicator(rect as DOMRect, insertionType);
        } else if (!block && target.closest('.design-mode-container')) {
            // Only look at top-level blocks to avoid selecting inner cells
            const topLevelBlocks = Array.from(container.children).filter(child => child.classList.contains('draggable-block'));
            if (topLevelBlocks.length > 0) {
                let closestBlock: HTMLElement | null = null;
                let closestDist = Infinity;
                let bestType: 'before' | 'after' = 'after';

                topLevelBlocks.forEach(child => {
                     const childRect = (child as HTMLElement).getBoundingClientRect();
                     const dTop = Math.abs(e.clientY - childRect.top);
                     const dBottom = Math.abs(e.clientY - childRect.bottom);
                     
                     if (dTop < closestDist) {
                         closestDist = dTop;
                         closestBlock = child as HTMLElement;
                         bestType = 'before';
                     }
                     if (dBottom < closestDist) {
                         closestDist = dBottom;
                         closestBlock = child as HTMLElement;
                         bestType = 'after';
                     }
                });

                if (closestBlock) {
                    targetElement = closestBlock;
                    insertionType = bestType;
                    updateIndicator((closestBlock as HTMLElement).getBoundingClientRect(), bestType);
                }
            } else {
                targetElement = container;
                insertionType = 'inside';
                if (!indicator) createIndicator();
                if (indicator) {
                     indicator.style.display = 'block';
                     const containerRect = container.getBoundingClientRect();
                     indicator.style.top = `${containerRect.top + 10}px`;
                     indicator.style.left = `${containerRect.left + 10}px`;
                     indicator.style.width = `${containerRect.width - 20}px`;
                     indicator.style.height = '4px';
                     indicator.style.backgroundColor = 'var(--interactive-accent)';
                }
            }
        } else {
            clearVisuals();
        }
    };

    const onDragLeave = () => {
         // only clear if leaving window or container really far?
         // relying on dragover to clear works better usually
    };

    const onDrop = async (e: any) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (indicator) indicator.style.display = 'none';

        let itemToDrop = draggedItem;

        // Handle files dropped from OS (images/videos)
        const files = e.dataTransfer?.files as FileList;
        if (files && files.length > 0 && !draggedItem) {
            for (const file of Array.from(files)) {
                const isImage = file.type.startsWith('image/');
                const isVideo = file.type.startsWith('video/');
                
                if ((isImage || isVideo) && (file as any).path) {
                    try {
                        // Get base directory from filePath
                        const currentFilePath = getCurrentFilePath();
                        // Normalize path separators
                        const normalizedPath = currentFilePath.replace(/\\/g, '/');
                        const baseDir = normalizedPath.substring(0, normalizedPath.lastIndexOf('/'));
                        const assetsDir = `${baseDir}/assets`;
                        const newName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
                        const destPath = `${assetsDir}/${newName}`;
                        
                        // Copy file to assets folder
                        await window.electronAPI.copyFile((file as any).path, destPath);

                        // Create media element with proper file:// URL
                        const fileUrl = `file:///${destPath.replace(/\\/g, '/')}`;
                        
                        if (isVideo) {
                             const wrapper = document.createElement('div');
                             wrapper.className = 'media-wrapper resizable';
                             wrapper.style.display = 'inline-block';
                             wrapper.style.maxWidth = '100%';
                             
                             const videoEl = document.createElement('video');
                             videoEl.src = fileUrl;
                             videoEl.setAttribute('controls', 'true');
                             videoEl.style.width = '100%';
                             videoEl.style.height = '100%';
                             videoEl.style.display = 'block';
                             videoEl.style.borderRadius = '4px';
                             
                             wrapper.appendChild(videoEl);
                             itemToDrop = wrapper;
                         } else {
                             const wrapper = document.createElement('div');
                             wrapper.className = 'media-wrapper resizable';
                             wrapper.style.display = 'inline-block';
                             wrapper.style.maxWidth = '100%';
                             
                             const imgEl = document.createElement('img');
                             imgEl.src = fileUrl;
                             imgEl.style.width = '100%';
                             imgEl.style.height = '100%';
                             imgEl.style.display = 'block';
                             
                             wrapper.appendChild(imgEl);
                             itemToDrop = wrapper;
                         }
                        
                        // Trigger file explorer refresh
                        if ((window as any).__previewOnRefresh) {
                            (window as any).__previewOnRefresh();
                        }
                    } catch (err) {
                        console.error('Failed to copy media file:', err);
                    }
                }
            }
        }

        // Handle files dragged from internal file explorer
        if (!itemToDrop) {
            const internalMediaPath = e.dataTransfer?.getData('application/x-media-path');
            if (internalMediaPath) {
                // Normalize path and create file URL
                const normalizedPath = internalMediaPath.replace(/\\/g, '/');
                const fileUrl = `file:///${normalizedPath}`;
                
                // Check if it's a video or image
                const isVideo = /\.(mp4|webm|ogv|mkv|mov|avi)$/i.test(internalMediaPath);
                
                if (isVideo) {
                    const videoEl = document.createElement('video');
                    videoEl.src = fileUrl;
                    videoEl.setAttribute('controls', 'true');
                    videoEl.style.maxWidth = '100%';
                    itemToDrop = videoEl;
                } else {
                    const imgEl = document.createElement('img');
                    imgEl.src = fileUrl;
                    imgEl.style.maxWidth = '100%';
                    imgEl.alt = '';
                    itemToDrop = imgEl;
                }
            }
        }

        // Handle External Drop (templates or text)
        if (!itemToDrop) {
            const content = (window as any).__draggingTemplateContent || e.dataTransfer.getData('text/plain');
            if (content) {
                 const newHtml = markdownToHtmlHelper(content);
                 const tempDiv = document.createElement('div');
                 tempDiv.innerHTML = newHtml;

                 const nodes = Array.from(tempDiv.children) as HTMLElement[];
                 if (nodes.length === 1) itemToDrop = nodes[0];
                 else {
                     // Wrap multiple items if needed, or just append first?
                     // For simplicity, let's wrap in a div if multiple
                     const wrapper = document.createElement('div');
                     nodes.forEach(n => wrapper.appendChild(n));
                     itemToDrop = wrapper;
                 }
                 (window as any).__draggingTemplateContent = null;
            }
        }

        if (itemToDrop && targetElement && insertionType) {
            // Prevent circular DOM manipulation - can't drop parent on child
            if (itemToDrop.contains(targetElement)) {
                // Invalid drop - the item we're dropping contains the target
                clearVisuals();
                if (draggedItem) {
                    draggedItem.classList.remove('sortable-dragging');
                    draggedItem.style.opacity = '';
                }
                draggedItem = null;
                return;
            }
            
            if (insertionType === 'inside') {
                // Clear the cell if it only contains the placeholder text or is empty
                let containerToAppend = targetElement;
                if (targetElement.classList.contains('callout')) {
                    const content = targetElement.querySelector('.callout-content');
                    if (content) containerToAppend = content as HTMLElement;
                }
                containerToAppend.appendChild(itemToDrop);
            }
            else if (insertionType === 'before') {
                targetElement.before(itemToDrop);
            } 
            else if (insertionType === 'after') {
                targetElement.after(itemToDrop);
            }
            else if (insertionType === 'left' || insertionType === 'right') {
                // Auto-Column Creation
                const parent = targetElement.parentElement;
                
                // Check if already in a flex row
                if (parent && parent.classList.contains('flex-row')) {
                    if (itemToDrop instanceof HTMLElement) {
                        // If item doesn't have an explicit flex or width set, give it flex-1
                        if (!itemToDrop.style.flex && !itemToDrop.style.width) {
                            itemToDrop.style.flex = '1 1 0%';
                            itemToDrop.style.minWidth = '0px';
                        }
                    }
                    if (insertionType === 'left') targetElement.before(itemToDrop);
                    else targetElement.after(itemToDrop);
                } else {
                    // Create new Flex Row wrapper
                    const row = document.createElement('div');
                    row.className = 'flex-row';
                    row.style.display = 'flex';
                    row.style.gap = '16px';
                    row.style.width = '100%';
                    row.style.alignItems = 'flex-start'; // Top align usually best

                    targetElement.replaceWith(row);
                    
                    // Ensure items have flex-1
                    targetElement.style.flex = '1 1 0%';
                    targetElement.style.minWidth = '0px';
                    
                    if (itemToDrop instanceof HTMLElement) {
                        itemToDrop.style.flex = '1 1 0%';
                        itemToDrop.style.minWidth = '0px';
                    }

                    if (insertionType === 'left') {
                        row.appendChild(itemToDrop);
                        row.appendChild(targetElement);
                    } else {
                        row.appendChild(targetElement);
                        row.appendChild(itemToDrop);
                    }
                }
            }
        } else if (itemToDrop && !targetElement && itemToDrop !== draggedItem) {
            // Only append to end if it's a NEW external item (template/file), 
            // NOT an existing element being re-dragged
            container.appendChild(itemToDrop);
        }
        // If draggedItem was dropped without a valid target, it stays in place (no action needed)
        
        
        if (draggedItem) {
            draggedItem.classList.remove('sortable-dragging');
            draggedItem.style.opacity = '';
        }
        makeDraggable(container);
        draggedItem = null;
        clearVisuals();
    };

    container.addEventListener('dragstart', onDragStart);
    container.addEventListener('dragend', onDragEnd);
    container.addEventListener('dragover', onDragOver);
    container.addEventListener('dragenter', (e) => e.preventDefault());
    container.addEventListener('dragleave', onDragLeave);
    container.addEventListener('drop', onDrop);

    return () => {
         container.removeEventListener('dragstart', onDragStart);
         container.removeEventListener('dragend', onDragEnd);
         container.removeEventListener('dragover', onDragOver);
         container.removeEventListener('dragleave', onDragLeave);
         container.removeEventListener('drop', onDrop);
         if (indicator) indicator.remove();
         if (dragObserver) dragObserver.disconnect();
    };
};
