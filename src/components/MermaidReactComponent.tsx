import React from 'react';

interface MermaidReactComponentProps {
    code: string;
}

/** Parse %% zoom: {...} comment from mermaid code */
export function parseMermaidZoom(code: string): { scale: number; x: number; y: number } | null {
    const m = code.match(/^%% zoom: ({.+})$/m);
    if (!m) return null;
    try { return JSON.parse(m[1]); } catch { return null; }
}

/** Strip the %% zoom comment from mermaid code before rendering */
export function stripMermaidZoom(code: string): string {
    return code.replace(/^%% zoom: {.+}$/m, '').trim();
}

export const MermaidReactComponent: React.FC<MermaidReactComponentProps> = ({ code }) => {
    const zoom = parseMermaidZoom(code);
    const cleanCode = stripMermaidZoom(code);

    return (
        <div
            className="mermaid-diagram-wrapper"
            data-mermaid-code={cleanCode}
            data-mermaid-zoom={zoom ? JSON.stringify(zoom) : undefined}
            style={{
                position: 'relative',
                margin: '2.5em 0 1em 0',
                backgroundColor: '#1e1e1e',
                borderRadius: '8px',
                width: '100%',
                // overflow: hidden — now that scaling is done via SVG width/height
                // (not transform: scale), the SVG takes up its real layout space
                // and the wrapper grows naturally to contain it.
                overflow: 'hidden',
                userSelect: 'none',
            }}
        >
            <div style={{
                width: '100%',
                minHeight: 120,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'flex-start',
                padding: '16px',
                boxSizing: 'border-box',
            }}>
                <div
                    className="mermaid-svg-container"
                    style={{
                        // No scale transform here — applyResponsiveTransform sets
                        // SVG width/height directly, which correctly expands the layout.
                        display: 'flex',
                        justifyContent: 'center',
                        // Reading mode: fully static — no pointer events
                        pointerEvents: 'none',
                        overflow: 'visible',
                    }}
                >
                    <div style={{ color: '#888', fontSize: '13px' }}>Rendering diagram…</div>
                </div>
            </div>
        </div>
    );
};
