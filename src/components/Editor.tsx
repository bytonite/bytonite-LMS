import { useRef, useEffect } from 'react';
import { EditorState, Compartment } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLineGutter, Decoration, DecorationSet, WidgetType, ViewPlugin, ViewUpdate, MatchDecorator } from '@codemirror/view';

import { history } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';
import { oneDark } from '@codemirror/theme-one-dark';
import { basicSetup } from 'codemirror';
import * as prettier from 'prettier/standalone';
import * as prettierPluginMarkdown from 'prettier/plugins/markdown';
import * as prettierPluginEstree from 'prettier/plugins/estree';
import * as prettierPluginBabel from 'prettier/plugins/babel';
import * as prettierPluginHtml from 'prettier/plugins/html';
import * as prettierPluginPostcss from 'prettier/plugins/postcss';


class MediaWidget extends WidgetType {
    constructor(readonly url: string, readonly type: 'image' | 'video') { super() }

    toDOM() {
        const wrap = document.createElement("div");
        wrap.className = "cm-media-widget";
        if (this.type === 'image') {
            const img = document.createElement("img");
            img.src = this.url;
            img.style.maxWidth = "100%";
            img.style.maxHeight = "400px";
            wrap.appendChild(img);
        } else {
            const video = document.createElement("video");
            video.src = this.url;
            video.controls = true;
            video.style.maxWidth = "100%";
            wrap.appendChild(video);
        }
        return wrap;
    }
}

const mediaMatcher = new MatchDecorator({
    regexp: /!\[.*?\]\((.*?)\)/g,
    decoration: (match) => {
        const url = match[1];
        const isVideo = url.match(/\.(mp4|webm|ogg)$/i);
        return Decoration.replace({
            widget: new MediaWidget(url, isVideo ? 'video' : 'image')
        })
    }
});

const mediaPlugin = ViewPlugin.fromClass(class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
        this.decorations = mediaMatcher.createDeco(view);
    }
    update(update: ViewUpdate) {
        this.decorations = mediaMatcher.updateDeco(update, this.decorations);
    }
}, {
    decorations: v => v.decorations
});

// Internal Links [[note]]
class InternalLinkWidget extends WidgetType {
    constructor(readonly linkText: string, readonly onNavigate: (link: string) => void) { super() }

    toDOM() {
        const span = document.createElement("span");
        span.textContent = `[[${this.linkText}]]`;
        span.style.color = "var(--interactive-accent)";
        span.style.cursor = "pointer";
        span.style.textDecoration = "underline";
        span.onclick = (e) => {
            e.preventDefault();
            this.onNavigate(this.linkText);
        };
        return span;
    }
}

const createInternalLinkPlugin = (onNavigate: (link: string) => void) => {
    const linkMatcher = new MatchDecorator({
        regexp: /\[\[([^\]]+)\]\]/g,
        decoration: (match) => {
            return Decoration.replace({
                widget: new InternalLinkWidget(match[1], onNavigate)
            })
        }
    });

    return ViewPlugin.fromClass(class {
        decorations: DecorationSet;
        constructor(view: EditorView) {
            this.decorations = linkMatcher.createDeco(view);
        }
        update(update: ViewUpdate) {
            this.decorations = linkMatcher.updateDeco(update, this.decorations);
        }
    }, {
        decorations: v => v.decorations
    });
};

const createTagPlugin = (onTagClick?: (tag: string) => void) => {
    const tagMatcher = new MatchDecorator({
        regexp: /#[\w\u0400-\u04FF-]+/g,
        decoration: (match) => Decoration.mark({
            class: "cm-hashtag",
            tagName: "span",
            attributes: { "data-tag": match[0] }
        })
    });

    return ViewPlugin.fromClass(
        class {
            decorations: DecorationSet;
            constructor(view: EditorView) {
                this.decorations = tagMatcher.createDeco(view);
            }
            update(update: ViewUpdate) {
                this.decorations = tagMatcher.updateDeco(update, this.decorations);
            }
        },
        {
            decorations: v => v.decorations,
            eventHandlers: {
                mousedown: (e, _view) => {
                    const target = e.target as HTMLElement;
                    if (target.classList.contains("cm-hashtag") && onTagClick) {
                        e.preventDefault();
                        onTagClick(target.getAttribute("data-tag") || "");
                    }
                }
            }
        }
    );
};


export interface EditorStats {
    words: number;
    chars: number;
    line: number;
    col: number;
}

interface EditorProps {
    content: string;
    onChange: (doc: string) => void;
    onNavigateLink?: (linkText: string) => void;
    onStatsUpdate?: (stats: EditorStats) => void;
    onTagClick?: (tag: string) => void;
    theme: 'dark' | 'light';
    activeSourcePos?: string | null;
    onSelectSourcePos?: (pos: string | null) => void;
}

