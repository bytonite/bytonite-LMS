import React, { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { DiagramEditor } from './DiagramEditor';
import { DiagramViewer } from './DiagramViewer';
import type { DiagramData } from './DiagramEditor';
import './DiagramCallout.css';

interface DiagramCalloutProps {
    /** JSON-encoded DiagramData (stored in data-diagram attribute in DOM) */
    initialDataJson: string | null;
    /** Called when user saves — passes back the serialised JSON and natural dims */
    onSave: (json: string, width: number, height: number) => void;
    /** Whether the parent preview is in Design Mode */
    isDesignMode: boolean;
    title: string;
}

export const DiagramCallout: React.FC<DiagramCalloutProps> = ({
    initialDataJson,
    onSave,
    isDesignMode,
    title: _title,
}) => {
    const [isEditorOpen, setIsEditorOpen] = useState(false);

    const parsedData: DiagramData | null = (() => {
        if (!initialDataJson) return null;
        try { return JSON.parse(initialDataJson); } catch { return null; }
    })();

    const handleSave = useCallback((data: DiagramData) => {
        setIsEditorOpen(false);
        onSave(JSON.stringify(data), data.width, data.height);
    }, [onSave]);

    const openEditor = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();   // Don't bubble to contentEditable
        e.preventDefault();
        setIsEditorOpen(true);
    }, []);

    const closeEditor = useCallback(() => setIsEditorOpen(false), []);

    return (
        <>
            {/* ── Main callout content ── */}
            {parsedData ? (
                <DiagramViewer
                    data={parsedData}
                    onEdit={openEditor as any}
                    isDesignMode={isDesignMode}
                />
            ) : isDesignMode ? (
                /* Empty state: only shown in Design Mode */
                <div className="diagram-callout-empty">
                    <div className="diagram-callout-empty-icon">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                            <rect x="3" y="3" width="18" height="18" rx="2"/>
                            <path d="M3 9h18M9 21V9"/>
                        </svg>
                    </div>
                    <p>Диаграмма ещё не создана.<br/>Нажмите кнопку ниже, чтобы открыть конструктор.</p>
                    <button className="diagram-create-btn" onMouseDown={openEditor}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <line x1="12" y1="5" x2="12" y2="19"/>
                            <line x1="5" y1="12" x2="19" y2="12"/>
                        </svg>
                        Создать диаграмму
                    </button>
                </div>
            ) : (
                /* Reading Mode, no diagram: show nothing */
                null
            )}

            {/* ── Editor modal (portal to document.body) — Design Mode only ── */}
            {isEditorOpen && isDesignMode && createPortal(
                <DiagramEditor
                    initialData={parsedData}
                    onSave={handleSave}
                    onClose={closeEditor}
                />,
                document.body
            )}
        </>

    );
};
