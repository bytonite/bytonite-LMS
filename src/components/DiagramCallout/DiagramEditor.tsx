import React, { useEffect, useRef } from 'react';

export type DiagramData = {
    svg: string; // The raw SVG string returned by draw.io
    width: number;
    height: number;
};

interface DiagramEditorProps {
    initialData?: DiagramData | null;
    onSave: (data: DiagramData) => void;
    onClose: () => void;
}

export const DiagramEditor: React.FC<DiagramEditorProps> = ({ initialData, onSave, onClose }) => {
    const iframeRef = useRef<HTMLIFrameElement>(null);

    useEffect(() => {
        const handleMessage = (e: MessageEvent) => {
            if (e.origin !== 'https://embed.diagrams.net') return;
            
            try {
                const msg = JSON.parse(e.data);
                
                if (msg.event === 'init') {
                    // Iframe is ready. Send load action.
                    iframeRef.current?.contentWindow?.postMessage(JSON.stringify({
                        action: 'load',
                        autosave: 1,
                        saveAndExit: '1',
                        modified: 'unsaved',
                        xml: initialData?.svg || '', // For empty, draw.io creates a new diagram
                        title: 'Диаграмма'
                    }), '*');
                }
                
                if (msg.event === 'save') {
                    // When user clicks save, we request the export as SVG
                    iframeRef.current?.contentWindow?.postMessage(JSON.stringify({
                        action: 'export',
                        format: 'xmlsvg',
                        spin: 'Updating...',
                    }), '*');
                }

                if (msg.event === 'export') {
                    // We receive the exported SVG (data URI or raw depending on settings)
                    // The 'data' field contains the SVG string since we requested xmlsvg format
                    const rawSvg = msg.data;
                    
                    // Decode base64 if needed, or if it's already string, use it.
                    let svgStr = rawSvg;
                    if (svgStr.startsWith('data:image/svg+xml;base64,')) {
                        svgStr = atob(svgStr.split(',')[1]);
                    }

                    // Extract width/height roughly from svg attributes if possible
                    let width = 800;
                    let height = 600;
                    const wMatch = svgStr.match(/width="([\d.]+)px"/);
                    const hMatch = svgStr.match(/height="([\d.]+)px"/);
                    if (wMatch) width = Math.round(parseFloat(wMatch[1]));
                    if (hMatch) height = Math.round(parseFloat(hMatch[1]));

                    onSave({
                        svg: svgStr,
                        width,
                        height
                    });
                }
                
                if (msg.event === 'exit') {
                    onClose();
                }

            } catch (err) {
                console.error("Error parsing draw.io message", err);
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [initialData, onSave, onClose]);

    return (
        <div className="diagram-editor-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="diagram-editor-modal" style={{ padding: 0, overflow: 'hidden' }} onMouseDown={(e) => e.stopPropagation()}>
                <iframe
                    ref={iframeRef}
                    title="Diagram Editor"
                    src="https://embed.diagrams.net/?embed=1&ui=dark&spin=1&proto=json&configure=1&noSaveBtn=0"
                    style={{ width: '100%', height: '100%', border: 'none' }}
                />
            </div>
        </div>
    );
};
