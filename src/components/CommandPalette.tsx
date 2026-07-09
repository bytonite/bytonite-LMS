import { useState, useEffect, useRef } from 'react';
import { Search } from 'lucide-react';
import { getBasename } from '../utils/path';

interface CommandPaletteProps {
    isOpen: boolean;
    onClose: () => void;
    files: string[];
    onFileSelect: (path: string) => void;
    title?: string;
}

export default function CommandPalette({ isOpen, onClose, files, onFileSelect, title }: CommandPaletteProps) {
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);

    const filteredFiles = files.filter(file => 
        file.toLowerCase().includes(query.toLowerCase())
    ).slice(0, 10);

    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    useEffect(() => {
        setSelectedIndex(0);
    }, [query]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(i => Math.min(i + 1, filteredFiles.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(i => Math.max(i - 1, 0));
        } else if (e.key === 'Enter' && filteredFiles[selectedIndex]) {
            onFileSelect(filteredFiles[selectedIndex]);
            onClose();
        } else if (e.key === 'Escape') {
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div 
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.7)',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'center',
                paddingTop: '100px',
                zIndex: 2000
            }}
            onClick={onClose}
        >
            <div 
                style={{
                    backgroundColor: 'var(--background-secondary)',
                    borderRadius: '8px',
                    width: '600px',
                    maxHeight: '400px',
                    overflow: 'hidden',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
                }}
                onClick={e => e.stopPropagation()}
            >
                <div style={{ padding: '16px', borderBottom: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Search size={20} style={{ opacity: 0.5 }} />
                        <input
                            ref={inputRef}
                            type="text"
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={title || "Поиск файлов..."}
                            style={{
                                flex: 1,
                                background: 'transparent',
                                border: 'none',
                                outline: 'none',
                                color: 'var(--text-normal)',
                                fontSize: '16px'
                            }}
                        />
                    </div>
                </div>
                <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
                    {filteredFiles.length === 0 ? (
                        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                            Файлы не найдены
                        </div>
                    ) : (
                        filteredFiles.map((file, index) => (
                            <div
                                key={file}
                                onClick={() => { onFileSelect(file); onClose(); }}
                                style={{
                                    padding: '12px 16px',
                                    cursor: 'pointer',
                                    backgroundColor: index === selectedIndex ? 'var(--interactive-accent)' : 'transparent',
                                    transition: 'background-color 0.1s'
                                }}
                            >
                                {getBasename(file)}
                                <div style={{ fontSize: '12px', opacity: 0.6, marginTop: '2px' }}>
                                    {file}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
