import { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Copy, Check, Play } from 'lucide-react';
import { LANG_MAP, detectLanguage, sanitizeProps } from '../../utils/markdownUtils';

// Shared code-block header: language label + copy button + optional execute button
export const CodeBlockHeader = ({ language, onCopy, copied, onExecute, executing, canExecute }: { language: string; onCopy: () => void; copied: boolean, onExecute?: () => void, executing?: boolean, canExecute?: boolean }) => (
    <div className="code-block-header" style={{
        position: 'absolute', top: '0', right: '0', display: 'flex', alignItems: 'center',
        backgroundColor: '#2d2d2d', borderBottomLeftRadius: '4px', borderTopRightRadius: '4px',
        zIndex: 10, overflow: 'hidden', userSelect: 'none'
    }}>
        <div style={{ padding: '6px 12px', fontSize: '14px', fontFamily: 'monospace', color: '#858585', textTransform: 'uppercase', pointerEvents: 'none', borderRight: '1px solid #3e3e3e' }}>
            {language === 'markup' ? 'html' : (language || 'code')}
        </div>
        {canExecute && onExecute && (
            <button className="execute-code-btn" onClick={onExecute} disabled={executing} style={{ background: 'transparent', border: 'none', color: executing ? '#eab308' : '#b0b0b0', cursor: executing ? 'wait' : 'pointer', padding: '6px 12px', display: 'flex', alignItems: 'center', transition: 'color 0.2s', borderRight: '1px solid #3e3e3e' }} title="Запустить код">
                <Play size={18} fill={executing ? "currentColor" : "none"} />
            </button>
        )}
        <button className="copy-code-btn" onClick={onCopy} style={{ background: 'transparent', border: 'none', color: copied ? '#4ade80' : '#b0b0b0', cursor: 'pointer', padding: '6px 12px', display: 'flex', alignItems: 'center', transition: 'color 0.2s' }} title="Копировать код">
            {copied ? <Check size={18} /> : <Copy size={18} />}
        </button>
    </div>
);

export const CodeBlock = ({ children, className, node, ...rest }: any) => {
    const [copied, setCopied] = useState(false);
    const [executing, setExecuting] = useState(false);
    const [output, setOutput] = useState<{success: boolean; text: string} | null>(null);
    const safeProps = sanitizeProps(rest);

    const match = /language-(\w+)/.exec(className || '');

    const getRecursiveContent = (node: any): string => {
         if (!node) return '';
         if (typeof node === 'string') return node;
         if (typeof node === 'number') return String(node);
         if (Array.isArray(node)) return node.map(getRecursiveContent).join('');
         if (node.props && node.props.children) return getRecursiveContent(node.props.children);
         return '';
    };

    const contentStr = getRecursiveContent(children).replace(/\u00A0/g, ' ').replace(/\n$/, '');
    let language = match ? match[1].toLowerCase() : '';
    const trimmed = contentStr.trim();
    if (trimmed.startsWith('<!DOCTYPE html>') || trimmed.startsWith('<html') || trimmed.startsWith('<?xml')) language = 'markup';
    if (language === 'auto') {
        language = detectLanguage(trimmed);
    }
    if (LANG_MAP[language]) language = LANG_MAP[language];
    const shouldUseHighlighter = !!language && language !== 'text';

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(contentStr);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) { console.error('Failed to copy!', err); }
    };

    const handleExecute = async () => {
        if (!window.electronAPI?.executeCode) return;
        setExecuting(true);
        setOutput(null);
        try {
            const res = await window.electronAPI.executeCode(language, contentStr);
            const cleanOutput = (res.output || '').replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
            setOutput({ success: res.success, text: cleanOutput });
        } catch (err: any) {
            const cleanErr = (err.message || 'Execution failed').replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
            setOutput({ success: false, text: cleanErr });
        } finally {
            setExecuting(false);
        }
    };

    const canExecute = !!window.electronAPI?.executeCode && !!language && language !== 'text' && language !== 'markup';

    return shouldUseHighlighter ? (
        <div style={{ position: 'relative', marginBottom: output ? '0' : '1em' }} className="code-block-wrapper" data-language={language}>
            <CodeBlockHeader language={language} onCopy={handleCopy} copied={copied} onExecute={handleExecute} executing={executing} canExecute={canExecute} />
            <div className="code-block-content">
                <SyntaxHighlighter {...safeProps} PreTag="div" children={contentStr} language={language} style={vscDarkPlus} customStyle={{ background: '#252526', borderRadius: '4px', padding: '8px', margin: '0', fontSize: '16px', whiteSpace: 'pre' }} />
            </div>
            {output && (
                <div className="code-execution-output" style={{
                    marginTop: '8px', padding: '8px 12px',
                    backgroundColor: output.success ? '#1e1e1e' : '#3f1a1a',
                    borderLeft: `4px solid ${output.success ? '#4ade80' : '#f87171'}`,
                    color: '#e5e5e5', fontFamily: 'monospace', fontSize: '14px',
                    borderRadius: '4px', whiteSpace: 'pre-wrap', overflowX: 'auto',
                    borderBottomLeftRadius: '4px', borderBottomRightRadius: '4px'
                }}>
                    <div style={{ fontSize: '11px', color: '#858585', marginBottom: '4px', textTransform: 'uppercase' }}>
                        Execution Output
                    </div>
                    {output.text}
                </div>
            )}
        </div>
    ) : (
        <code {...safeProps} className={className} style={{ fontSize: '16px' }}>{children}</code>
    );
};

