import React from 'react';
import type { DiagramData } from './DiagramEditor';
import './DiagramCallout.css';

interface DiagramViewerProps {
    data: DiagramData;
    onEdit: () => void;
    isDesignMode: boolean;
}

export const DiagramViewer: React.FC<DiagramViewerProps> = ({ data, onEdit, isDesignMode }) => {
    return (
        <div className="diagram-viewer-outer">
            {isDesignMode && (
                <div className="diagram-viewer-toolbar" style={{ position: 'absolute', top: 8, right: 8, zIndex: 10 }}>
                    <button className="diagram-viewer-btn" onClick={onEdit} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '6px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-main)', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                        Редактировать
                    </button>
                </div>
            )}

            <div 
                className="diagram-viewer-inner" 
                onDoubleClick={isDesignMode ? onEdit : undefined}
                style={{ 
                    width: '100%', 
                    display: 'flex', 
                    justifyContent: 'center', 
                    alignItems: 'center', 
                    overflow: 'hidden',
                    background: '#fff',
                    borderRadius: '8px',
                    padding: '8px',
                    position: 'relative'
                }}
                dangerouslySetInnerHTML={{ __html: data.svg }}
            />
        </div>
    );
};
