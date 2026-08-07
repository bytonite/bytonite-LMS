import React, { useRef, useEffect, useState, useCallback } from 'react';
import './DiagramCallout.css';

export type DiagramData = {
    svg: string;
    width: number;
    height: number;
};

interface DiagramEditorProps {
    initialData?: DiagramData | null;
    onSave: (data: DiagramData) => void;
    onClose: () => void;
}

// ── Shape types ────────────────────────────────────────────────────────────
type Tool = 'select' | 'rect' | 'ellipse' | 'diamond' | 'arrow' | 'line' | 'text';

interface Point { x: number; y: number; }

interface Shape {
    id: string;
    type: 'rect' | 'ellipse' | 'diamond' | 'arrow' | 'line' | 'text';
    x: number; y: number;
    width: number; height: number;
    label: string;
    fill: string;
    stroke: string;
    strokeWidth: number;
    fontSize: number;
    // for arrow/line
    x2?: number; y2?: number;
}

const DEFAULT_FILL = '#313244';
const DEFAULT_STROKE = '#89b4fa';
const FILL_COLORS = ['#313244', '#1e1e2e', '#89b4fa', '#a6e3a1', '#f9e2af', '#f38ba8', '#cba6f7', '#45475a', 'transparent'];
const STROKE_COLORS = ['#89b4fa', '#a6e3a1', '#f38ba8', '#f9e2af', '#cba6f7', '#cdd6f4', 'currentColor'];

let idCounter = 0;
const newId = () => `shape_${Date.now()}_${idCounter++}`;

// ── SVG shape renderers ────────────────────────────────────────────────────
function renderShapeSvg(s: Shape, selected: boolean): string {
    const sw = s.strokeWidth;
    const selAttr = selected ? 'stroke-dasharray="5,3" opacity="0.8"' : '';

    switch (s.type) {
        case 'rect':
            return `<g>
  <rect x="${s.x}" y="${s.y}" width="${s.width}" height="${s.height}" rx="6" fill="${s.fill}" stroke="${s.stroke}" stroke-width="${sw}" ${selAttr}/>
  ${s.label ? `<text x="${s.x + s.width/2}" y="${s.y + s.height/2 + s.fontSize*0.35}" text-anchor="middle" fill="currentColor" font-size="${s.fontSize}" font-family="Inter,sans-serif">${escSvg(s.label)}</text>` : ''}
</g>`;
        case 'ellipse':
            return `<g>
  <ellipse cx="${s.x + s.width/2}" cy="${s.y + s.height/2}" rx="${s.width/2}" ry="${s.height/2}" fill="${s.fill}" stroke="${s.stroke}" stroke-width="${sw}" ${selAttr}/>
  ${s.label ? `<text x="${s.x + s.width/2}" y="${s.y + s.height/2 + s.fontSize*0.35}" text-anchor="middle" fill="currentColor" font-size="${s.fontSize}" font-family="Inter,sans-serif">${escSvg(s.label)}</text>` : ''}
</g>`;
        case 'diamond': {
            const cx = s.x + s.width/2, cy = s.y + s.height/2;
            const pts = `${cx},${s.y} ${s.x+s.width},${cy} ${cx},${s.y+s.height} ${s.x},${cy}`;
            return `<g>
  <polygon points="${pts}" fill="${s.fill}" stroke="${s.stroke}" stroke-width="${sw}" ${selAttr}/>
  ${s.label ? `<text x="${cx}" y="${cy + s.fontSize*0.35}" text-anchor="middle" fill="currentColor" font-size="${s.fontSize}" font-family="Inter,sans-serif">${escSvg(s.label)}</text>` : ''}
</g>`;
        }
        case 'arrow': {
            const x2 = s.x2 ?? s.x + s.width;
            const y2 = s.y2 ?? s.y + s.height;
            return `<g>
  <line x1="${s.x}" y1="${s.y}" x2="${x2}" y2="${y2}" stroke="${s.stroke}" stroke-width="${sw}" marker-end="url(#arrowhead)" ${selAttr}/>
</g>`;
        }
        case 'line': {
            const x2 = s.x2 ?? s.x + s.width;
            const y2 = s.y2 ?? s.y + s.height;
            return `<g>
  <line x1="${s.x}" y1="${s.y}" x2="${x2}" y2="${y2}" stroke="${s.stroke}" stroke-width="${sw}" ${selAttr}/>
</g>`;
        }
        case 'text':
            return `<g>
  <text x="${s.x}" y="${s.y + s.fontSize}" font-size="${s.fontSize}" fill="${s.stroke}" font-family="Inter,sans-serif" ${selAttr}>${escSvg(s.label || 'Текст')}</text>
</g>`;
        default:
            return '';
    }
}

