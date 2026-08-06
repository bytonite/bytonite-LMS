import { useEffect, useState } from 'react';
import { 
    AlignLeft, AlignCenter, AlignRight, Type, Layout, Maximize, 
    PaintBucket, Bold, Italic, Underline, Trash2, Ban, GitPullRequest
} from 'lucide-react';
import './PropertiesPanel.css';

interface PropertiesPanelProps {
    blocks: HTMLElement[];
    onUpdate: () => void;
    onBlockDelete: () => void;
    onEditDiagram?: (block: HTMLElement) => void;
}

export default function PropertiesPanel({ blocks, onUpdate, onBlockDelete, onEditDiagram }: PropertiesPanelProps) {
    const block = blocks.length > 0 ? blocks[0] : null;
    const [styles, setStyles] = useState<CSSStyleDeclaration | null>(null);
    const [editTarget, setEditTarget] = useState<'container' | 'content'>('container');

    const isCallout = block?.classList.contains('callout') || !!block?.querySelector('.callout');
    const isDiagramCallout = block?.classList.contains('callout-diagram') || !!block?.querySelector('.callout-diagram');
    const mermaidWrapper = block?.classList.contains('mermaid-diagram-wrapper') ? block : block?.querySelector('.mermaid-diagram-wrapper');
    const isMermaid = !!mermaidWrapper;

    // Reset target when block changes
    useEffect(() => {
        setEditTarget('container');
    }, [block]);

    // Helper to determine which elements to target
    const getActiveElements = () => {
        if (editTarget === 'content') {
            return blocks.map(b => b.classList.contains('callout') ? b.querySelector('.callout-content') as HTMLElement : null).filter(Boolean) as HTMLElement[];
        }
        return blocks;
    };

    const getActiveElement = () => getActiveElements()[0] || null;

    // Refresh styles when block changes or on update
    const refreshStyles = () => {
        const target = getActiveElement();
        if (target) {
            setStyles(window.getComputedStyle(target));
        }
    };

    useEffect(() => {
        refreshStyles();
    }, [block, editTarget]);

    const updateStyle = (property: any, value: string) => {
        const targets = getActiveElements();
        if (targets.length === 0) return;
        targets.forEach(t => {
            if (t) t.style[property] = value;
        });
        refreshStyles();
        onUpdate();
    };

    const toggleStyle = (property: any, value: string, defaultValue: string = '') => {
        const targets = getActiveElements();
        if (targets.length === 0) return;
        
        // Use the first target's style to determine toggle state
        const current = targets[0].style[property];
        const newValue = current === value ? defaultValue : value;
        
        targets.forEach(t => {
            if (t) t.style[property] = newValue;
        });
        refreshStyles();
        onUpdate();
    };

    const getSafeStyle = (prop: string) => {
        const target = getActiveElement();
        return target ? target.style[prop as any] : '';
    };

    const getComputedValue = (prop: string) => {
        const target = getActiveElement();
        if (!target) return '';
        const computed = window.getComputedStyle(target);
        return computed[prop as any];
    };

    const handleDimensionChange = (prop: 'width' | 'height' | 'padding' | 'margin' | 'borderWidth' | 'borderRadius' | 'fontSize', val: string) => {
        if (val && !isNaN(Number(val))) updateStyle(prop, val + 'px');
        else updateStyle(prop, val);
    };

    const handleDelete = () => {
        if (blocks.length > 0) {
             if (confirm(`Are you sure you want to delete ${blocks.length > 1 ? 'these blocks' : 'this block'}?`)) {
                 blocks.forEach(b => b.remove());
                 onBlockDelete();
             }
        }
    };

    if (!block || !styles) return (
        <div className="properties-panel empty">
            <div className="panel-hint">Select a block to edit properties</div>
        </div>
    );

    return (
        <aside className="properties-panel">
            <div className="panel-header">
                <h3>Properties {blocks.length > 1 ? `(${blocks.length})` : ''}</h3>
                <span className="tag-name">{blocks.length > 1 ? 'Multiple Elements' : block.tagName.toLowerCase()}{isCallout && blocks.length === 1 ? ' (callout)' : ''}</span>
            </div>

            {/* TARGET SELECTOR */}
            {isCallout && (
                <div className="panel-section target-selector-section">
                    <div className="btn-group full-width">
                        <button 
                            className={editTarget === 'container' ? 'active' : ''} 
                            onClick={() => setEditTarget('container')}
                            style={{flex: 1}}
                        >
                            Box (Container)
                        </button>
                        <button 
                            className={editTarget === 'content' ? 'active' : ''} 
                            onClick={() => setEditTarget('content')}
                            style={{flex: 1}}
                        >
                            Content Body
                        </button>
                    </div>
                </div>
            )}

            {/* DIAGRAM EDIT BUTTON */}
            {isDiagramCallout && onEditDiagram && block && (
                <div className="panel-section">
                    <button
                        onClick={() => onEditDiagram(block)}
                        style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            padding: '10px 16px',
                            background: 'linear-gradient(135deg, #89b4fa, #cba6f7)',
                            color: '#1e1e2e',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '13px',
                            fontWeight: 600,
                            cursor: 'pointer',
                        }}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                        Изменить диаграмму
                    </button>
                </div>
            )}

            {/* LAYOUT */}
            <div className="panel-section" key={`layout-${editTarget}`}>
                <h4><Layout size={14} /> Layout <span style={{fontSize:'10px', opacity:0.5}}>({editTarget})</span></h4>
                <div className="control-group">
                    <label>Display</label>
                    <select 
                        value={getSafeStyle('display') || getComputedValue('display')} 
                        onChange={(e) => updateStyle('display', e.target.value)}
                    >
                        <option value="block">Block</option>
                        <option value="flex">Flex</option>
                        <option value="grid">Grid</option>
                        <option value="inline-block">Inline Block</option>
                        <option value="none">Hidden</option>
                    </select>
                </div>
                {(getSafeStyle('display') === 'flex' || getComputedValue('display') === 'flex') && (
                    <div className="input-row">
                        <div className="control-group">
                            <label>Dir</label>
                            <select 
                                value={getSafeStyle('flexDirection') || getComputedValue('flexDirection')} 
                                onChange={(e) => updateStyle('flexDirection', e.target.value)}
                            >
                                <option value="row">Row</option>
                                <option value="column">Col</option>
                            </select>
                        </div>
                        <div className="control-group">
                            <label>Align</label>
                            <select 
                                value={getSafeStyle('alignItems') || getComputedValue('alignItems')} 
                                onChange={(e) => updateStyle('alignItems', e.target.value)}
                            >
                                <option value="stretch">Stretch</option>
                                <option value="center">Center</option>
                                <option value="flex-start">Start</option>
                                <option value="flex-end">End</option>
                            </select>
                        </div>
                         <div className="control-group">
                            <label>Justify</label>
                            <select 
                                value={getSafeStyle('justifyContent') || getComputedValue('justifyContent')} 
                                onChange={(e) => updateStyle('justifyContent', e.target.value)}
                            >
                                <option value="flex-start">Start</option>
                                <option value="center">Center</option>
                                <option value="flex-end">End</option>
                                <option value="space-between">Space Btwn</option>
                            </select>
                        </div>
                    </div>
                )}
                 {editTarget === 'content' && (
                     <div className="control-group">
                        <label>Gap</label>
                        <input 
                            type="text" 
                            placeholder="0px"
                            defaultValue={getSafeStyle('gap')}
                            onBlur={(e) => updateStyle('gap', e.target.value)}
                        />
                    </div>
                 )}
            </div>

            {/* DIMENSIONS */}
            <div className="panel-section">
                <h4><Maximize size={14} /> Size</h4>
                <div className="input-row" key={`size-${editTarget}`}>
                    <div className="control-group">
                        <label>Width</label>
                        <input 
                            type="text" 
                            placeholder="auto"
                            defaultValue={getSafeStyle('width') || getComputedValue('width')}
                            onBlur={(e) => handleDimensionChange('width', e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleDimensionChange('width', e.currentTarget.value)}
                        />
                    </div>
                    <div className="control-group">
                        <label>Height</label>
                        <input 
                            type="text" 
                            placeholder="auto"
                            defaultValue={getSafeStyle('height') || getComputedValue('height')}
                            onBlur={(e) => handleDimensionChange('height', e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleDimensionChange('height', e.currentTarget.value)}
                        />
                    </div>
                </div>
                <div className="input-row" key={`spacing-${editTarget}`}>
                    <div className="control-group">
                        <label>Padding</label>
                        <input 
                            type="text" 
                            placeholder="0px"
                            defaultValue={getSafeStyle('padding') || getComputedValue('padding')}
                            onBlur={(e) => handleDimensionChange('padding', e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleDimensionChange('padding', e.currentTarget.value)}
                        />
                    </div>
                    <div className="control-group">
                        <label>Margin</label>
                        <input 
                            type="text" 
                            placeholder="0px"
                            defaultValue={getSafeStyle('margin') || getComputedValue('margin')}
                            onBlur={(e) => handleDimensionChange('margin', e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleDimensionChange('margin', e.currentTarget.value)}
                        />
                    </div>
                </div>
            </div>

            {/* TYPOGRAPHY */}
            <div className="panel-section" key={`typography-${editTarget}`}>
                <h4><Type size={14} /> Typography</h4>
                <div className="control-group">
                    <div className="btn-group">
                        <button 
                            onClick={() => toggleStyle('fontWeight', 'bold', 'normal')} 
                            className={styles.fontWeight === '700' || styles.fontWeight === 'bold' ? 'active' : ''}
                            title="Bold"
                        >
                            <Bold size={14} />
                        </button>
                        <button 
                            onClick={() => toggleStyle('fontStyle', 'italic', 'normal')} 
                            className={styles.fontStyle === 'italic' ? 'active' : ''}
                            title="Italic"
                        >
                            <Italic size={14} />
                        </button>
                        <button 
                            onClick={() => toggleStyle('textDecoration', 'underline', 'none')} 
                            className={styles.textDecoration.includes('underline') ? 'active' : ''}
                            title="Underline"
                        >
                            <Underline size={14} />
                        </button>
                    </div>
                </div>
                <div className="control-group">
                    <div className="btn-group">
                        <button onClick={() => updateStyle('textAlign', 'left')} className={styles.textAlign === 'left' ? 'active' : ''}><AlignLeft size={14} /></button>
                        <button onClick={() => updateStyle('textAlign', 'center')} className={styles.textAlign === 'center' ? 'active' : ''}><AlignCenter size={14} /></button>
                        <button onClick={() => updateStyle('textAlign', 'right')} className={styles.textAlign === 'right' ? 'active' : ''}><AlignRight size={14} /></button>
                    </div>
                </div>
                <div className="input-row">
                    <div className="control-group">
                        <label>Color</label>
                        <div className="color-input-wrapper">
                            <input 
                                type="color" 
                                value={rgbToHex(styles.color)} 
                                onChange={(e) => updateStyle('color', e.target.value)}
                            />
                            <button 
                                className="transparent-btn" 
                                title="Прозрачный"
                                onClick={() => updateStyle('color', 'transparent')}
                            >
                                <Ban size={12} />
                            </button>
                        </div>
                    </div>
                    <div className="control-group">
                        <label>Size</label>
                        <input 
                            type="text" 
                            defaultValue={getSafeStyle('fontSize') || getComputedValue('fontSize')} 
                            onBlur={(e) => handleDimensionChange('fontSize', e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleDimensionChange('fontSize', e.currentTarget.value)}
                            placeholder="16px"
                        />
                    </div>
                </div>
            </div>

            {/* APPEARANCE */}
            <div className="panel-section" key={`appearance-${editTarget}`}>
                <h4><PaintBucket size={14} /> Appearance</h4>
                <div className="input-row">
                    <div className="control-group">
                        <label>Bg</label>
                        <div className="color-input-wrapper">
                            <input 
                                type="color" 
                                value={rgbToHex(styles.backgroundColor)} 
                                onChange={(e) => updateStyle('backgroundColor', e.target.value)}
                            />
                            <button 
                                className="transparent-btn" 
                                title="Прозрачный"
                                onClick={() => updateStyle('backgroundColor', 'transparent')}
                            >
                                <Ban size={12} />
                            </button>
                        </div>
                    </div>
                    <div className="control-group">
                        <label>Radius</label>
                        <input 
                            type="text" 
                            defaultValue={getSafeStyle('borderRadius') || getComputedValue('borderRadius')} 
                            onBlur={(e) => handleDimensionChange('borderRadius', e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleDimensionChange('borderRadius', e.currentTarget.value)}
                            placeholder="0px"
                        />
                    </div>
                </div>
                <div className="control-group" style={{ marginTop: '8px' }}>
                    <label>Border</label>
                    <div className="input-row" style={{ gap: '4px' }}>
                        <input 
                            type="text" style={{ width: '40px' }}
                            placeholder="1px"
                            defaultValue={getSafeStyle('borderWidth') || getComputedValue('borderWidth')}
                            onBlur={(e) => handleDimensionChange('borderWidth', e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleDimensionChange('borderWidth', e.currentTarget.value)}
                        />
                        <select 
                            style={{ flex: 1 }}
                            value={block.style.borderStyle || 'none'}
                            onChange={(e) => updateStyle('borderStyle', e.target.value)}
                        >
                            <option value="none">None</option>
                            <option value="solid">Solid</option>
                            <option value="dashed">Dashed</option>
                            <option value="dotted">Dotted</option>
                        </select>
                        <div className="color-input-wrapper" style={{ width: '45px', padding: '2px', display: 'flex', alignItems: 'center' }}>
                             <input 
                                type="color" 
                                value={rgbToHex(styles.borderColor)} 
                                onChange={(e) => updateStyle('borderColor', e.target.value)}
                                style={{ width: '20px' }}
                            />
                            <button 
                                className="transparent-btn" 
                                title="Прозрачный"
                                onClick={() => updateStyle('borderColor', 'transparent')}
                                style={{ padding: '0', marginLeft: '2px' }}
                            >
                                <Ban size={10} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* ACTIONS */}
            <div className="panel-section">
                {isMermaid && (
                    <button className="primary-btn full-width" onClick={() => {
                        if (!mermaidWrapper) return;
                        const code = mermaidWrapper.getAttribute('data-mermaid-code') || '';
                        if ((window as any).__openMermaidEditor) {
                            (window as any).__openMermaidEditor(code, (newCode: string) => {
                                mermaidWrapper.setAttribute('data-mermaid-code', newCode);
                                onUpdate();
                            });
                        }
                    }} style={{
                        width: '100%',
                        padding: '8px',
                        backgroundColor: 'var(--interactive-accent)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        marginBottom: '10px'
                    }}>
                        <GitPullRequest size={14} /> Edit Diagram
                    </button>
                )}
                
                <button className="danger-btn full-width" onClick={handleDelete} style={{
                    width: '100%',
                    padding: '8px',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    color: '#ef4444',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                }}>
                    <Trash2 size={14} /> Delete Block
                </button>
            </div>
        </aside>
    );
}

// Helper: RGB to Hex
function rgbToHex(rgb: string) {
    if (!rgb || rgb === 'transparent' || rgb === 'rgba(0, 0, 0, 0)') return '#ffffff';
    if (rgb.startsWith('#')) return rgb;
    try {
        const sep = rgb.indexOf(",") > -1 ? "," : " ";
        const res = rgb.substr(4).split(")")[0].split(sep);
        
        let r = (+res[0]).toString(16),
            g = (+res[1]).toString(16),
            b = (+res[2]).toString(16);
    
        if (r.length == 1) r = "0" + r;
        if (g.length == 1) g = "0" + g;
        if (b.length == 1) b = "0" + b;
    
        return "#" + r + g + b;
    } catch (e) {
        return '#000000';
    }
}
