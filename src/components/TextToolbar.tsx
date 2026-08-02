import React, { useEffect, useState } from 'react';
import { Bold, Italic, Underline, Type, Highlighter } from 'lucide-react';

interface TextToolbarProps {
    containerRef: React.RefObject<HTMLElement>;
    onUpdate?: () => void;
    designMode: boolean;
}

export default function TextToolbar({ containerRef, onUpdate, designMode }: TextToolbarProps) {
    const [selectionRect, setSelectionRect] = useState<DOMRect | null>(null);
    const [savedRange, setSavedRange] = useState<Range | null>(null);
    const toolbarRef = React.useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!designMode) {
            setSelectionRect(null);
            setSavedRange(null);
            return;
        }

        const handleSelectionChange = () => {
            const selection = window.getSelection();
            if (selection) {
                // If the selection moved into our toolbar (e.g. a select box), keep it open
                if (toolbarRef.current && toolbarRef.current.contains(selection.anchorNode)) {
                    return;
                }
                
                if (!selection.isCollapsed && selection.rangeCount > 0) {
                    const range = selection.getRangeAt(0);
                    if (containerRef.current && containerRef.current.contains(range.commonAncestorContainer)) {
                        // Check if it's inside an editable text area
                        const rect = range.getBoundingClientRect();
                        if (rect.width > 0) {
                            setSelectionRect(rect);
                            setSavedRange(range);
                            return;
                        }
                    }
                }
            }
            setSelectionRect(null);
            // Don't clear savedRange immediately in case they click on the toolbar
        };

        document.addEventListener('selectionchange', handleSelectionChange);
        return () => document.removeEventListener('selectionchange', handleSelectionChange);
    }, [containerRef, designMode]);

    if (!selectionRect) return null;

    const restoreSelection = () => {
        const sel = window.getSelection();
        if (sel && savedRange) {
            sel.removeAllRanges();
            sel.addRange(savedRange);
        }
    };

    const handleFormat = (e: React.MouseEvent, command: string, value?: string) => {
        e.preventDefault(); // keep focus
        restoreSelection();
        document.execCommand('styleWithCSS', false, 'true');
        document.execCommand(command, false, value);
        if (onUpdate) onUpdate();
    };

    const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        restoreSelection();
        document.execCommand('styleWithCSS', false, 'true');
        document.execCommand('foreColor', false, e.target.value);
        if (onUpdate) onUpdate();
    };
    
    const handleFontSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        restoreSelection();
        document.execCommand('styleWithCSS', false, 'true');
        document.execCommand('fontSize', false, e.target.value);
        if (onUpdate) onUpdate();
    };

    const handleBgColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        restoreSelection();
        document.execCommand('styleWithCSS', false, 'true');
        document.execCommand('hiliteColor', false, e.target.value);
        if (onUpdate) onUpdate();
    };

    return (
        <div 
            ref={toolbarRef}
            className="text-toolbar"
            style={{
                position: 'fixed',
                top: selectionRect.top - 46,
                left: selectionRect.left + selectionRect.width / 2,
                transform: 'translateX(-50%)',
                backgroundColor: 'var(--background-secondary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                zIndex: 10000,
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            }}
        >
            <button 
                onMouseDown={(e) => handleFormat(e, 'bold')}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '6px', borderRadius: '4px', color: 'var(--text-normal)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                title="Bold"
            >
                <Bold size={16} />
            </button>
            <button 
                onMouseDown={(e) => handleFormat(e, 'italic')}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '6px', borderRadius: '4px', color: 'var(--text-normal)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                title="Italic"
            >
                <Italic size={16} />
            </button>
            <button 
                onMouseDown={(e) => handleFormat(e, 'underline')}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '6px', borderRadius: '4px', color: 'var(--text-normal)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                title="Underline"
            >
                <Underline size={16} />
            </button>
            <div style={{ width: '1px', height: '20px', backgroundColor: 'var(--border-subtle)', margin: '0 4px' }} />
            
            <select 
                onChange={handleFontSizeChange}
                style={{
                    background: 'transparent',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-normal)',
                    borderRadius: '4px',
                    padding: '2px 4px',
                    fontSize: '12px',
                    cursor: 'pointer',
                    outline: 'none'
                }}
                defaultValue=""
                title="Font Size"
            >
                <option value="" disabled>Size</option>
                <option value="1">10px</option>
                <option value="2">13px</option>
                <option value="3">16px</option>
                <option value="4">18px</option>
                <option value="5">24px</option>
                <option value="6">32px</option>
                <option value="7">48px</option>
            </select>
            <div style={{ width: '1px', height: '20px', backgroundColor: 'var(--border-subtle)', margin: '0 4px' }} />

            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', padding: '6px', cursor: 'pointer' }} title="Text Color">
                <Type size={16} style={{ color: 'var(--text-normal)' }} />
                <input 
                    type="color" 
                    onChange={handleColorChange}
                    style={{
                        position: 'absolute',
                        opacity: 0,
                        width: '100%',
                        height: '100%',
                        cursor: 'pointer',
                        left: 0,
                        top: 0
                    }}
                />
            </div>

            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', padding: '6px', cursor: 'pointer' }} title="Highlight Color">
                <Highlighter size={16} style={{ color: 'var(--text-normal)' }} />
                <input 
                    type="color" 
                    onChange={handleBgColorChange}
                    style={{
                        position: 'absolute',
                        opacity: 0,
                        width: '100%',
                        height: '100%',
                        cursor: 'pointer',
                        left: 0,
                        top: 0
                    }}
                />
            </div>
        </div>
    );
}
