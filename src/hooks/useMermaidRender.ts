import { useEffect } from 'react';
import mermaid from 'mermaid';
import { stripMermaidZoom } from '../components/MermaidReactComponent';

mermaid.initialize({ startOnLoad: false, theme: 'dark' });

/**
 * Applies a responsive zoom to a Mermaid diagram wrapper.
 *
 * Instead of CSS `transform: scale()` (which does NOT affect document flow
 * and causes diagrams to overlap elements below), we set actual `width` and
 * `height` on the SVG element. This makes the layout correctly expand the
 * wrapper block and push sibling elements down.
 *
 * Scale semantics (userScale is relative to SVG's natural viewBox size):
 *   userScale = 1.0  →  SVG at natural pixel size (cap = 100%)
 *   userScale = 2.0  →  SVG can grow up to 2× natural size (cap = 200%)
 *
 * Effective scale = min(fitScale, userScale)
 *   fitScale = containerWidth / naturalWidth
 *
 * Behaviour:
 *   • Container narrower than cap → SVG fills container (shrinks)
 *   • Container wider than cap   → SVG freezes at cap (does NOT grow further)
 */
export function applyResponsiveTransform(wrapper: HTMLElement): void {
    const container = wrapper.querySelector('.mermaid-svg-container') as HTMLElement | null;
    if (!container) return;

    const naturalWidth  = parseFloat(wrapper.getAttribute('data-mermaid-natural-width')  || '0');
    const naturalHeight = parseFloat(wrapper.getAttribute('data-mermaid-natural-height') || '0');
    const containerWidth = wrapper.clientWidth;
    if (!naturalWidth || !containerWidth) return;

    const zoomAttr = wrapper.getAttribute('data-mermaid-zoom');
    let userZoom = { scale: 1, x: 0, y: 0 };
    if (zoomAttr) { try { userZoom = JSON.parse(zoomAttr); } catch { /* ignore */ } }

    // fitScale: scale needed to fill the container width exactly.
    const fitScale = containerWidth / naturalWidth;
    // Cap: never exceed the user's chosen scale relative to natural SVG size.
    const effectiveScale = Math.min(fitScale, userZoom.scale);

    const targetWidth  = naturalWidth  * effectiveScale;
    const targetHeight = naturalHeight * effectiveScale;

    // Set actual SVG dimensions so the wrapper expands in document flow,
    // pushing elements below down — avoiding overlap.
    const svgEl = container.querySelector('svg');
    if (svgEl) {
        svgEl.style.width  = `${targetWidth}px`;
        svgEl.style.height = `${targetHeight}px`;
        svgEl.style.minWidth  = '';
        svgEl.style.minHeight = '';
    }

    // Keep only translation (no scale transform — scale is handled by SVG dimensions above).
    if (userZoom.x !== 0 || userZoom.y !== 0) {
        container.style.transform = `translate(${userZoom.x}px, ${userZoom.y}px)`;
    } else {
        container.style.transform = '';
    }
    container.style.transformOrigin = '';
}

// Keep one ResizeObserver per wrapper element across re-renders
const resizeObservers = new WeakMap<HTMLElement, ResizeObserver>();

export const useMermaidRender = (content: string) => {
    useEffect(() => {
        const renderAllMermaid = async () => {
            const wrappers = document.querySelectorAll('.mermaid-diagram-wrapper');
            for (const wrapper of Array.from(wrappers)) {
                const wrapperEl = wrapper as HTMLElement;
                const rawCode = wrapper.getAttribute('data-mermaid-code') || '';
                const container = wrapper.querySelector('.mermaid-svg-container') as HTMLElement | null;
                if (!rawCode || !container) continue;

                // Strip zoom comment before passing to mermaid renderer
                const code = stripMermaidZoom(rawCode);
                if (!code) continue;

                try {
                    const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
                    const { svg } = await mermaid.render(id, code);
                    container.innerHTML = svg;

                    const svgEl = container.querySelector('svg');
                    if (svgEl) {
                        // Extract natural dimensions from the SVG viewBox.
                        // These are stored on the wrapper so applyResponsiveTransform
                        // can be called at any time without needing to re-query the SVG.
                        let naturalWidth = 0;
                        let naturalHeight = 0;

                        const vb = svgEl.getAttribute('viewBox');
                        if (vb) {
                            const parts = vb.trim().split(/[\s,]+/);
                            if (parts.length >= 4) {
                                naturalWidth  = parseFloat(parts[2]);
                                naturalHeight = parseFloat(parts[3]);
                            }
                        }
                        // Fallback: use rendered bounding box
                        if (!naturalWidth || isNaN(naturalWidth)) {
                            const rect = svgEl.getBoundingClientRect();
                            naturalWidth  = rect.width  || wrapperEl.clientWidth  || 600;
                            naturalHeight = rect.height || 200;
                        }

                        wrapperEl.setAttribute('data-mermaid-natural-width',  String(naturalWidth));
                        wrapperEl.setAttribute('data-mermaid-natural-height', String(naturalHeight));

                        // Remove any max-width Mermaid sometimes adds
                        svgEl.style.maxWidth  = 'none';
                        svgEl.style.maxHeight = 'none';
                        svgEl.style.overflow  = 'visible';
                    }

                    // Apply responsive sizing (sets actual SVG width/height)
                    applyResponsiveTransform(wrapperEl);

                    // Block pointer events — interaction is via toolbar only.
                    container.style.pointerEvents = 'none';
                    container.style.overflow = 'visible';

                    // Attach a ResizeObserver so the diagram re-scales when
                    // the container (panel, window, split-screen) changes size.
                    if (!resizeObservers.has(wrapperEl)) {
                        const ro = new ResizeObserver(() => {
                            applyResponsiveTransform(wrapperEl);
                        });
                        ro.observe(wrapperEl);
                        resizeObservers.set(wrapperEl, ro);
                    }

                } catch (err) {
                    console.error('Mermaid render error:', err);
                    container.innerHTML = `<div style="color:#ef4444;font-family:monospace;font-size:14px;padding:16px;">Syntax error in Mermaid diagram</div>`;
                }
            }
        };

        renderAllMermaid();

        const observer = new MutationObserver((mutations) => {
            const shouldRender = mutations.some(m => {
                if (m.type === 'attributes' && m.attributeName === 'data-mermaid-code') return true;
                if (m.type === 'childList') {
                    return Array.from(m.addedNodes).some(node => {
                        if (node.nodeType !== Node.ELEMENT_NODE) return false;
                        const el = node as HTMLElement;
                        return el.classList.contains('mermaid-diagram-wrapper') || !!el.querySelector('.mermaid-diagram-wrapper');
                    });
                }
                return false;
            });
            if (shouldRender) renderAllMermaid();
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['data-mermaid-code'],
        });

        return () => observer.disconnect();
    }, [content]);
};
