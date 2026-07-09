import { useState } from 'react';

interface StatusBarProps {
    wordCount: number;
    charCount: number;
    line: number;
    column: number;
    contentWidth: number;
    onWidthChange: (width: number) => void;
}

export default function StatusBar({ wordCount, charCount, line, column, contentWidth, onWidthChange }: StatusBarProps) {
    const [isHovered, setIsHovered] = useState(false);

    // Presets for quick width selection
    const presets = [
        { label: 'S', value: 600, title: 'Узкий (600px)' },
        { label: 'M', value: 900, title: 'Средний (900px)' },
        { label: 'L', value: 1200, title: 'Широкий (1200px)' },
        { label: '∞', value: 1600, title: 'Во всю ширину' },
    ];

    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -50 : 50;
        const newValue = Math.min(1600, Math.max(400, contentWidth + delta));
        onWidthChange(newValue);
    };

    return (
        <div style={{
            height: '24px',
            backgroundColor: 'var(--background-secondary)',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            padding: '0 10px',
            fontSize: '11px',
            color: 'var(--text-muted)',
            gap: '16px',
            userSelect: 'none'
        }}>
            <div>{wordCount} слов</div>
            <div>{charCount} символов</div>
            
            {/* Width Control Section */}
            <div 
                style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '6px', 
                    marginLeft: '20px',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    backgroundColor: isHovered ? 'rgba(255,255,255,0.05)' : 'transparent',
                    transition: 'background-color 0.2s'
                }} 
                title="Ширина контента (прокрутка для изменения)"
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                onWheel={handleWheel}
            >
                {/* Preset Buttons */}
                <div style={{ display: 'flex', gap: '2px' }}>
                    {presets.map(p => (
                        <button
                            key={p.value}
                            title={p.title}
                            onClick={() => onWidthChange(p.value)}
                            style={{
                                width: '18px',
                                height: '16px',
                                fontSize: '9px',
                                fontWeight: contentWidth === p.value ? 600 : 400,
                                border: 'none',
                                borderRadius: '3px',
                                cursor: 'pointer',
                                backgroundColor: contentWidth === p.value 
                                    ? 'var(--interactive-accent)' 
                                    : 'rgba(255,255,255,0.1)',
                                color: contentWidth === p.value 
                                    ? 'white' 
                                    : 'var(--text-muted)',
                                transition: 'all 0.15s ease',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>

                {/* Slider */}
                <input 
                    type="range" 
                    min="400" 
                    max="1600" 
                    step="10"
                    value={contentWidth}
                    onChange={(e) => onWidthChange(Number(e.target.value))}
                    style={{ 
                        width: '60px', 
                        height: '14px',
                        accentColor: 'var(--interactive-accent)',
                        cursor: 'ew-resize'
                    }}
                />

                {/* Value Display */}
                <span style={{ 
                    minWidth: '42px', 
                    textAlign: 'right',
                    fontFamily: 'monospace',
                    fontSize: '10px'
                }}>
                    {contentWidth >= 1600 ? '100%' : `${contentWidth}px`}
                </span>
            </div>

            <div style={{ marginLeft: 'auto' }}>Ln {line}, Col {column}</div>
        </div>
    );
}