function escSvg(str: string): string {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function buildSvg(shapes: Shape[]): { svg: string; width: number; height: number } {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const s of shapes) {
        const x2 = s.type === 'arrow' || s.type === 'line' ? (s.x2 ?? s.x + s.width) : s.x + s.width;
        const y2 = s.type === 'arrow' || s.type === 'line' ? (s.y2 ?? s.y + s.height) : s.y + s.height;
        minX = Math.min(minX, s.x, x2);
        minY = Math.min(minY, s.y, y2);
        maxX = Math.max(maxX, s.x, x2);
        maxY = Math.max(maxY, s.y, y2);
    }
    if (shapes.length === 0) { minX = 0; minY = 0; maxX = 800; maxY = 600; }
    const pad = 24;
    const W = maxX - minX + pad * 2;
    const H = maxY - minY + pad * 2;
    const tx = pad - minX;
    const ty = pad - minY;

    const shapesHtml = shapes.map(s => renderShapeSvg(s, false)).join('\n');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}px" height="${H}px" viewBox="0 0 ${W} ${H}">
  <defs>
    <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
      <polygon points="0 0, 10 3.5, 0 7" fill="${DEFAULT_STROKE}"/>
    </marker>
  </defs>
  <rect width="${W}" height="${H}" fill="transparent"/>
  <g transform="translate(${tx},${ty})">${shapesHtml}</g>