// Component for rendering code blocks from saved HTML (with copy animation)
export const HtmlCodeBlock = ({ codeContent, language }: { codeContent: string; language: string }) => {
    const [copied, setCopied] = useState(false);
    const [executing, setExecuting] = useState(false);
    const [output, setOutput] = useState<{success: boolean; text: string} | null>(null);
    
    if (language === 'auto') {
        language = detectLanguage(codeContent.trim());
    }
    const mappedLang = LANG_MAP[language] || language;

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(codeContent);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Copy failed:', err);
        }
    };

    const handleExecute = async () => {
        if (!window.electronAPI?.executeCode) return;
        setExecuting(true);
        setOutput(null);
        try {
            const res = await window.electronAPI.executeCode(mappedLang, codeContent.replace(/\u00A0/g, ' '));
            const cleanOutput = (res.output || '').replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
            setOutput({ success: res.success, text: cleanOutput });
        } catch (err: any) {
            const cleanErr = (err.message || 'Execution failed').replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
            setOutput({ success: false, text: cleanErr });
        } finally {
            setExecuting(false);
        }
    };

    const canExecute = !!window.electronAPI?.executeCode && !!mappedLang && mappedLang !== 'text' && mappedLang !== 'markup';

    return (
        <div style={{ position: 'relative', marginBottom: output ? '0' : '1em' }} className="code-block-wrapper" data-language={mappedLang}>
            <CodeBlockHeader language={mappedLang} onCopy={handleCopy} copied={copied} onExecute={handleExecute} executing={executing} canExecute={canExecute} />
            <div className="code-block-content">
                <SyntaxHighlighter PreTag="div" language={mappedLang || 'text'} style={vscDarkPlus} customStyle={{ background: '#252526', borderRadius: '4px', padding: '8px', margin: '0', fontSize: '16px', whiteSpace: 'pre' }}>
                    {codeContent}
                </SyntaxHighlighter>
            </div>
            {output && (
                <div className="code-execution-output" style={{
                    marginTop: '8px', padding: '8px 12px',
                    backgroundColor: output.success ? '#1e1e1e' : '#3f1a1a',
                    borderLeft: `4px solid ${output.success ? '#4ade80' : '#f87171'}`,
                    color: '#e5e5e5', fontFamily: 'monospace', fontSize: '14px',
                    borderRadius: '4px', whiteSpace: 'pre-wrap', overflowX: 'auto',
                    borderBottomLeftRadius: '4px', borderBottomRightRadius: '4px'
                }}>
                    <div style={{ fontSize: '11px', color: '#858585', marginBottom: '4px', textTransform: 'uppercase' }}>
                        Execution Output
                    </div>
                    {output.text}
                </div>
            )}
        </div>
    );
};
