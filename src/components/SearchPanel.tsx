import { useState, useEffect, useRef } from 'react';
import { Search } from 'lucide-react';

interface SearchResult {
    path: string;
    matches: string[];
}

interface SearchPanelProps {
    rootPath: string;
    onFileSelect: (path: string) => void;
    externalQuery?: string;
    onQueryChange?: (query: string) => void;
}

export default function SearchPanel({ rootPath, onFileSelect, externalQuery, onQueryChange }: SearchPanelProps) {
    const [internalQuery, setInternalQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [error, setError] = useState<string>('');
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const query = externalQuery !== undefined ? externalQuery : internalQuery;
    const setQuery = onQueryChange || setInternalQuery;

    // Real-time search with debounce
    useEffect(() => {
        // Clear previous timer
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }

        // Don't search if query is too short
        if (query.length < 2) {
            setResults([]);
            setError('');
            return;
        }

        // Set new timer - search after 300ms of no typing
        debounceRef.current = setTimeout(() => {
            handleSearch(query);
        }, 300);

        // Cleanup on unmount or query change
        return () => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }
        };
    }, [query, rootPath]);

    const handleSearch = async (searchQuery: string) => {
        if (searchQuery.length < 2) {
            return;
        }
        
        setIsSearching(true);
        setError('');
        
        try {
            const searchResults = await window.electronAPI.searchFiles(rootPath, searchQuery);
            
            // Filter out ignored directories in case the backend hasn't been restarted with the new logic
            const filteredResults = searchResults.filter((r: any) => {
                const normalizedPath = r.path.replace(/\\/g, '/').toLowerCase();
                return !normalizedPath.includes('/node_modules/') && 
                       !normalizedPath.includes('/.git/') && 
                       !normalizedPath.includes('/dist/') && 
                       !normalizedPath.includes('/build/') &&
                       !normalizedPath.includes('/.vscode/');
            });
            
            setResults(filteredResults);
            if (filteredResults.length === 0) {
                setError('Ничего не найдено');
            }
        } catch (error) {
            console.error('Search error:', error);
            setError('Ошибка поиска: ' + (error as Error).message);
        }
        setIsSearching(false);
    };

    return (
        <div style={{ padding: '10px', borderTop: '1px solid var(--border-subtle)' }}>
            <div style={{ fontWeight: 'bold', marginBottom: 10 }}>ПОИСК</div>
            <div style={{ display: 'flex', gap: '4px', marginBottom: '10px' }}>
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch(query)}
                    placeholder="Поиск в заметках..."
                    style={{
                        flex: 1,
                        background: 'var(--background-primary)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '4px',
                        padding: '6px 8px',
                        color: 'var(--text-normal)',
                        fontSize: '13px',
                        outline: 'none'
                    }}
                />
                <button
                    onClick={() => handleSearch(query)}
                    disabled={isSearching}
                    style={{
                        background: 'var(--interactive-accent)',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '6px 12px',
                        color: 'white',
                        cursor: 'pointer',
                        fontSize: '13px'
                    }}
                >
                    <Search size={14} />
                </button>
            </div>
            
            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {isSearching && (
                    <div style={{ 
                        color: 'var(--text-muted)', 
                        fontSize: '13px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px'
                    }}>
                        <div style={{
                            width: '14px',
                            height: '14px',
                            border: '2px solid var(--interactive-accent)',
                            borderTopColor: 'transparent',
                            borderRadius: '50%',
                            animation: 'spin 1s linear infinite'
                        }} />
                        Поиск...
                    </div>
                )}
                {error && <div style={{ color: '#f87171', fontSize: '13px', padding: '10px' }}>{error}</div>}
                {!isSearching && !error && results.length === 0 && query.length >= 2 && (
                    <div style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '10px' }}>
                        Ничего не найдено по запросу "{query}"
                    </div>
                )}
                {!isSearching && query.length < 2 && query.length > 0 && (
                    <div style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '10px' }}>
                        Введите минимум 2 символа
                    </div>
                )}
                {results.map((result, idx) => {
                    const fileName = result.path.split(/[/\\]/).pop() || '';
                    const ext = fileName.includes('.') ? fileName.split('.').pop()?.toLowerCase() : '';
                    
                    // File type colors
                    const extColors: Record<string, { bg: string; text: string }> = {
                        'md': { bg: '#3b82f6', text: '#fff' },
                        'txt': { bg: '#6b7280', text: '#fff' },
                        'json': { bg: '#f59e0b', text: '#000' },
                        'html': { bg: '#ef4444', text: '#fff' },
                        'css': { bg: '#06b6d4', text: '#fff' },
                        'js': { bg: '#eab308', text: '#000' },
                        'ts': { bg: '#3178c6', text: '#fff' },
                        'tsx': { bg: '#3178c6', text: '#fff' },
                        'py': { bg: '#3776ab', text: '#fff' },
                    };
                    const extStyle = extColors[ext || ''] || { bg: '#4b5563', text: '#fff' };
                    
                    return (
                        <div
                            key={idx}
                            onClick={() => onFileSelect(result.path)}
                            style={{
                                padding: '10px 12px',
                                marginBottom: '6px',
                                background: 'rgba(255,255,255,0.03)',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontSize: '13px',
                                border: '1px solid transparent',
                                transition: 'all 0.15s ease'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                                e.currentTarget.style.borderColor = 'var(--interactive-accent)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                                e.currentTarget.style.borderColor = 'transparent';
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                {/* File extension badge */}
                                <span style={{
                                    background: extStyle.bg,
                                    color: extStyle.text,
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    fontSize: '10px',
                                    fontWeight: 'bold',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.5px'
                                }}>
                                    {ext || 'FILE'}
                                </span>
                                {/* File name */}
                                <span style={{ fontWeight: '600', color: 'var(--text-normal)' }}>
                                    {fileName.replace(`.${ext}`, '')}
                                </span>
                            </div>

                            {/* Render text snippets (matches) */}
                            {result.matches && result.matches.length > 0 && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                                    {result.matches.map((match: string, mIdx: number) => (
                                        <div key={mIdx} style={{
                                            fontSize: '11px',
                                            color: 'var(--text-muted)',
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            background: 'rgba(0,0,0,0.2)',
                                            padding: '2px 6px',
                                            borderRadius: '4px'
                                        }}>
                                            {match}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
            <style>{`
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}