</svg>`;
    return { svg, width: Math.round(W), height: Math.round(H) };
}

// ── Main Editor Component ──────────────────────────────────────────────────
export const DiagramEditor: React.FC<DiagramEditorProps> = ({ onSave, onClose }) => {
    const canvasRef = useRef<SVGSVGElement>(null);
    const [shapes, setShapes] = useState<Shape[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [tool, setTool] = useState<Tool>('rect');
    const [fillColor, setFillColor] = useState(DEFAULT_FILL);
    const [strokeColor, setStrokeColor] = useState(DEFAULT_STROKE);
    const [strokeWidth, setStrokeWidth] = useState(2);
    const [fontSize, _setFontSize] = useState(14);
    const [editingLabel, setEditingLabel] = useState<{id: string; value: string} | null>(null);
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
    const dragging = useRef<{ type: 'shape' | 'draw' | 'pan'; shapeId?: string; start: Point; shapStart?: Point; panStart?: Point } | null>(null);
    const [drawingShape, setDrawingShape] = useState<Shape | null>(null);
    const [history, setHistory] = useState<Shape[][]>([[]]);
    const [histIndex, setHistIndex] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);

    // Load from initialData (SVG — try to restore or just show it)
    useEffect(() => {
        // Start blank if no initial data or can't parse
        setShapes([]);
    }, []);

    // Push to history
    const pushHistory = useCallback((next: Shape[]) => {
        setHistory(prev => {
            const truncated = prev.slice(0, histIndex + 1);
            return [...truncated, next];
        });
        setHistIndex(prev => prev + 1);
        setShapes(next);
    }, [histIndex]);

    const undo = useCallback(() => {
        if (histIndex <= 0) return;
        const ni = histIndex - 1;
        setHistIndex(ni);
        setShapes(history[ni]);
    }, [histIndex, history]);

    const redo = useCallback(() => {
        if (histIndex >= history.length - 1) return;
        const ni = histIndex + 1;
        setHistIndex(ni);
        setShapes(history[ni]);
    }, [histIndex, history]);

    const selected = shapes.find(s => s.id === selectedId) || null;

    // SVG coordinate from mouse event
    const svgCoord = useCallback((e: React.MouseEvent): Point => {
        const rect = canvasRef.current!.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left - pan.x) / zoom,
            y: (e.clientY - rect.top - pan.y) / zoom,
        };
    }, [pan, zoom]);

    const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
        if (editingLabel) return;
        e.preventDefault();

        // middle mouse or space+drag = pan
        if (e.button === 1 || (e.button === 0 && e.altKey)) {
            dragging.current = { type: 'pan', start: { x: e.clientX, y: e.clientY }, panStart: { ...pan } };
            return;
        }

        if (tool === 'select') {
            // Hit test
            const pt = svgCoord(e);
            const hit = [...shapes].reverse().find(s => {
                if (s.type === 'arrow' || s.type === 'line') return false;
                return pt.x >= s.x && pt.x <= s.x + s.width && pt.y >= s.y && pt.y <= s.y + s.height;
            });
            if (hit) {
                setSelectedId(hit.id);
                dragging.current = { type: 'shape', shapeId: hit.id, start: pt, shapStart: { x: hit.x, y: hit.y } };
            } else {
                setSelectedId(null);
            }
            return;
        }

        // Drawing new shape
        const pt = svgCoord(e);
        const newShape: Shape = {
            id: newId(),
            type: tool as any,
            x: pt.x, y: pt.y,
            width: 0, height: 0,
            label: tool === 'text' ? 'Текст' : '',
            fill: tool === 'text' ? 'transparent' : fillColor,
            stroke: strokeColor,
            strokeWidth,
            fontSize,
            x2: pt.x, y2: pt.y,
        };
        setDrawingShape(newShape);
        dragging.current = { type: 'draw', start: pt };
    }, [tool, shapes, svgCoord, fillColor, strokeColor, strokeWidth, fontSize, editingLabel, pan]);

    const handleCanvasMouseMove = useCallback((e: React.MouseEvent) => {
        if (!dragging.current) return;
        const d = dragging.current;

        if (d.type === 'pan' && d.panStart) {
            const dx = e.clientX - d.start.x;
            const dy = e.clientY - d.start.y;
            setPan({ x: d.panStart.x + dx, y: d.panStart.y + dy });
            return;
        }

        if (d.type === 'shape' && d.shapeId && d.shapStart) {
            const pt = svgCoord(e);
            const dx = pt.x - d.start.x;
            const dy = pt.y - d.start.y;
            setShapes(prev => prev.map(s => s.id === d.shapeId ? { ...s, x: d.shapStart!.x + dx, y: d.shapStart!.y + dy } : s));
            return;
        }

        if (d.type === 'draw' && drawingShape) {
            const pt = svgCoord(e);
            const dx = pt.x - d.start.x;
            const dy = pt.y - d.start.y;
            if (drawingShape.type === 'arrow' || drawingShape.type === 'line') {
                setDrawingShape(prev => prev ? { ...prev, x2: pt.x, y2: pt.y } : null);
            } else {
                setDrawingShape(prev => prev ? {
                    ...prev,
                    x: dx < 0 ? pt.x : d.start.x,
                    y: dy < 0 ? pt.y : d.start.y,
                    width: Math.abs(dx),
                    height: Math.abs(dy),
                } : null);
            }
        }
    }, [svgCoord, drawingShape]);

    const handleCanvasMouseUp = useCallback(() => {
        if (dragging.current?.type === 'shape') {
            // Commit moved shape
            pushHistory([...shapes]);
        }
        if (dragging.current?.type === 'draw' && drawingShape) {
            const s = drawingShape;
            const isValid = (s.type === 'arrow' || s.type === 'line')
                ? (Math.abs((s.x2 ?? 0) - s.x) > 5 || Math.abs((s.y2 ?? 0) - s.y) > 5)
                : (s.width > 5 && s.height > 5) || s.type === 'text';

            if (isValid) {
                const finalShape = s.type === 'text' ? { ...s, width: 120, height: 30 } : s;
                const next = [...shapes, finalShape];
                pushHistory(next);
                setSelectedId(finalShape.id);
                setTool('select');
            }
            setDrawingShape(null);
        }
        dragging.current = null;
    }, [shapes, drawingShape, pushHistory]);

    const handleDoubleClick = useCallback((e: React.MouseEvent) => {
        if (tool !== 'select') return;
        const pt = svgCoord(e);
        const hit = [...shapes].reverse().find(s => {
            if (s.type === 'arrow' || s.type === 'line') return false;
            return pt.x >= s.x && pt.x <= s.x + s.width && pt.y >= s.y && pt.y <= s.y + s.height;
        });
        if (hit) {
            setEditingLabel({ id: hit.id, value: hit.label });
        }
    }, [tool, shapes, svgCoord]);

    const commitLabel = useCallback(() => {
        if (!editingLabel) return;
        const next = shapes.map(s => s.id === editingLabel.id ? { ...s, label: editingLabel.value } : s);
        pushHistory(next);
        setEditingLabel(null);
    }, [editingLabel, shapes, pushHistory]);

    const deleteSelected = useCallback(() => {
        if (!selectedId) return;
        pushHistory(shapes.filter(s => s.id !== selectedId));
        setSelectedId(null);
    }, [selectedId, shapes, pushHistory]);

    const handleSave = useCallback(() => {
        const { svg, width, height } = buildSvg(shapes);
        onSave({ svg, width, height });
    }, [shapes, onSave]);

    // Keyboard shortcuts
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (editingLabel) return;
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); }
            if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); redo(); }
            if (e.key === 'Delete' || e.key === 'Backspace') deleteSelected();
            if (e.key === 's' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleSave(); }
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [undo, redo, deleteSelected, handleSave, onClose, editingLabel]);

    // Build SVG content
    const allShapes = drawingShape ? [...shapes, drawingShape] : shapes;
    const shapesHtml = allShapes.map(s => renderShapeSvg(s, s.id === selectedId)).join('');

    // Canvas logical size constants (unused but kept for reference)
    // const CANVAS_W = 2000;
    // const CANVAS_H = 1500;

    const TOOLS: { id: Tool; label: string; icon: string }[] = [
        { id: 'select', label: 'Выбор (V)', icon: 'M4 4l7 18 3-7 7-3z' },
        { id: 'rect', label: 'Прямоугольник (R)', icon: 'M3 3h18v18H3z' },
        { id: 'ellipse', label: 'Эллипс (E)', icon: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z' },
        { id: 'diamond', label: 'Ромб (D)', icon: 'M12 2L22 12 12 22 2 12z' },
        { id: 'arrow', label: 'Стрелка (A)', icon: 'M5 12h14m-7-7 7 7-7 7' },
        { id: 'line', label: 'Линия (L)', icon: 'M5 19L19 5' },
        { id: 'text', label: 'Текст (T)', icon: 'M4 6h16M4 12h10M4 18h12' },
    ];

    return (
        <div className="diagram-editor-overlay" style={{ background: 'var(--background-primary)' }}>
            <div className="diagram-editor-modal">
                {/* ── Header ── */}
                <div className="diagram-editor-header">
                    <div className="diagram-editor-title">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>
                        </svg>
                        Редактор диаграмм
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#6c7086' }}>
                        <span>Ctrl+Z отменить · Del удалить · Dbl-click изменить текст</span>
                    </div>
                    <div className="diagram-editor-actions">
                        <button className="diagram-btn diagram-btn-cancel" onClick={onClose}>Отмена</button>
                        <button className="diagram-btn diagram-btn-save" onClick={handleSave}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ pointerEvents: 'none' }}>
                                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
                            </svg>
                            Сохранить
                        </button>
                    </div>
                </div>

                {/* ── Body ── */}
                <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
                    {/* Left Toolbar */}
                    <div style={{ width: 56, background: 'var(--background-secondary)', borderRight: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 0', gap: 4 }}>
                        {TOOLS.map(t => (
                            <button
                                key={t.id}
                                title={t.label}
                                onClick={() => setTool(t.id)}
                                style={{
                                    width: 40, height: 40,
                                    border: 'none',
                                    borderRadius: 8,
                                    background: tool === t.id ? 'rgba(137,180,250,0.2)' : 'transparent',
                                    color: tool === t.id ? 'var(--interactive-accent)' : 'var(--text-muted)',
                                    cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    transition: 'all 0.15s',
                                }}
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                    <path d={t.icon}/>
                                </svg>
                            </button>
                        ))}

                        <div style={{ width: 32, height: 1, background: 'rgba(255,255,255,0.07)', margin: '8px 0' }}/>

                        {/* Undo */}
                        <button title="Отменить (Ctrl+Z)" onClick={undo} style={{ width: 40, height: 40, border: 'none', borderRadius: 8, background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>
                        </button>
                        {/* Redo */}
                        <button title="Повторить (Ctrl+Y)" onClick={redo} style={{ width: 40, height: 40, border: 'none', borderRadius: 8, background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13"/></svg>
                        </button>
                        {/* Delete */}
                        <button title="Удалить (Del)" onClick={deleteSelected} style={{ width: 40, height: 40, border: 'none', borderRadius: 8, background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                        </button>
                    </div>

                    {/* Canvas */}
                    <div
                        ref={containerRef}
                        style={{ flex: 1, overflow: 'hidden', background: 'var(--background-primary)', position: 'relative', cursor: tool === 'select' ? 'default' : 'crosshair' }}
                        onMouseDown={handleCanvasMouseDown}
                        onMouseMove={handleCanvasMouseMove}
                        onMouseUp={handleCanvasMouseUp}
                        onMouseLeave={handleCanvasMouseUp}
                        onDoubleClick={handleDoubleClick}
                        onWheel={e => {
                            e.preventDefault();
                            const factor = e.deltaY > 0 ? 0.9 : 1.1;
                            setZoom(z => Math.max(0.2, Math.min(3, z * factor)));
                        }}
                    >
                        {/* Grid */}
                        <svg
                            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
                        >
                            <defs>
                                <pattern id="grid" width={20 * zoom} height={20 * zoom} patternUnits="userSpaceOnUse" x={pan.x % (20 * zoom)} y={pan.y % (20 * zoom)}>
                                    <path d={`M ${20 * zoom} 0 L 0 0 0 ${20 * zoom}`} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1"/>
                                </pattern>
                            </defs>
                            <rect width="100%" height="100%" fill="url(#grid)"/>
                        </svg>

                        {/* Main SVG canvas */}
                        <svg
                            ref={canvasRef}
                            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', userSelect: 'none' }}
                        >
                            <defs>
                                <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                                    <polygon points="0 0, 10 3.5, 0 7" fill={DEFAULT_STROKE}/>
                                </marker>
                            </defs>
                            <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}
                               dangerouslySetInnerHTML={{ __html: shapesHtml }}
                            />
                        </svg>

                        {/* Zoom indicator */}
                        <div style={{ position: 'absolute', bottom: 12, right: 12, background: 'var(--background-secondary)', backdropFilter: 'blur(4px)', borderRadius: 6, padding: '4px 10px', fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 8, alignItems: 'center', border: '1px solid var(--border-subtle)' }}>
                            <button onClick={() => setZoom(z => Math.max(0.2, z - 0.1))} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 0 }}>−</button>
                            {Math.round(zoom * 100)}%
                            <button onClick={() => setZoom(z => Math.min(3, z + 0.1))} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 0 }}>+</button>
                            <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 11, padding: 0 }}>сброс</button>
                        </div>

                        {/* Label edit overlay */}
                        {editingLabel && (() => {
                            const s = shapes.find(sh => sh.id === editingLabel.id);
                            if (!s) return null;
                            const ex = s.x * zoom + pan.x;
                            const ey = s.y * zoom + pan.y;
                            const ew = s.width * zoom;
                            const eh = s.height * zoom;
                            return (
                                <div style={{ position: 'absolute', left: ex, top: ey, width: ew, height: eh, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
                                    <input
                                        autoFocus
                                        value={editingLabel.value}
                                        onChange={e2 => setEditingLabel(prev => prev ? { ...prev, value: e2.target.value } : null)}
                                        onBlur={commitLabel}
                                        onKeyDown={e2 => { if (e2.key === 'Enter' || e2.key === 'Escape') commitLabel(); }}
                                        style={{ width: '90%', background: 'var(--background-secondary)', border: '1px solid var(--interactive-accent)', borderRadius: 4, color: 'var(--text-normal)', fontSize: s.fontSize * zoom, textAlign: 'center', padding: '2px 4px', outline: 'none' }}
                                    />
                                </div>
                            );
                        })()}
                    </div>

                    {/* Right Properties Panel */}
                    <div style={{ width: 200, background: 'var(--background-secondary)', borderLeft: '1px solid var(--border-subtle)', overflowY: 'auto', padding: '12px' }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Свойства</div>

                        {selected ? (
                            <>
                                <PropRow label="Заливка">
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                        {FILL_COLORS.map(c => (
                                            <button key={c} onClick={() => {
                                                const next = shapes.map(s => s.id === selectedId ? { ...s, fill: c } : s);
                                                pushHistory(next);
                                            }} style={{ width: 20, height: 20, borderRadius: 4, border: selected.fill === c ? '2px solid var(--interactive-accent)' : '2px solid transparent', background: c === 'transparent' ? 'none' : c, cursor: 'pointer', outline: c === 'transparent' ? '1px dashed var(--text-muted)' : 'none' }}/>
                                        ))}
                                    </div>
                                </PropRow>
                                <PropRow label="Контур">
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                        {STROKE_COLORS.map(c => (
                                            <button key={c} onClick={() => {
                                                const next = shapes.map(s => s.id === selectedId ? { ...s, stroke: c } : s);
                                                pushHistory(next);
                                            }} style={{ width: 20, height: 20, borderRadius: 4, border: selected.stroke === c ? '2px solid #fff' : '2px solid transparent', background: c, cursor: 'pointer' }}/>
                                        ))}
                                    </div>
                                </PropRow>
                                <PropRow label="Толщина">
                                    <input type="range" min={1} max={8} value={selected.strokeWidth} onChange={e => {
                                        const next = shapes.map(s => s.id === selectedId ? { ...s, strokeWidth: +e.target.value } : s);
                                        setShapes(next);
                                    }} onMouseUp={() => pushHistory(shapes)} style={{ width: '100%', accentColor: 'var(--interactive-accent)' }}/>
                                </PropRow>
                                <PropRow label="Шрифт">
                                    <input type="range" min={10} max={32} value={selected.fontSize} onChange={e => {
                                        const next = shapes.map(s => s.id === selectedId ? { ...s, fontSize: +e.target.value } : s);
                                        setShapes(next);
                                    }} onMouseUp={() => pushHistory(shapes)} style={{ width: '100%', accentColor: '#89b4fa' }}/>
                                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{selected.fontSize}px</span>
                                </PropRow>
                                <PropRow label="Текст">
                                    <input
                                        value={selected.label}
                                        onChange={e => setShapes(prev => prev.map(s => s.id === selectedId ? { ...s, label: e.target.value } : s))}
                                        onBlur={() => pushHistory(shapes)}
                                        style={{ width: '100%', background: 'var(--background-primary)', border: '1px solid var(--border-subtle)', borderRadius: 6, color: 'var(--text-normal)', fontSize: 12, padding: '4px 8px', outline: 'none' }}
                                    />
                                </PropRow>
                            </>
                        ) : (
                            <>
                                <PropRow label="Заливка">
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                        {FILL_COLORS.map(c => (
                                            <button key={c} onClick={() => setFillColor(c)} style={{ width: 20, height: 20, borderRadius: 4, border: fillColor === c ? '2px solid var(--interactive-accent)' : '2px solid transparent', background: c === 'transparent' ? 'none' : c, cursor: 'pointer', outline: c === 'transparent' ? '1px dashed var(--text-muted)' : 'none' }}/>
                                        ))}
                                    </div>
                                </PropRow>
                                <PropRow label="Контур">
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                        {STROKE_COLORS.map(c => (
                                            <button key={c} onClick={() => setStrokeColor(c)} style={{ width: 20, height: 20, borderRadius: 4, border: strokeColor === c ? '2px solid #fff' : '2px solid transparent', background: c, cursor: 'pointer' }}/>
                                        ))}
                                    </div>
                                </PropRow>
                                <PropRow label="Толщина">
                                    <input type="range" min={1} max={8} value={strokeWidth} onChange={e => setStrokeWidth(+e.target.value)} style={{ width: '100%', accentColor: 'var(--interactive-accent)' }}/>
                                </PropRow>
                            </>
                        )}

                        <div style={{ marginTop: 16, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.7 }}>
                            <div><b style={{ color: 'var(--text-normal)' }}>Ctrl+Z</b> — отменить</div>
                            <div><b style={{ color: 'var(--text-normal)' }}>Del</b> — удалить</div>
                            <div><b style={{ color: 'var(--text-normal)' }}>Dbl-click</b> — текст</div>
                            <div><b style={{ color: 'var(--text-normal)' }}>Alt+drag</b> — панорама</div>
                            <div><b style={{ color: 'var(--text-normal)' }}>Колесо</b> — зум</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

function PropRow({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>{label}</div>
            {children}
        </div>
    );
}
