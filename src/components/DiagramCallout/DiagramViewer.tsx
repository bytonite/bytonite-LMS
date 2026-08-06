import React, { useRef, useEffect, useCallback, useState } from 'react';
import { Excalidraw } from '@excalidraw/excalidraw';
import type { DiagramData } from './DiagramEditor';
import './DiagramCallout.css';

interface DiagramViewerProps {
    data: DiagramData;
    onEdit: () => void;
    isDesignMode: boolean;
}

export const DiagramViewer: React.FC<DiagramViewerProps> = ({ data, onEdit, isDesignMode }) => {
    const outerRef = useRef<HTMLDivElement>(null);
    const innerRef = useRef<HTMLDivElement>(null);
    const apiRef   = useRef<any>(null);
    const [scale, setScale] = useState(1);

    const applyScale = useCallback(() => {
        const outer = outerRef.current;
        const inner = innerRef.current;
        if (!outer || !inner) return;

        const containerWidth = outer.clientWidth;
        const newScale = Math.min(1, containerWidth / data.width);
        setScale(newScale);

        inner.style.width  = `${data.width}px`;
        inner.style.height = `${data.height}px`;
        inner.style.transform = `scale(${newScale})`;
        inner.style.transformOrigin = 'top left';

        outer.style.height = `${data.height * newScale}px`;
    }, [data.width, data.height]);

    useEffect(() => { applyScale(); }, [applyScale]);

    useEffect(() => {
        const outer = outerRef.current;
        if (!outer) return;
        const ro = new ResizeObserver(applyScale);
        ro.observe(outer);
        return () => ro.disconnect();
    }, [applyScale]);

    const handleExcalidrawApi = useCallback((api: any) => {
        apiRef.current = api;
        setTimeout(() => {
            try { api.scrollToContent(data.elements, { fitToViewport: true }); } catch {}
        }, 150);
    }, [data.elements]);

    return (
        <div ref={outerRef} className="diagram-viewer-outer">
            {isDesignMode && (
                <div className="diagram-viewer-toolbar">
                    <button className="diagram-viewer-btn" onClick={onEdit}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                        Редактировать
                    </button>
                    <span style={{ fontSize: '11px', color: '#6c7086', alignSelf: 'center', fontVariantNumeric: 'tabular-nums' }}>
                        {Math.round(scale * 100)}%
                    </span>
                </div>
            )}

            <div ref={innerRef} className="diagram-viewer-inner" onDoubleClick={isDesignMode ? onEdit : undefined}>
                <Excalidraw
                    excalidrawAPI={handleExcalidrawApi}
                    initialData={{
                        elements: data.elements,
                        appState: {
                            ...data.appState,
                            viewModeEnabled: true,
                            zenModeEnabled: false,
                        },
                        files: data.files,
                        scrollToContent: true,
                    }}
                    viewModeEnabled={true}
                    UIOptions={{ canvasActions: { saveToActiveFile: false } }}
                    theme="dark"
                />
            </div>
        </div>
    );
};
