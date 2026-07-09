import { useState, useEffect, useRef } from 'react';

interface PinModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (pin: string) => boolean;
    purpose?: 'edit' | 'fileOps';
}

// Uncontrolled input version to prevent any state update blocking
export default function PinModal({ isOpen, onClose, onSubmit, purpose = 'edit' }: PinModalProps) {
    const [error, setError] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setError(false);
            if (inputRef.current) inputRef.current.value = '';
            
            // Force focus repeatedly to ensure it grabs it after Native Dialogs
            const timers = [
                setTimeout(() => inputRef.current?.focus(), 50),
                setTimeout(() => inputRef.current?.focus(), 200),
                setTimeout(() => inputRef.current?.focus(), 500)
            ];
            return () => timers.forEach(clearTimeout);
        }
    }, [isOpen]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const enteredPin = inputRef.current?.value || '';
        const success = onSubmit(enteredPin);
        if (!success) {
            setError(true);
            inputRef.current?.select();
        }
    };

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed',
            top: 0, 
            left: 0,
            right: 0, 
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
        }} onClick={() => { inputRef.current?.focus(); }}>
            <div style={{
                backgroundColor: 'var(--background-secondary)',
                padding: '24px',
                borderRadius: '8px',
                width: '300px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                pointerEvents: 'auto'
            }} onClick={e => e.stopPropagation()}>
                <h3 style={{ marginTop: 0, marginBottom: '16px', color: 'var(--text-normal)' }}>
                    {purpose === 'edit' ? 'Введите код доступа' : 'Подтвердите действие'}
                </h3>
                <form onSubmit={handleSubmit}>
                    <input
                        ref={inputRef}
                        type="password"
                        autoFocus
                        placeholder="PIN"
                        onKeyDown={e => e.stopPropagation()} 
                        style={{
                            width: '100%',
                            padding: '12px',
                            marginBottom: error ? '8px' : '16px',
                            borderRadius: '4px',
                            border: error ? '2px solid #ef4444' : '1px solid var(--border-subtle)',
                            background: '#ffffff', // Force white background
                            color: '#000000',      // Force black text
                            fontSize: '18px',
                            fontWeight: 'bold',
                            outline: 'none',
                            caretColor: 'black'
                        }}
                    />
                    {error && (
                        <div style={{ color: '#ef4444', fontSize: '12px', marginBottom: '16px', fontWeight: 'bold' }}>
                            Неверный код доступа (Попробуйте 1566015)
                        </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                        <button 
                            type="button" 
                            onClick={onClose}
                            style={{
                                padding: '8px 16px',
                                borderRadius: '4px',
                                border: '1px solid var(--border-subtle)',
                                background: 'transparent',
                                color: 'var(--text-muted)',
                                cursor: 'pointer'
                            }}
                        >
                            Отмена
                        </button>
                        <button 
                            type="submit"
                            style={{
                                padding: '8px 16px',
                                borderRadius: '4px',
                                border: 'none',
                                background: 'var(--interactive-accent)',
                                color: 'white',
                                cursor: 'pointer',
                                fontWeight: 'bold'
                            }}
                        >
                            Войти
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
