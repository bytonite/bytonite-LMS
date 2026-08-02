
import React, { useState, useEffect, useRef } from 'react';
import { Layout, Columns, Code, FileText, GripVertical, Calendar, Zap, CheckSquare, Image as ImageIcon } from 'lucide-react';
import { templates, Template } from '../data/templates';

interface TemplateSidebarProps {
    visible: boolean;
    rootPath: string | null;
}

const iconMap: Record<string, any> = {
    'Layout': Layout,
    'Columns': Columns,
    'Code': Code,
    'FileText': FileText,
    'Calendar': Calendar,
    'Zap': Zap,
    'CheckSquare': CheckSquare,
    'Image': ImageIcon
};

export default function TemplateSidebar({ visible, rootPath }: TemplateSidebarProps) {
    const [localTemplates, setLocalTemplates] = useState<Template[]>(templates);
    const [isDragOver, setIsDragOver] = useState(false);
    const [width, setWidth] = useState(250);
    const [isResizing, setIsResizing] = useState(false);
    const sidebarRef = useRef<HTMLDivElement>(null);

    // Resizing logic
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing || !sidebarRef.current) return;
            const sidebarRect = sidebarRef.current.getBoundingClientRect();
            const newWidth = e.clientX - sidebarRect.left;
            setWidth(Math.max(200, Math.min(800, newWidth)));
        };

        const handleMouseUp = () => {
            setIsResizing(false);
        };

        if (isResizing) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing]);

    // Load custom templates from workspace
    React.useEffect(() => {
        if (!rootPath || !window.electronAPI) return;
        const customTemplatesPath = `${rootPath}/.custom_blocks.json`;
        window.electronAPI.readFile(customTemplatesPath)
            .then(content => {
                if (content) {
                    try {
                        const parsed = JSON.parse(content);
                        setLocalTemplates([...parsed, ...templates]);
                    } catch (e) {
                        console.error('Failed to parse custom blocks:', e);
                    }
                }
            })
            .catch(() => {
                // File doesn't exist yet, that's fine
            });
    }, [rootPath]);

    if (!visible) return null;

    const handleDragStart = (e: React.DragEvent, template: Template) => {
        e.dataTransfer.setData('text/plain', template.content);
        e.dataTransfer.effectAllowed = 'copy';
        
        // Store content globally for "Ghost Preview" in dragOver (since dataTransfer is protected)
        (window as any).__draggingTemplateContent = template.content;
        
        // Optional: Custom drag image
        const div = document.createElement('div');
        div.textContent = template.name;
        div.style.backgroundColor = '#448aff';
        div.style.color = 'white';
        div.style.padding = '5px 10px';
        div.style.borderRadius = '4px';
        div.style.position = 'absolute';
        div.style.top = '-1000px';
        document.body.appendChild(div);
        e.dataTransfer.setDragImage(div, 0, 0);
        setTimeout(() => document.body.removeChild(div), 0);
    };

    const handleDragOver = (e: React.DragEvent) => {
        if (e.dataTransfer.types.includes('application/x-editor-block')) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            setIsDragOver(true);
        }
    };

    const handleDragLeave = () => {
        setIsDragOver(false);
    };

    const handleDrop = async (e: React.DragEvent) => {
        setIsDragOver(false);
        if (e.dataTransfer.types.includes('application/x-editor-block')) {
            e.preventDefault();
            const html = e.dataTransfer.getData('text/html');
            if (html) {
                try {
                    // Create a dummy element to clean up the HTML
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = html;
                    
                    const traverse = (el: HTMLElement) => {
                        el.removeAttribute('draggable');
                        el.removeAttribute('contenteditable');
                        el.removeAttribute('spellcheck');
                        el.removeAttribute('data-collapsible'); 
                        el.removeAttribute('data-sourcepos');
                        el.classList.remove('sortable-dragging', 'sortable-drop-target', 'draggable-block', 'draggable-hover', 'cell-drop-active', 'row-drop-active', 'live-highlight', 'resizable', 'resizing');
                        if (el.classList.length === 0) el.removeAttribute('class');
                        el.style.cursor = '';
                        el.style.outline = '';
                        el.style.opacity = '';
                        el.removeAttribute('node');
                        if (el.getAttribute('style') === '') el.removeAttribute('style');
                        Array.from(el.children).forEach(child => traverse(child as HTMLElement));
                    };
                    
                    tempDiv.querySelectorAll('.code-block-header').forEach(h => h.remove());
                    tempDiv.querySelectorAll('.resize-handle').forEach(h => h.remove());
                    
                    Array.from(tempDiv.children).forEach(child => traverse(child as HTMLElement));

                    const layoutElements = tempDiv.querySelectorAll('.grid-cell, .dashboard-grid, .flex-row, .flex-col');
                    layoutElements.forEach(el => {
                        const htmlContent = el.innerHTML.trim();
                        if (htmlContent === '' || htmlContent === '&#8203;') {
                            el.innerHTML = '<br class="empty-cell-placeholder" style="display:none" />';
                        }
                    });

                    const cleanHtml = tempDiv.innerHTML;
                    
                    // Lazy load Turndown
                    const TurndownService = (await import('turndown')).default;
                    const turndownService = new TurndownService({
                        headingStyle: 'atx',
                        codeBlockStyle: 'fenced',
                        emDelimiter: '*'
                    });
                    turndownService.keep(['div', 'span', 'table', 'tbody', 'tr', 'td', 'th', 'font', 'video', 'br'] as any);

                    const markdown = turndownService.turndown(cleanHtml);

                    const newTemplate: Template = {
                        id: 'custom-' + Date.now(),
                        name: 'Свой блок',
                        description: 'Пользовательский шаблон',
                        icon: 'Layout',
                        content: markdown
                    };
                    
                    setLocalTemplates(prev => {
                        const newTemplates = [newTemplate, ...prev];
                        // Save custom ones to workspace
                        const customOnly = newTemplates.filter(t => t.id.startsWith('custom-'));
                        if (rootPath && window.electronAPI) {
                            window.electronAPI.writeFile(`${rootPath}/.custom_blocks.json`, JSON.stringify(customOnly, null, 2))
                                .catch(err => console.error('Failed to save templates to workspace', err));
                        }
                        return newTemplates;
                    });
                } catch (err) {
                    console.error('Failed to create template:', err);
                }
            }
        }
    };

    return (
        <div style={{ display: 'flex', height: '100%', flexShrink: 0 }}>
            <div 
                ref={sidebarRef}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                style={{
                    width: `${width}px`,
                    height: '100%',
                    backgroundColor: isDragOver ? 'rgba(68, 138, 255, 0.05)' : 'var(--background-secondary)',
                    display: 'flex',
                    flexDirection: 'column',
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    transition: isResizing ? 'none' : 'background-color 0.2s ease'
                }}
            >
                <div style={{
                    padding: '10px 16px',
                    fontSize: '11px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    color: 'var(--text-muted)',
                    borderBottom: '1px solid var(--border-subtle)'
                }}>
                    Шаблоны (Drag & Drop)
                </div>
                
                <div style={{ 
                    padding: '8px', 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', 
                    gap: '8px',
                    alignContent: 'start'
                }}>
                    {localTemplates.map(template => {
                    const Icon = iconMap[template.icon] || FileText;
                    return (
                        <div
                            key={template.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, template)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                padding: '12px',
                                backgroundColor: 'var(--background-primary)',
                                border: '1px solid var(--border-subtle)',
                                borderRadius: '6px',
                                cursor: 'grab',
                                userSelect: 'none',
                                transition: 'all 0.2s ease'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.borderColor = 'var(--interactive-accent)';
                                e.currentTarget.style.transform = 'translateY(-1px)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.borderColor = 'var(--border-subtle)';
                                e.currentTarget.style.transform = 'none';
                            }}
                        >
                            <GripVertical size={16} style={{ color: 'var(--text-muted)' }} />
                            <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: '13px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Icon size={14} style={{ color: 'var(--interactive-accent)' }} />
                                    {template.name}
                                </div>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {template.description}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
            
            <div style={{ marginTop: 'auto', padding: '16px', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>
                {isDragOver ? 'Отпустите, чтобы сохранить шаблон' : 'Перетащите блок сюда для сохранения, или шаблон в редактор'}
            </div>
            </div>
            
            {/* Resizer Handle */}
            <div 
                onMouseDown={() => setIsResizing(true)}
                style={{
                    width: '4px',
                    cursor: 'col-resize',
                    backgroundColor: isResizing ? 'var(--interactive-accent)' : 'transparent',
                    borderRight: '1px solid var(--border-subtle)',
                    transition: 'background-color 0.2s',
                    zIndex: 10
                }}
                onMouseEnter={(e) => {
                    if (!isResizing) e.currentTarget.style.backgroundColor = 'var(--border-subtle)';
                }}
                onMouseLeave={(e) => {
                    if (!isResizing) e.currentTarget.style.backgroundColor = 'transparent';
                }}
            />
        </div>
    );
}
