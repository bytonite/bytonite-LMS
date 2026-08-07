import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { createPortal } from 'react-dom';
import './Preview.css';
import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { setupResize } from '../hooks/useResize';
import { setupDragAndDrop } from '../hooks/useDragAndDrop';
import { setupInteractions } from '../hooks/useInteractions';
import { useMermaidRender, applyResponsiveTransform } from '../hooks/useMermaidRender';
import { useAutoSave } from '../hooks/useAutoSave';
import { DiagramEditor } from './DiagramCallout/DiagramEditor';
import type { DiagramData } from './DiagramCallout/DiagramEditor';

import { getMarkdownComponents } from './markdown/MarkdownComponents';
import TextToolbar from './TextToolbar';
import { htmlToMarkdown, markdownToHtmlHelper, cleanHTML } from '../utils/htmlToMarkdown';
import { rehypeSourceLine, fixPaths } from '../utils/markdownUtils';
import { transformImageUri } from '../utils/uriTransform';
import { DesignModeContext } from '../contexts/DesignModeContext';

interface PreviewProps {
    content: string;
    filePath: string;
    allFiles: string[];
    onFileSelect: (file: string) => void;
    onNavigateLink?: (linkText: string) => void;
    onTagClick?: (tag: string) => void;
    designMode?: boolean;
    onRegisterSave?: (saveFn: () => string) => void;
    onAutoSave?: (content: string) => void;
    selectedBlocks?: HTMLElement[];
    onSelectBlocks?: (blocks: HTMLElement[]) => void;
    rootPath?: string;
    onRefresh?: () => void;
    activeSourcePos?: string | null;
    onSelectSourcePos?: (pos: string | null) => void;
    /** true — split screen with editor; false/undefined — reading mode */
    hasEditor?: boolean;
    /** Called with the open-diagram callback so parent (App) can trigger it from PropertiesPanel */
    onRegisterOpenDiagram?: (openFn: (block: HTMLElement) => void) => void;
}

