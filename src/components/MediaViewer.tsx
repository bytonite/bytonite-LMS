import { ZoomIn, ZoomOut, RotateCw, Maximize2, Info } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

interface VideoMetadata {
  duration: number;
  width?: number;
  height?: number;
}

interface MediaViewerProps {
    filePath: string;
    fileName: string;
}

export default function MediaViewer({ filePath, fileName }: MediaViewerProps) {
    const [scale, setScale] = useState(1);
    const [rotation, setRotation] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [showMetadata, setShowMetadata] = useState(false);
    const [videoMetadata, setVideoMetadata] = useState<VideoMetadata | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Determine if it's a video or image
    const isVideo = /\.(mp4|webm|ogv|mkv|mov|avi)$/i.test(filePath);
    
    // Create proper file:// URL
    const fileUrl = `file:///${filePath.replace(/\\/g, '/')}`;

    const handleZoomIn = () => setScale(s => Math.min(s + 0.25, 5));
    const handleZoomOut = () => setScale(s => Math.max(s - 0.25, 0.25));
    const handleRotate = () => setRotation(r => (r + 90) % 360);
    const handleReset = () => {
        setScale(1);
        setRotation(0);
        setPosition({ x: 0, y: 0 });
    };

    const handleWheel = (e: React.WheelEvent) => {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -0.1 : 0.1;
            setScale(s => Math.max(0.25, Math.min(5, s + delta)));
        }
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.button === 0 && !isVideo) {
            setIsDragging(true);
            setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isDragging) {
            setPosition({
                x: e.clientX - dragStart.x,
                y: e.clientY - dragStart.y
            });
        }
    };
    
    const handleMouseUp = () => setIsDragging(false);

    const handleOpenExternal = async () => {
        try {
            await window.electronAPI.openExternal(filePath);
        } catch (e) {
            console.error('Failed to open externally:', e);
        }
    };

    const analyzeVideo = async () => {
        if (!videoRef.current) return;
        
        const video = videoRef.current;
        
        // Wait for metadata to load
        const loadMetadata = () => new Promise<void>((resolve) => {
            if (video.readyState >= 1) {
                resolve();
            } else {
                video.addEventListener('loadedmetadata', () => resolve(), { once: true });
            }
        });
        
        await loadMetadata();
        
        setVideoMetadata({
            duration: video.duration,
            width: video.videoWidth,
            height: video.videoHeight
        });
        
        setShowMetadata(true);
    };

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === '+' || e.key === '=') handleZoomIn();
            if (e.key === '-') handleZoomOut();
            if (e.key === 'r' || e.key === 'к') handleRotate();
            if (e.key === '0') handleReset();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    return (
        <div 
            ref={containerRef}
            style={{
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                width: '100%',
                backgroundColor: 'var(--background-primary)',
                overflow: 'hidden'
            }}
        >
            {/* Toolbar */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                borderBottom: '1px solid var(--border-subtle)',
                backgroundColor: 'var(--background-secondary)',
                flexShrink: 0
            }}>
                <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '12px',
                    color: 'var(--text-normal)',
                    fontWeight: 500
                }}>
                    <span>{fileName}</span>
                    <span style={{ 
                        fontSize: '12px', 
                        color: 'var(--text-muted)',
                        background: 'var(--background-primary)',
                        padding: '2px 8px',
                        borderRadius: '4px'
                    }}>
                        {Math.round(scale * 100)}%
                    </span>
                </div>
                
                <div style={{ display: 'flex', gap: '4px' }}>
                    {isVideo && (
                        <button 
                            onClick={analyzeVideo}
                            title="Анализ видеоконтейнера"
                            style={toolbarButtonStyle}
                        >
                            <Info size={18} />
                        </button>
                    )}
                    {!isVideo && (
                        <>
                            <button 
                                onClick={handleZoomOut}
                                title="Уменьшить (-)"
                                style={toolbarButtonStyle}
                            >
                                <ZoomOut size={18} />
                            </button>
                            <button 
                                onClick={handleZoomIn}
                                title="Увеличить (+)"
                                style={toolbarButtonStyle}
                            >
                                <ZoomIn size={18} />
                            </button>
                            <button 
                                onClick={handleRotate}
                                title="Повернуть (R)"
                                style={toolbarButtonStyle}
                            >
                                <RotateCw size={18} />
                            </button>
                            <div style={{ width: '1px', background: 'var(--border-subtle)', margin: '0 8px' }} />
                        </>
                    )}
                    <button 
                        onClick={handleOpenExternal}
                        title="Открыть в системном приложении"
                        style={toolbarButtonStyle}
                    >
                        <Maximize2 size={18} />
                    </button>
                </div>
            </div>

            {/* Media Container */}
            <div 
                style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    cursor: isDragging ? 'grabbing' : (isVideo ? 'default' : 'grab'),
                    backgroundColor: '#1a1a1a'
                }}
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
            >
                {isVideo ? (
                    <video 
                        ref={videoRef}
                        src={fileUrl}
                        controls
                        autoPlay
                        style={{
                            maxWidth: '100%',
                            maxHeight: '100%',
                            objectFit: 'contain'
                        }}
                    />
                ) : (
                    <img
                        src={fileUrl}
                        alt={fileName}
                        draggable={false}
                        style={{
                            transform: `translate(${position.x}px, ${position.y}px) scale(${scale}) rotate(${rotation}deg)`,
                            transition: isDragging ? 'none' : 'transform 0.15s ease',
                            maxWidth: scale <= 1 ? '100%' : 'none',
                            maxHeight: scale <= 1 ? '100%' : 'none',
                            objectFit: 'contain',
                            userSelect: 'none'
                        }}
                    />
                )}
            </div>

            {/* Footer info */}
            <div style={{
                padding: '8px 16px',
                borderTop: '1px solid var(--border-subtle)',
                backgroundColor: 'var(--background-secondary)',
                fontSize: '12px',
                color: 'var(--text-muted)',
                display: 'flex',
                justifyContent: 'space-between',
                flexShrink: 0
            }}>
                <span>
                    {isVideo ? '🎬 Видео' : '🖼️ Изображение'}
                </span>
                <span style={{ opacity: 0.7 }}>
                    {!isVideo && 'Колесико мыши + Ctrl для масштаба • Перетаскивайте для перемещения'}
                </span>
            </div>

            {/* Metadata Modal */}
            {showMetadata && videoMetadata && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 9999
                }} onClick={() => setShowMetadata(false)}>
                    <div style={{
                        backgroundColor: 'var(--background-primary)',
                        borderRadius: '8px',
                        padding: '20px',
                        maxWidth: '600px',
                        maxHeight: '80vh',
                        overflow: 'auto',
                        border: '1px solid var(--border-subtle)'
                    }} onClick={e => e.stopPropagation()}>
                        <h2 style={{ marginBottom: '16px', color: 'var(--text-normal)' }}>📊 Метаданные видеоконтейнера</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div><strong>Длительность:</strong> {Math.round(videoMetadata.duration)} секунд</div>
                            {videoMetadata.width && videoMetadata.height && (
                                <div><strong>Разрешение:</strong> {videoMetadata.width}x{videoMetadata.height}</div>
                            )}
                        </div>
                        <button 
                            onClick={() => setShowMetadata(false)}
                            style={{
                                marginTop: '20px',
                                padding: '10px 20px',
                                backgroundColor: 'var(--interactive-accent)',
                                border: 'none',
                                borderRadius: '4px',
                                color: 'white',
                                cursor: 'pointer',
                            }}
                        >
                            Закрыть
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

const toolbarButtonStyle: React.CSSProperties = {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: '6px',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.15s ease'
};
