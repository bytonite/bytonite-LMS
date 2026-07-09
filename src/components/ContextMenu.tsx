import { useEffect, useRef } from 'react';

interface ContextMenuProps {
    x: number;
    y: number;
    onClose: () => void;
    onNewFile: () => void;
    onNewFolder: () => void;
    onDelete?: () => void;
    onRename?: () => void;
    isDirectory: boolean;
    onTogglePin?: () => void;
    isPinned?: boolean;
}

export default function ContextMenu({ x, y, onClose, onNewFile, onNewFolder, onDelete, onRename, isDirectory, onTogglePin, isPinned }: ContextMenuProps) {
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [onClose]);

    return (
        <div
            ref={menuRef}
            className="context-menu"
            style={{
                position: 'fixed',
                left: x,
                top: y,
                backgroundColor: 'var(--background-secondary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '4px',
                padding: '4px 0',
                minWidth: '180px',
                zIndex: 1000,
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
            }}
        >
            {isDirectory && (
                <>
                    <div className="menu-item" onClick={() => { onNewFile(); onClose(); }}>
                        📄 Новый файл
                    </div>
                    <div className="menu-item" onClick={() => { onNewFolder(); onClose(); }}>
                        📁 Новая папка
                    </div>
                </>
            )}
            {!isDirectory && onTogglePin && (
                <div className="menu-item" onClick={() => { onTogglePin(); onClose(); }}>
                    {isPinned ? '🚫 Открепить' : '📌 Закрепить'}
                </div>
            )}
            {onRename && (
                <div className="menu-item" onClick={() => { onRename(); onClose(); }}>
                    ✏️ Переименовать
                </div>
            )}
            {onDelete && (
                <>
                    <div style={{ height: '1px', backgroundColor: 'var(--border-subtle)', margin: '4px 0' }} />
                    <div className="menu-item menu-item-danger" onClick={() => { onDelete(); onClose(); }}>
                        🗑️ Удалить
                    </div>
                </>
            )}
        </div>
    );
}