export default function Editor({ content, onChange, onNavigateLink, onStatsUpdate, onTagClick, theme, activeSourcePos, onSelectSourcePos }: EditorProps) {
    const editorRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView>();
    const onChangeRef = useRef(onChange);
    const onStatsUpdateRef = useRef(onStatsUpdate);
    const themeCompartment = useRef(new Compartment());
    const isSyncingRef = useRef(false);

    // Keep refs updated
    useEffect(() => {
        onChangeRef.current = onChange;
        onStatsUpdateRef.current = onStatsUpdate;
    }, [onChange, onStatsUpdate]);

    const getThemeExtension = (currentTheme: 'dark' | 'light') => {
        const themeExtension = currentTheme === 'dark' ? oneDark : [];
        const caretColor = currentTheme === 'dark' ? 'white' : 'black';
        
        return [
            themeExtension,
            EditorView.theme({
                "&": { height: "100%", backgroundColor: "var(--background-primary)" },
                ".cm-content": { caretColor: caretColor }
            })
        ];
    };

    useEffect(() => {
        if (!editorRef.current) return;

        const handleFormat = (view: EditorView) => {
            const doc = view.state.doc.toString();
            let preProcessedDoc = doc;
            const videoBlocks: string[] = [];
            
            // Extract video tags to protect them from markdown parser which breaks multiline video tags
            preProcessedDoc = preProcessedDoc.replace(/<video[\s\S]*?<\/video>|<video[\s\S]*?\/>/gi, (match) => {
                videoBlocks.push(match);
                return `<!-- VIDEO_BLOCK_${videoBlocks.length - 1} -->`;
            });

            prettier.format(preProcessedDoc, {
                parser: "markdown",
                plugins: [prettierPluginMarkdown, prettierPluginEstree, prettierPluginBabel, prettierPluginHtml, prettierPluginPostcss],
                printWidth: 1000,
                bracketSameLine: true
            }).then(async formatted => {
                const blocks = formatted.split('\n\n');
                for (let i = 0; i < blocks.length; i++) {
                    const block = blocks[i].trim();
                    // Only format pure HTML blocks (starts and ends with the matching tag)
                    // This prevents formatting HTML that contains Markdown blank lines
                    if ((block.startsWith('<div') && block.endsWith('</div>')) || 
                        (block.startsWith('<span') && block.endsWith('</span>')) || 
                        (block.startsWith('<table') && block.endsWith('</table>'))) {
                        try {
                            const htmlFormatted = await prettier.format(block, {
                                parser: "html",
                                plugins: [prettierPluginHtml, prettierPluginMarkdown],
                                printWidth: 1000,
                                bracketSameLine: true
                            });
                            if (htmlFormatted) {
                                blocks[i] = htmlFormatted.trim();
                            }
                        } catch (e) {
                            // Silently ignore HTML parse errors
                        }
                    }
                }
                
                let finalFormatted = blocks.join('\n\n');
                
                // Restore and format video blocks
                for (let i = 0; i < videoBlocks.length; i++) {
                    let formattedVideo = videoBlocks[i];
                    try {
                        const htmlFormatted = await prettier.format(formattedVideo, {
                            parser: "html",
                            plugins: [prettierPluginHtml, prettierPluginMarkdown],
                            printWidth: 1000,
                            bracketSameLine: true
                        });
                        if (htmlFormatted) {
                            formattedVideo = htmlFormatted.trim();
                        }
                    } catch (e) {
                        // Keep original if formatting fails
                    }
                    finalFormatted = finalFormatted.replace(`<!-- VIDEO_BLOCK_${i} -->`, formattedVideo);
                }

                if (finalFormatted !== doc) {
                    view.dispatch({
                        changes: { from: 0, to: doc.length, insert: finalFormatted }
                    });
                }
            }).catch(console.error);
            return true;
        };

        const state = EditorState.create({
            doc: content,
            extensions: [
                lineNumbers(),
                highlightActiveLineGutter(),
                history(),
                basicSetup,
                EditorView.lineWrapping,
                syntaxHighlighting(defaultHighlightStyle, {fallback: true}),
                keymap.of([
                    { key: "Shift-Alt-f", run: handleFormat },
                    { key: "Shift-Alt-а", run: handleFormat },
                    { key: "Ctrl-s", run: handleFormat },
                    { key: "Ctrl-ы", run: handleFormat }
                ]),
                markdown({ base: markdownLanguage, codeLanguages: languages }),
                themeCompartment.current.of(getThemeExtension(theme)), // Initial Theme
                mediaPlugin,
                createTagPlugin(onTagClick),
                EditorView.editable.of(true), // Explicitly make editor editable

                onNavigateLink ? createInternalLinkPlugin(onNavigateLink) : [],
                EditorView.domEventHandlers({
                    drop(event, view) {
                        // 1. Handle Template Drag & Drop (Text)
                        const textData = event.dataTransfer?.getData('text/plain');
                        if (textData) {
                             event.preventDefault();
                             const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
                             if (pos !== null) {
                                 view.dispatch({
                                     changes: { from: pos, insert: textData }
                                 });
                             }
                             return;
                        }

                        // 2. Handle File Drops (Images/Videos)
                        const files = event.dataTransfer?.files;
                        if (!files || files.length === 0) return;

                        const file = files[0];
                        if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
                            event.preventDefault();
                            const path = (file as any).path; 
                            if (path) {
                                const formattedPath = path.replace(/\\/g, '/');
                                const insertText = `\n![${file.name}](file://${formattedPath})\n`;
                                const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
                                if (pos !== null) {
                                    view.dispatch({
                                        changes: { from: pos, insert: insertText }
                                    });
                                }
                            }
                        }
                    }
                }),
                EditorView.updateListener.of((update) => {
                    if (update.docChanged) {
                        onChangeRef.current?.(update.state.doc.toString());
                    }
                    
                    if (update.docChanged || update.selectionSet) {
                        const state = update.state;
                        const doc = state.doc;
                        const text = doc.toString();
                        const selection = state.selection.main;
                        const pos = selection.head;
                        const line = doc.lineAt(pos);
                        
                        if (onStatsUpdateRef.current) {
                            onStatsUpdateRef.current({
                                words: text.trim() ? text.trim().split(/\s+/).length : 0,
                                chars: text.length,
                                line: line.number,
                                col: pos - line.from + 1
                            });
                        }

                        // Only notify Preview if the selection change was caused by the user (not a programmatic sync)
                        const isUserEvent = update.transactions.some(tr => {
                            const isUser = tr.isUserEvent('select') || 
                                         tr.isUserEvent('input') || 
                                         tr.isUserEvent('delete') || 
                                         tr.isUserEvent('undo') || 
                                         tr.isUserEvent('redo');
                            return isUser;
                        });
                        
                        // We use a ref (isSyncingRef) to ensure programmatic syncs from Preview don't bounce back.
                        // We relax the hasFocus requirement because clicks outside the editor can trigger selection events
                        // but they are still user-initiated.
                        if (onSelectSourcePos && isUserEvent && !isSyncingRef.current) {
                            // Check if the sourcePos being set is already matching this line to avoid feedback loops
                            const currentLineNum = String(line.number);
                            const activeSourceLine = activeSourcePos ? activeSourcePos.split(':')[0] : null;
                            if (currentLineNum !== activeSourceLine) {
                                console.log("Editor is firing onSelectSourcePos due to userEvent!", {
                                    line: line.number,
                                    isSyncing: isSyncingRef.current
                                });
                                onSelectSourcePos(currentLineNum);
                            }
                        }
                    }
                })
            ]
        });

        const view = new EditorView({
            state,
            parent: editorRef.current
        });

        viewRef.current = view;

        return () => {
            view.destroy();
        };
    }, []);

    // Handle external sourcePos changes (e.g. from Preview clicks)
    useEffect(() => {
        if (!activeSourcePos || !viewRef.current) return;
        
        try {
            const startLine = parseInt(activeSourcePos.split(':')[0]);
            if (isNaN(startLine)) return;
            
            // Apply line highlight in editor
            const view = viewRef.current;
            const line = view.state.doc.line(Math.min(startLine, view.state.doc.lines));
            
            // Move cursor ONLY if the selection is far away from the line
            // This prevents fighting with manual typing
            const currentHead = view.state.selection.main.head;
            const currentLine = view.state.doc.lineAt(currentHead);
            
            isSyncingRef.current = true;
            if (currentLine.number !== line.number) {
                view.dispatch({
                    selection: { anchor: line.from, head: line.from },
                    effects: EditorView.scrollIntoView(line.from, { y: 'center' })
                });
            }
            // Add a tiny delay or use requestAnimationFrame to make sure the update cycles complete before resetting isSyncingRef
            setTimeout(() => {
                isSyncingRef.current = false;
            }, 50);
        } catch (e) {
            console.error('Error syncing editor to source pos:', e);
            isSyncingRef.current = false;
        }
    }, [activeSourcePos]);

    // Theme Update Effect
    useEffect(() => {
        if (viewRef.current) {
            viewRef.current.dispatch({
                effects: themeCompartment.current.reconfigure(getThemeExtension(theme))
            });
        }
    }, [theme]);

    // Update content when file changes (if controlled from outside)
    useEffect(() => {
        if (viewRef.current && content !== viewRef.current.state.doc.toString()) {
            viewRef.current.dispatch({
                changes: { from: 0, to: viewRef.current.state.doc.length, insert: content }
            });
        }
    }, [content]);

    return <div ref={editorRef} style={{ height: '100%', overflow: 'auto', paddingBottom: '100px', boxSizing: 'border-box' }} />;
}
