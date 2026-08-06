import React, { useRef, useEffect, useCallback } from 'react';
import { Excalidraw } from '@excalidraw/excalidraw';
import './DiagramCallout.css';

export interface DiagramData {
    elements: any[];
    appState: Record<string, any>;
    files: Record<string, any>;
    width: number;
    height: number;
}

interface DiagramEditorProps {
    initialData: DiagramData | null;
    onSave: (data: DiagramData) => void;
    onClose: () => void;
}

export const DiagramEditor: React.FC<DiagramEditorProps> = ({ initialData, onSave, onClose }) => {
    const apiRef = useRef<any>(null);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    useEffect(() => {
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = prev; };
    }, []);

    const handleSave = useCallback(() => {
        const api = apiRef.current;
        if (!api) return;

        const elements  = api.getSceneElements();
        const appState  = api.getAppState();
        const files     = api.getFiles();

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        elements.forEach((el: any) => {
            minX = Math.min(minX, el.x);
            minY = Math.min(minY, el.y);
            maxX = Math.max(maxX, el.x + (el.width  || 0));
            maxY = Math.max(maxY, el.y + (el.height || 0));
        });

        const padding = 40;
        const diagramWidth  = elements.length > 0 ? Math.max(maxX - minX + padding * 2, 400) : 800;
        const diagramHeight = elements.length > 0 ? Math.max(maxY - minY + padding * 2, 300) : 500;

        onSave({
            elements,
            appState: {
                viewBackgroundColor: appState.viewBackgroundColor,
                currentItemFontFamily: appState.currentItemFontFamily,
                zoom: appState.zoom,
            },
            files,
            width:  Math.round(diagramWidth),
            height: Math.round(diagramHeight),
        });
    }, [onSave]);

    const initialStateForEditor = initialData ? {
        elements:  initialData.elements,
        appState:  initialData.appState,
        files:     initialData.files,
        scrollToContent: true,
    } : undefined;

    return (
        <div className="diagram-editor-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="diagram-editor-modal" onMouseDown={(e) => e.stopPropagation()}>

                <div className="diagram-editor-header">
                    <div className="diagram-editor-title">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="3" width="18" height="18" rx="2"/>
                            <path d="M3 9h18M9 21V9"/>
                        </svg>
                        Редактор диаграмм
                    </div>
                    <div className="diagram-editor-actions">
                        <button className="diagram-btn diagram-btn-cancel" onClick={onClose}>Отмена</button>
                        <button className="diagram-btn diagram-btn-save" onClick={handleSave}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                                <polyline points="17 21 17 13 7 13 7 21"/>
                                <polyline points="7 3 7 8 15 8"/>
                            </svg>
                            Сохранить
                        </button>
                        <button className="diagram-btn diagram-btn-close" onClick={onClose} title="Закрыть (Esc)">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <line x1="18" y1="6" x2="6" y2="18"/>
                                <line x1="6" y1="6" x2="18" y2="18"/>
                            </svg>
                        </button>
                    </div>
                </div>

                <div className="diagram-editor-body">
                    <Excalidraw
                        excalidrawAPI={(api: any) => { apiRef.current = api; }}
                        initialData={initialStateForEditor}
                        UIOptions={{
                            canvasActions: {
                                saveToActiveFile: false,
                                loadScene: true,
                                export: { saveFileToDisk: true },
                            },
                        }}
                        langCode="ru-RU"
                        theme="dark"
                    />
                </div>
            </div>
        </div>
    );
};