export default function Preview({ content, filePath, allFiles, onFileSelect, designMode = false, onRegisterSave, onAutoSave, selectedBlocks, onSelectBlocks, rootPath: _rootPath, onRefresh, activeSourcePos: _activeSourcePos, onSelectSourcePos, hasEditor = false, onRegisterOpenDiagram }: PreviewProps) {

    const editableRef = useRef<HTMLDivElement>(null);
    const previewRef = useRef<HTMLDivElement>(null);
    const dndCleanupRef = useRef<(() => void) | null>(null);
    const resizeCleanupRef = useRef<(() => void) | null>(null);
    const interactionsCleanupRef = useRef<(() => void) | null>(null);

    // ── Diagram Editor (Design Mode event delegation) ─────────────────────────
    const [diagramEditorOpen, setDiagramEditorOpen] = useState(false);
    const diagramTargetEl = useRef<HTMLElement | null>(null);
    const diagramInitialData = useRef<DiagramData | null>(null);

    // ── Mermaid zoom toolbar (Design Mode only) ───────────────────────────────
    interface MermaidZoomState {
        wrapper: HTMLElement;
        rect: DOMRect;
        scale: number;
        x: number;
        y: number;
    }
    const [mermaidZoom, setMermaidZoom] = useState<MermaidZoomState | null>(null);
    const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const applyMermaidZoom = useCallback((wrapper: HTMLElement, scale: number, x: number, y: number) => {
        // Save the user-relative zoom (scale=1 means "fit to container")
        wrapper.setAttribute('data-mermaid-zoom', JSON.stringify({ scale, x, y }));
        // Recompute the responsive (fit * userScale) transform
        applyResponsiveTransform(wrapper);
        // Add a smooth transition on the container
        const container = wrapper.querySelector('.mermaid-svg-container') as HTMLElement | null;
        if (container) container.style.transition = 'transform 0.12s ease-out';
    }, []);

    // ── Design Mode: Event delegation for diagram Create/Edit buttons ──────────
    useEffect(() => {
        if (!designMode) return;
        const container = editableRef.current;
        if (!container) return;

        const onClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            const btn = target.closest('.diagram-create-btn, .diagram-edit-btn');
            if (!btn) return;
            e.preventDefault();
            e.stopPropagation();

            const calloutEl = btn.closest('.callout-diagram') as HTMLElement | null;
            if (!calloutEl) return;

            const encoded = calloutEl.getAttribute('data-diagram') || '';
            let initialData: DiagramData | null = null;
            if (encoded) {
                try {
                    initialData = { svg: decodeURIComponent(encoded), width: 0, height: 0 };
                } catch {
                    initialData = { svg: encoded, width: 0, height: 0 };
                }
            }

            diagramTargetEl.current    = calloutEl;
            diagramInitialData.current = initialData;
            setDiagramEditorOpen(true);
        };

        container.addEventListener('click', onClick);
        return () => container.removeEventListener('click', onClick);
    }, [designMode]);

    // Diagram save: updates DOM and triggers autosave
    const handleDiagramSave = useCallback((data: DiagramData) => {
        const el = diagramTargetEl.current;
        setDiagramEditorOpen(false);
        if (!el) return;

        const svgStr = data.svg;
        el.setAttribute('data-diagram',        encodeURIComponent(svgStr));
        el.setAttribute('data-diagram-width',  String(data.width));
        el.setAttribute('data-diagram-height', String(data.height));

        const content = el.querySelector('.callout-content') as HTMLElement | null;
        if (content) {
            const isSvg = svgStr && svgStr.startsWith('<svg');
            const renderedContent = isSvg 
                ? svgStr 
                : `<div style="padding:12px;text-align:center;color:var(--text-muted);font-size:13px;">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="display:block;margin:0 auto 8px"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
                    Диаграмма сохранена &mdash; дважды кликните для редактирования
                   </div>`;

            content.innerHTML = `<div class="diagram-saved-indicator" style="display:flex;justify-content:center;overflow:hidden;border-radius:6px;padding:8px;">
                ${renderedContent}
            </div>`;
        }
        const editBtn = el.querySelector('.diagram-edit-btn') as HTMLElement | null;
        if (editBtn) {
            editBtn.style.display = 'flex';
            editBtn.style.background = 'linear-gradient(135deg, #4ade80, #22c55e)';
            editBtn.style.color = '#052e16';
            editBtn.style.border = 'none';
            editBtn.style.fontWeight = '600';
        }


        if (onAutoSave && editableRef.current) {
            const cleaned  = cleanHTML(editableRef.current);
            const markdown = htmlToMarkdown(cleaned);
            onAutoSave(markdown);
        }
    }, [onAutoSave]);

    // Register openDiagramEditor so App/PropertiesPanel can call it
    const openDiagramEditor = useCallback((block: HTMLElement) => {
        const calloutEl = block.classList.contains('callout-diagram') ? block : block.querySelector('.callout-diagram') as HTMLElement | null;
        if (!calloutEl) return;
        const encoded = calloutEl.getAttribute('data-diagram') || '';
        let initialData: DiagramData | null = null;
        if (encoded) { try { initialData = JSON.parse(decodeURIComponent(encoded)); } catch {} }
        diagramTargetEl.current    = calloutEl;
        diagramInitialData.current = initialData;
        setDiagramEditorOpen(true);
    }, []);

    useEffect(() => {
        if (onRegisterOpenDiagram) onRegisterOpenDiagram(openDiagramEditor);
    }, [onRegisterOpenDiagram, openDiagramEditor]);

    // ── Design Mode: hover events for zoom toolbar + Ctrl+Wheel zoom ──────────
    useEffect(() => {
        if (!designMode) {
            setMermaidZoom(null);
            return;
        }

        const clearHide = () => {
            if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
        };
        const scheduleHide = () => {
            clearHide();
            hideTimeoutRef.current = setTimeout(() => setMermaidZoom(null), 400);
        };

        const onEnter = (e: Event) => {
            const wrapper = (e.currentTarget as HTMLElement);
            clearHide();
            const zoomAttr = wrapper.getAttribute('data-mermaid-zoom');
            let zoom = { scale: 1, x: 0, y: 0 };
            if (zoomAttr) { try { zoom = JSON.parse(zoomAttr); } catch {} }
            setMermaidZoom({ wrapper, rect: wrapper.getBoundingClientRect(), ...zoom });
        };
        const onLeave = (e: Event) => {
            const rel = (e as MouseEvent).relatedTarget as HTMLElement | null;
            if (rel?.closest?.('.mermaid-zoom-toolbar')) return;
            scheduleHide();
        };

        // Ctrl+Wheel zoom on Mermaid diagrams
        const onWheel = (e: WheelEvent) => {
            if (!e.ctrlKey) return;
            const wrapper = (e.currentTarget as HTMLElement);
            e.preventDefault();
            e.stopPropagation();

            const zoomAttr = wrapper.getAttribute('data-mermaid-zoom');
            let zoom = { scale: 1, x: 0, y: 0 };
            if (zoomAttr) { try { zoom = JSON.parse(zoomAttr); } catch {} }

            const delta = e.deltaY < 0 ? 1.1 : 1 / 1.1;
            const newScale = Math.min(Math.max(zoom.scale * delta, 0.2), 8);
            applyMermaidZoom(wrapper, newScale, zoom.x, zoom.y);
            setMermaidZoom(prev => prev?.wrapper === wrapper
                ? { ...prev, scale: newScale, rect: wrapper.getBoundingClientRect() }
                : { wrapper, rect: wrapper.getBoundingClientRect(), scale: newScale, x: zoom.x, y: zoom.y }
            );
        };

        const attach = () => {
            if (!editableRef.current) return;
            editableRef.current.querySelectorAll('.mermaid-diagram-wrapper').forEach(w => {
                w.addEventListener('mouseenter', onEnter);
                w.addEventListener('mouseleave', onLeave);
                w.addEventListener('wheel', onWheel as EventListener, { passive: false });
            });
        };
        attach();
        const observer = new MutationObserver(attach);
        if (editableRef.current) observer.observe(editableRef.current, { childList: true, subtree: true });

        return () => {
            observer.disconnect();
            clearHide();
            if (editableRef.current) {
                editableRef.current.querySelectorAll('.mermaid-diagram-wrapper').forEach(w => {
                    w.removeEventListener('mouseenter', onEnter);
                    w.removeEventListener('mouseleave', onLeave);
                    w.removeEventListener('wheel', onWheel as EventListener);
                });
            }
        };
    }, [designMode, applyMermaidZoom]);

    useMermaidRender(content);

    const { lastSavedContentRef } = useAutoSave({
        content,
        filePath,
        designMode,
        editableRef,
        onAutoSave,
        onSelectBlocks,
        selectedBlocks
    });

    // Cleanup refs on unmounts
    const fixedContent = fixPaths(content, _rootPath || '');

    // Keep activeSourcePos in a ref so we can always access the latest value
    // without it being a stale closure issue inside layout effects
    const activeSourcePosRef = useRef<string | null | undefined>(_activeSourcePos);
    activeSourcePosRef.current = _activeSourcePos;

    // Track whether we need to scroll on the next highlight application
    const needsScrollRef = useRef<boolean>(false);

    // When activeSourcePos changes, mark that we need scroll
    useEffect(() => {
        needsScrollRef.current = true;
    }, [_activeSourcePos]);

    // Helper: find best element for a given sourcePos string
    const findBestElement = (root: HTMLElement, sourcePos: string): Element | null => {
        // 1. Try exact match first
        let best = root.querySelector(`[data-sourcepos="${sourcePos}"]`);
        if (best) return best;

        // 2. Fallback to line range logic
        const lineStr = sourcePos.split('-')[0];
        const line = parseInt(lineStr.split(':')[0] || lineStr, 10);
        if (isNaN(line)) return null;

        let bestRangeSize = Infinity;
        const elements = root.querySelectorAll('[data-sourcepos]');
        for (const el of elements) {
            const pos = (el as HTMLElement).dataset.sourcepos;
            if (!pos) continue;
            const match = pos.match(/^(\d+):\d+-(\d+):\d+$/);
            if (match) {
                const startLine = parseInt(match[1], 10);
                const endLine = parseInt(match[2], 10);
                if (line >= startLine && line <= endLine) {
                    const rangeSize = endLine - startLine;
                    if (rangeSize < bestRangeSize) {
                        bestRangeSize = rangeSize;
                        best = el;
                    }
                }
            }
        }
        return best;
    };

    // useLayoutEffect: applies live-highlight in Split Screen mode (editor+preview).
    // Skipped in Design Mode (uses selected-block class instead).
    // In pure Reading Mode (no editor), activeSourcePos never changes, so no highlight fires.
    useLayoutEffect(() => {
        if (!previewRef.current || designMode) return;

        // Remove all existing highlights
        previewRef.current.querySelectorAll('.live-highlight').forEach(el => {
            el.classList.remove('live-highlight');
        });

        // В чистом режиме чтения (нет редактора кода) выделение не показываем
        if (!hasEditor) return;

        const pos = activeSourcePosRef.current;
        if (!pos) return;

        const bestElement = findBestElement(previewRef.current, pos);
        if (bestElement) {
            bestElement.classList.add('live-highlight');
            if (needsScrollRef.current) {
                needsScrollRef.current = false;
                bestElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }
    });
    
    const selectedBlocksRef = useRef<HTMLElement[]>([]);
    useEffect(() => {
        selectedBlocksRef.current = selectedBlocks || [];
        
        if (editableRef.current) {
            editableRef.current.querySelectorAll('.selected-block').forEach(el => {
                el.classList.remove('selected-block');
                const dragHandle = el.querySelector('.custom-drag-handle');
                if (dragHandle) dragHandle.remove();
            });
            if (selectedBlocks && selectedBlocks.length > 0) {
                selectedBlocks.forEach(block => {
                    if (editableRef.current?.contains(block)) {
                        block.classList.add('selected-block');
                        
                        // Inject drag handle
                        if (designMode && !block.querySelector('.custom-drag-handle')) {
                            const handle = document.createElement('div');
                            handle.className = 'custom-drag-handle';
                            handle.contentEditable = 'false';
                            handle.draggable = true;
                            handle.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 5h.01M9 12h.01M9 19h.01M15 5h.01M15 12h.01M15 19h.01"/></svg>';
                            Object.assign(handle.style, {
                                position: 'absolute',
                                left: '-20px',
                                top: '4px',
                                width: '16px',
                                height: '20px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'grab',
                                color: 'var(--text-muted)',
                                borderRadius: '4px',
                                userSelect: 'none',
                                zIndex: '10'
                            });
                            // Make sure the block is relative so we can position absolutely
                            if (window.getComputedStyle(block).position === 'static') {
                                block.style.position = 'relative';
                            }
                            block.appendChild(handle);
                        }
                    }
                });
            }
        }
    }, [selectedBlocks]);

    // Helper to notify parent
    const handleSelect = (block: HTMLElement | null, isMultiSelect = false) => {
        if (!onSelectBlocks) {
            return;
        }
        if (!block) {
            onSelectBlocks([]);
            return;
        }
        
        if (isMultiSelect) {
            const current = selectedBlocksRef.current;
            if (current.includes(block)) {
                onSelectBlocks(current.filter(b => b !== block));
            } else {
                onSelectBlocks([...current, block]);
            }
        } else {
            onSelectBlocks([block]);
        }
    };

    // Set window variables for access from _setupDragAndDrop
    useEffect(() => {
        (window as any).__currentFilePath = filePath;
        (window as any).__previewOnRefresh = onRefresh;
        
        return () => {
            delete (window as any).__currentFilePath;
            delete (window as any).__previewOnRefresh;
        };
    }, [filePath, onRefresh]);

    // Paste handler for clipboard images
    useEffect(() => {
        if (!designMode) return;

        const handlePaste = async (e: ClipboardEvent) => {
            const items = e.clipboardData?.items;
            if (!items) return;

            let hasImage = false;
            for (const item of Array.from(items)) {
                if (item.type.startsWith('image/')) {
                    hasImage = true;
                    e.preventDefault();
                    const blob = item.getAsFile();
                    if (!blob) continue;

                    try {
                        const buffer = await blob.arrayBuffer();
                        const ext = item.type.split('/')[1] || 'png';
                        // Normalize path separators
                        const normalizedPath = filePath.replace(/\\/g, '/');
                        const baseDir = normalizedPath.substring(0, normalizedPath.lastIndexOf('/'));
                        const assetsDir = `${baseDir}/assets`;
                        const newName = `${Date.now()}-clipboard.${ext}`;
                        const destPath = `${assetsDir}/${newName}`;

                        await window.electronAPI.saveBlob(destPath, Array.from(new Uint8Array(buffer)));

                        // Create file:// URL with triple slashes for Windows
                        const fileUrl = `file:///${destPath.replace(/\\/g, '/')}`;

                        // Insert image at cursor or end
                                if (editableRef.current) {
                                    const imgEl = document.createElement('img');
                                    imgEl.src = fileUrl;
                                    imgEl.style.maxWidth = '100%';
                                    imgEl.alt = '';

                                    editableRef.current.appendChild(imgEl);
                                }

                        // Refresh file explorer
                        if (onRefresh) onRefresh();
                    } catch (err) {
                        console.error('Failed to paste image:', err);
                    }
                }
            }
            
            // Intercept HTML paste to strip foreign background colors and styles injected by browsers
            if (!hasImage && e.clipboardData?.types.includes('text/html')) {
                const html = e.clipboardData.getData('text/html');
                if (html) {
                    e.preventDefault();
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(html, 'text/html');
                    doc.body.querySelectorAll('*').forEach(el => {
                        if (el instanceof HTMLElement) {
                            el.style.backgroundColor = '';
                            el.style.color = '';
                            el.style.fontFamily = '';
                            el.style.fontSize = '';
                            el.style.lineHeight = '';
                            if (el.getAttribute('style') === '') {
                                el.removeAttribute('style');
                            }
                        }
                    });
                    document.execCommand('insertHTML', false, doc.body.innerHTML);
                }
            }
        };

        document.addEventListener('paste', handlePaste);
        return () => document.removeEventListener('paste', handlePaste);
    }, [designMode, filePath, onRefresh]);

         const handleBlockClick = (e: React.MouseEvent) => {
            let target = e.target as HTMLElement;
            if (target.closest('.block-toolbar')) return;

            if (!designMode) {
                // Split Screen: click in preview syncs editor cursor + triggers live-highlight
                if (hasEditor && onSelectSourcePos) {
                    const blockElement = target.closest('[data-sourcepos]');
                    if (blockElement) {
                        const sourcePos = blockElement.getAttribute('data-sourcepos');
                        if (sourcePos) {
                            e.stopPropagation();
                            onSelectSourcePos(sourcePos);
                        }
                    }
                }
                // Reading Mode (hasEditor=false): no selection, do nothing
                return;
            }
            if (editableRef.current && editableRef.current.contains(target) && target !== editableRef.current) {
                let blockElement = target.closest('.draggable-block') as HTMLElement;
                if (!blockElement) {
                     // Fallback for elements that might not have the class yet
                     blockElement = target.closest('.code-block-wrapper, .callout, table, p, h1, h2, h3, h4, h5, h6, li, blockquote, img, video, hr, .grid-cell, .dashboard-grid') as HTMLElement;
                }
                
                // Select the specific block they clicked on (e.g. callout inside cell). 
                // If they clicked empty space in a cell, blockElement will be the .grid-cell itself.
                if (blockElement && editableRef.current.contains(blockElement)) {
                    target = blockElement;
                } else {
                    // Fallback just in case
                    const cellElement = target.closest('.grid-cell') as HTMLElement;
                    if (cellElement && editableRef.current.contains(cellElement)) {
                        target = cellElement;
                    }
                }

                e.stopPropagation();
                handleSelect(target, e.ctrlKey || e.metaKey);
                
                // Sync with editor
                if (onSelectSourcePos) {
                    const posTarget = target.closest('[data-sourcepos]');
                    const sourcePos = posTarget ? posTarget.getAttribute('data-sourcepos') : null;
                    if (sourcePos) onSelectSourcePos(sourcePos);
                }
            } else {
                handleSelect(null);
            }
        };

        // Register Save Callback
        useEffect(() => {
            if (onRegisterSave) {
                onRegisterSave(() => {
                    if (editableRef.current) {
                         const html = cleanHTML(editableRef.current);
                         return htmlToMarkdown(html);
                    }
                    return fixedContent;
                });
            }
        }, [onRegisterSave, fixedContent]);

        // Clear selection when exiting Design Mode
        useEffect(() => {
            if (!designMode && onSelectBlocks && selectedBlocks && selectedBlocks.length > 0) {
                onSelectBlocks([]);
            }
        }, [designMode, onSelectBlocks, selectedBlocks]);

        // Handle entering Design Mode and external content changes
        useEffect(() => {
            // Cleanup previous if exists immediately
            if (dndCleanupRef.current) {
                 dndCleanupRef.current();
                 dndCleanupRef.current = null;
            }

            if (designMode && previewRef.current) {
                    const timer = setTimeout(() => {
                        if (previewRef.current && editableRef.current) {
                            // Only sync DOM if entering design mode OR content was changed externally (e.g. from code editor)
                            // If it matches lastSavedContentRef, it means the change originated from the visual editor itself.
                            if (content !== lastSavedContentRef.current || editableRef.current.innerHTML === '') {
                                // Copy previewRef HTML (preserves Mermaid SVGs, tables, etc.)
                                editableRef.current.innerHTML = previewRef.current.innerHTML;

                                // Post-process: restore data-diagram + buttons for diagram callouts.
                                // previewRef renders DiagramCallout as React component without data-diagram,
                                // so we parse markdown to find saved JSON and inject it back into DOM.
                                const diagramEls = Array.from(editableRef.current.querySelectorAll('.callout-diagram')) as HTMLElement[];
                                if (diagramEls.length > 0) {
                                    // Parse markdown line by line to extract diagram JSON blocks

                                    const lines = content.split('\n');
                                    const diagrams: Array<{ json: string; width: string; height: string }> = [];
                                    let inDiagram = false;
                                    let inExcalidraw = false;
                                    let jsonLines: string[] = [];
                                    let w = '0', h = '0';

                                    for (const line of lines) {
                                        const stripped = line.replace(/^>\s?/, '');
                                        if (/^\[!diagram\]/i.test(stripped)) {
                                            inDiagram = true; inExcalidraw = false; jsonLines = []; w = '0'; h = '0';
                                        } else if (inDiagram) {
                                            if (!line.startsWith('>')) {
                                                // End of callout block
                                                if (jsonLines.length > 0) diagrams.push({ json: jsonLines.join('\n'), width: w, height: h });
                                                else diagrams.push({ json: '', width: '0', height: '0' });
                                                inDiagram = false; inExcalidraw = false;
                                            } else if (stripped.startsWith('```excalidraw') || stripped.startsWith('```drawio')) {
                                                inExcalidraw = true;
                                            } else if (inExcalidraw && stripped.startsWith('```')) {
                                                inExcalidraw = false;
                                            } else if (inExcalidraw) {
                                                jsonLines.push(stripped);
                                            } else {
                                                const dm = stripped.match(/<!--\s*w:(\d+)\s*h:(\d+)\s*-->/);
                                                if (dm) { w = dm[1]; h = dm[2]; }
                                            }
                                        }
                                    }
                                    if (inDiagram) {
                                        if (jsonLines.length > 0) diagrams.push({ json: jsonLines.join('\n'), width: w, height: h });
                                        else diagrams.push({ json: '', width: '0', height: '0' });
                                    }

                                    const diagramSvgIcon = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>';

                                    diagramEls.forEach((el, idx) => {
                                        const d = diagrams[idx];
                                        if (!d) return;

                                        const rawJson = d.json.trim();
                                        const hasData = rawJson.startsWith('{') || rawJson.startsWith('<svg');
                                        el.setAttribute('data-diagram', hasData ? encodeURIComponent(rawJson) : '');
                                        el.setAttribute('data-diagram-width', d.width);
                                        el.setAttribute('data-diagram-height', d.height);

                                        // Rebuild title area with edit button
                                        let titleEl = el.querySelector('.callout-title') as HTMLElement | null;
                                        if (!titleEl) {
                                            titleEl = document.createElement('div');
                                            titleEl.className = 'callout-title';
                                            el.prepend(titleEl);
                                        }
                                        // In read mode with a diagram, hide the title bar entirely
                                        if (hasData && !designMode) {
                                            titleEl.style.display = 'none';
                                        } else {
                                            titleEl.style.display = '';
                                            const titleText2 = titleEl.querySelector('.callout-title-inner')?.textContent || 'Диаграмма';
                                            titleEl.innerHTML = `
                                                <div class="callout-icon">${diagramSvgIcon}</div>
                                                <div class="callout-title-inner">${titleText2}</div>
                                                <button class="diagram-edit-btn" contenteditable="false" style="${hasData ? 'display:flex' : 'display:none'};align-items:center;gap:5px;padding:5px 12px;margin-left:auto;background:linear-gradient(135deg,#4ade80,#22c55e);border:none;border-radius:6px;font-size:11px;font-weight:600;color:#052e16;cursor:pointer;">
                                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                                    Редактировать
                                                </button>`;
                                        }

                                        // Rebuild content area
                                        let contentEl = el.querySelector('.callout-content') as HTMLElement | null;
                                        if (!contentEl) {
                                            contentEl = document.createElement('div');
                                            contentEl.className = 'callout-content';
                                            el.appendChild(contentEl);
                                        }
                                        if (hasData) {
                                            const isSvg = rawJson.startsWith('<svg');
                                            const renderedContent = isSvg
                                                ? rawJson
                                                : `<div style="padding:12px;text-align:center;color:var(--text-muted);font-size:13px;">
                                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="display:block;margin:0 auto 8px"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
                                                    Диаграмма сохранена &mdash; нажмите <b>Редактировать</b> для изменения
                                                   </div>`;
                                            contentEl.innerHTML = `<div class="diagram-saved-indicator" style="display:flex;justify-content:center;overflow:hidden;border-radius:6px;padding:8px;">
                                                ${renderedContent}
                                            </div>`;
                                        } else {
                                            contentEl.innerHTML = `<div class="diagram-callout-empty" style="display:flex;flex-direction:column;align-items:center;gap:12px;padding:32px 24px;text-align:center;">
                                                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" style="color:#89b4fa;opacity:0.6"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
                                                <p style="font-size:13px;color:var(--text-muted);margin:0;">Диаграмма не создана</p>
                                                <button class="diagram-create-btn" contenteditable="false" style="display:flex;align-items:center;gap:8px;padding:9px 20px;background:linear-gradient(135deg,#4ade80,#22c55e);color:#052e16;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                                                    Создать диаграмму
                                                </button>
                                            </div>`;
                                        }
                                    });
                                }

                                // Update last saved content so we don't infinitely re-sync
                                lastSavedContentRef.current = content;
                            }


                            
                            interactionsCleanupRef.current = setupInteractions(editableRef.current);
                            dndCleanupRef.current = setupDragAndDrop({ container: editableRef.current, markdownToHtmlHelper });
                            resizeCleanupRef.current = setupResize(editableRef.current);
                        }
                    }, 100);
                return () => clearTimeout(timer);
            }
            
            return () => {
                if (dndCleanupRef.current) {
                    dndCleanupRef.current();
                    dndCleanupRef.current = null;
                }
                if (resizeCleanupRef.current) {
                    resizeCleanupRef.current();
                    resizeCleanupRef.current = null;
                }
                if (interactionsCleanupRef.current) {
                    interactionsCleanupRef.current();
                    interactionsCleanupRef.current = null;
                }
            };
        }, [designMode, content]);

    if (!fixedContent && !designMode) return null;

    // Uri transformations moved to utils/uriTransform.ts

    const processedContent = fixedContent
        .replace(/!\[([^\]]*)\]\s*\((?!<)([^)]+)\)/g, '![$1](<$2>)')
        .replace(/!\[\[([^|\]]+)(?:\|.*?)?\]\]/g, (_, filename) => `![${filename}](<${filename}>)`)
        .replace(/\[\[(.*?)\|(.*?)\]\]/g, '[$2](<$1>)')
        .replace(/\[\[(.*?)\]\]/g, '[$1](<$1>)');

    // ── Mermaid floating zoom toolbar (Design Mode) ───────────────────────────
    // scale here is the USER-RELATIVE zoom: 1.0 = fit to container = 100%
    const zoomToolbar = mermaidZoom && designMode ? (() => {
        const { wrapper, rect, scale, x, y } = mermaidZoom;
        const update = (newScale: number, newX = x, newY = y) => {
            // Clamp: minimum 10% of container, maximum 800%
            const clampedScale = Math.min(Math.max(newScale, 0.1), 8);
            applyMermaidZoom(wrapper, clampedScale, newX, newY);
            setMermaidZoom(prev => prev ? { ...prev, scale: clampedScale, x: newX, y: newY, rect: wrapper.getBoundingClientRect() } : null);
        };
        const btnBase: React.CSSProperties = {
            background: 'none', border: 'none', color: '#ccc', cursor: 'pointer',
            padding: '4px 6px', display: 'flex', alignItems: 'center', borderRadius: '4px',
            fontSize: '12px', lineHeight: 1,
        };
        return (
            <div
                className="mermaid-zoom-toolbar"
                onMouseEnter={() => { if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current); }}
                onMouseLeave={() => { hideTimeoutRef.current = setTimeout(() => setMermaidZoom(null), 400); }}
                style={{
                    position: 'fixed',
                    top: rect.top + 8,
                    right: Math.max(8, window.innerWidth - rect.right + 8),
                    zIndex: 9999,
                    display: 'flex', alignItems: 'center', gap: '2px',
                    background: 'rgba(20,20,20,0.88)',
                    backdropFilter: 'blur(6px)',
                    borderRadius: '8px',
                    padding: '4px 6px',
                    boxShadow: '0 2px 12px rgba(0,0,0,0.5)',
                    userSelect: 'none',
                }}
            >
                <button style={btnBase} title="Zoom in (+25%)" onClick={() => update(scale * 1.25)}><ZoomIn size={13}/></button>
                <span
                    style={{ color: '#aaa', fontSize: '11px', minWidth: '42px', textAlign: 'center', fontVariantNumeric: 'tabular-nums', cursor: 'default' }}
                    title="Cap relative to SVG natural size. Diagram scales down on small screens but never exceeds this size."
                >
                    {Math.round(scale * 100)}%
                </span>
                <button style={btnBase} title="Zoom out (-25%)" onClick={() => update(scale / 1.25)}><ZoomOut size={13}/></button>
                <div style={{ width: '1px', background: '#444', height: '14px', margin: '0 3px' }} />
                <button style={btnBase} title="Reset to natural size cap (100%)" onClick={() => update(1, 0, 0)}><Maximize2 size={13}/></button>
            </div>
        );
    })() : null;

    // Single return point — both main JSX and zoom toolbar
    return (
        <>
        <div 
            className={`markdown-preview${designMode ? ' design-mode' : ''}`} 
            style={{ padding: '20px 40px', paddingBottom: '100px', height: '100%', overflowY: 'auto', boxSizing: 'border-box' }}
            onClick={() => {
                if (designMode && onSelectBlocks) {
                    // Only clear if the click wasn't already handled (e.stopPropagation) by a block
                    onSelectBlocks([]);
                }
            }}
        >
            <div className="markdown-content-wrapper" style={{ position: 'relative' }}>

                {designMode && (
                    <>
                        <div 
                            onClick={handleBlockClick}
                            ref={editableRef}
                            className="design-mode-container"
                            contentEditable
                            suppressContentEditableWarning
                            style={{
                                outline: '2px solid var(--interactive-accent)',
                                minHeight: '200px',
                                padding: '10px',
                                borderRadius: '4px',
                                backgroundColor: 'var(--background-primary)'
                            }}
                        />
                        <TextToolbar containerRef={editableRef} designMode={designMode} />
                    </>
                )}

                <div ref={previewRef} style={{ display: designMode ? 'none' : 'block' }} onClick={handleBlockClick}>
                    <DesignModeContext.Provider value={false}>
                    <ReactMarkdown 
                        remarkPlugins={[remarkGfm]} 
                        rehypePlugins={[rehypeRaw, rehypeSourceLine]}
                        urlTransform={(uri) => transformImageUri(uri, filePath, allFiles)}
                        components={getMarkdownComponents({ 
                            filePath, 
                            allFiles, 
                            onFileSelect
                        })}
                    >
                        {processedContent}
                    </ReactMarkdown>
                    </DesignModeContext.Provider>
                </div>
            </div>
        </div>
        {zoomToolbar}

        {/* DiagramEditor modal — Design Mode only */}
        {diagramEditorOpen && designMode && createPortal(
            <DiagramEditor
                initialData={diagramInitialData.current}
                onSave={handleDiagramSave}
                onClose={() => setDiagramEditorOpen(false)}
            />,
            document.body
        )}
        </>
    );
}
