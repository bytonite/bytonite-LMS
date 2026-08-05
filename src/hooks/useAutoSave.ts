import { useEffect, useRef } from 'react';
import { cleanHTML, htmlToMarkdown } from '../utils/htmlToMarkdown';

export interface AutoSaveOptions {
    content: string;
    filePath: string;
    designMode: boolean;
    editableRef: React.RefObject<HTMLDivElement>;
    onAutoSave?: (content: string) => void;
    onSelectBlocks?: (blocks: HTMLElement[]) => void;
    selectedBlocks?: HTMLElement[];
}

export function useAutoSave({ content, filePath, designMode, editableRef, onAutoSave, onSelectBlocks, selectedBlocks }: AutoSaveOptions) {
    const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
    const mutationObserverRef = useRef<MutationObserver | null>(null);
    const lastSavedContentRef = useRef<string | null>(null);
    const historyRef = useRef<string[]>([]);
    const historyIndexRef = useRef<number>(-1);

    // Initialize history when entering design mode or changing files
    useEffect(() => {
        if (designMode && content) {
            historyRef.current = [content];
            historyIndexRef.current = 0;
        }
    }, [designMode, filePath]);

    // Keyboard shortcuts for Undo/Redo and Delete
    useEffect(() => {
        if (!designMode) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if typing in an input or textarea
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

            const isCtrl = e.ctrlKey || e.metaKey;
            
            // Delete key
            if (e.key === 'Delete' && selectedBlocks && selectedBlocks.length > 0) {
                // If user is editing text (Caret is active), we still delete the block since they explicitly selected it.
                e.preventDefault();
                e.stopPropagation();
                
                selectedBlocks.forEach(b => b.remove());
                if (onSelectBlocks) onSelectBlocks([]);
                // MutationObserver will catch the removal and trigger autoSave
                return;
            }

            // Undo (Ctrl+Z)
            if (isCtrl && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                e.stopPropagation();
                if (historyIndexRef.current > 0) {
                    historyIndexRef.current -= 1;
                    const undoneContent = historyRef.current[historyIndexRef.current];
                    lastSavedContentRef.current = null; // Force DOM sync
                    if (onAutoSave) onAutoSave(undoneContent);
                }
                return;
            }

            // Redo (Ctrl+Y)
            if (isCtrl && e.key.toLowerCase() === 'y') {
                e.preventDefault();
                e.stopPropagation();
                if (historyIndexRef.current < historyRef.current.length - 1) {
                    historyIndexRef.current += 1;
                    const redoneContent = historyRef.current[historyIndexRef.current];
                    lastSavedContentRef.current = null; // Force DOM sync
                    if (onAutoSave) onAutoSave(redoneContent);
                }
                return;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [designMode, selectedBlocks, onAutoSave, onSelectBlocks]);

    // Auto-save on DOM mutations in Design Mode
    useEffect(() => {
        if (!designMode || !editableRef.current || !onAutoSave) {
            // Cleanup observer if exiting design mode
            if (mutationObserverRef.current) {
                mutationObserverRef.current.disconnect();
                mutationObserverRef.current = null;
            }
            return;
        }

        const triggerAutoSave = () => {
            // Clear existing timer
            if (autoSaveTimerRef.current) {
                clearTimeout(autoSaveTimerRef.current);
            }

            // Debounce: save after 1.5 seconds of inactivity
            autoSaveTimerRef.current = setTimeout(() => {
                if (editableRef.current && onAutoSave) {
                    const html = cleanHTML(editableRef.current);
                    const markdown = htmlToMarkdown(html);
                    
                    // Add to History
                    if (historyRef.current[historyIndexRef.current] !== markdown) {
                        const newHistory = historyRef.current.slice(0, historyIndexRef.current + 1);
                        newHistory.push(markdown);
                        historyRef.current = newHistory;
                        historyIndexRef.current = newHistory.length - 1;
                    }

                    lastSavedContentRef.current = markdown;
                    onAutoSave(markdown);
                }
            }, 1500);
        };

        // Setup MutationObserver
        mutationObserverRef.current = new MutationObserver((mutations) => {
            // Ignore if the mutation only consists of class changes (e.g., selection highlight)
            const isOnlyClassMutation = mutations.every(m => m.type === 'attributes' && m.attributeName === 'class');
            if (isOnlyClassMutation) return;

            triggerAutoSave();
        });

        mutationObserverRef.current.observe(editableRef.current, {
            childList: true,
            subtree: true,
            characterData: true,
            attributes: true
        });

        return () => {
            if (autoSaveTimerRef.current) {
                clearTimeout(autoSaveTimerRef.current);
            }
            if (mutationObserverRef.current) {
                mutationObserverRef.current.disconnect();
                mutationObserverRef.current = null;
            }
        };
    }, [designMode, onAutoSave, editableRef]);

    return { lastSavedContentRef };
}
