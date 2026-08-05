import { parseStyle, sanitizeProps } from '../../utils/markdownUtils';
import { transformImageUri, handleLinkClick } from '../../utils/uriTransform';
import { MermaidReactComponent } from '../MermaidReactComponent';
import { CodeBlock, HtmlCodeBlock } from './CodeBlock';
import { Callout } from './Callout';

export interface MarkdownComponentsOptions {
    filePath: string;
    allFiles: string[];
    onFileSelect: (file: string) => void;
}

export function getMarkdownComponents({ filePath, allFiles, onFileSelect }: MarkdownComponentsOptions) {
    return {
        h1: ({node, ...props}: any) => <h1 {...sanitizeProps(props)} style={{...parseStyle(props.style), margin: '1em 0'}} />,
        h2: ({node, ...props}: any) => <h2 {...sanitizeProps(props)} style={{...parseStyle(props.style), margin: '0.8em 0'}} />,
        h3: ({node, ...props}: any) => <h3 {...sanitizeProps(props)} style={parseStyle(props.style)} />,
        div: ({node, className, children, ...props}: any) => {
            // Handle code-block-wrapper specially to avoid markdown interpretation
            if (className && className.includes('code-block-wrapper')) {
                const language = props['data-language'] || 'auto';
                // Extract text content from children recursively
                const getTextContent = (node: any): string => {
                    if (!node) return '';
                    if (typeof node === 'string') return node;
                    if (typeof node === 'number') return String(node);
                    if (Array.isArray(node)) return node.map(getTextContent).join('');
                    if (node.props) {
                        // Skip code-block-header divs
                        if (node.props.className && node.props.className.includes('code-block-header')) return '';
                        return getTextContent(node.props.children);
                    }
                    return '';
                };
                
                let codeContent = getTextContent(children);
                
                // Restore HTML entities
                codeContent = codeContent
                    .replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>')
                    .replace(/&amp;/g, '&')
                    .replace(/&quot;/g, '"')
                    .replace(/&#39;/g, "'")
                    .replace(/&#35;/g, '#')
                    .replace(/\n$/, '');
                
                if (language === 'mermaid') {
                    return <MermaidReactComponent code={codeContent} />;
                }
                
                return <HtmlCodeBlock codeContent={codeContent} language={language} />;
            }
            return <div {...sanitizeProps(props)} className={className} style={parseStyle(props.style)}>{children}</div>;
        },
        span: ({node, ...props}: any) => <span {...sanitizeProps(props)} style={parseStyle(props.style)} />,
        p: ({node, ...props}: any) => <p {...sanitizeProps(props)} style={{...parseStyle(props.style), margin: '0.5em 0'}} />,
        ul: ({node, ...props}: any) => <ul {...sanitizeProps(props)} style={{...parseStyle(props.style), paddingLeft: '2em', marginBottom: '1em'}} />,
        ol: ({node, ...props}: any) => <ol {...sanitizeProps(props)} style={{...parseStyle(props.style), paddingLeft: '2em', marginBottom: '1em'}} />,
        li: ({node, ...props}: any) => <li {...sanitizeProps(props)} style={{...parseStyle(props.style), marginBottom: '0.5em'}} />,
        table: ({node, ...props}: any) => <table {...sanitizeProps(props)} style={{...parseStyle(props.style), borderCollapse: 'collapse', width: '100%', marginBottom: '1em'}} />,
        thead: ({node, ...props}: any) => <thead {...sanitizeProps(props)} style={parseStyle(props.style)} />,
        tbody: ({node, ...props}: any) => <tbody {...sanitizeProps(props)} style={parseStyle(props.style)} />,
        tr: ({node, ...props}: any) => <tr {...sanitizeProps(props)} style={{...parseStyle(props.style), borderBottom: '1px solid var(--border-subtle)'}} />,
        th: ({node, ...props}: any) => <th {...sanitizeProps(props)} style={{...parseStyle(props.style), padding: '8px', textAlign: 'left', fontWeight: 'bold'}} />,
        td: ({node, ...props}: any) => <td {...sanitizeProps(props)} style={{...parseStyle(props.style), padding: '8px'}} />,
        img: (props: any) => {
            const src = props.src || '';
            const isVideo = src.match(/\.(mp4|webm|ogv|mkv)$/i) || src.includes('youtube.com') || src.includes('youtu.be');
            if (isVideo) return (
                <span className="media-wrapper" style={{display: 'inline-block', maxWidth: '100%', ...(props.style ? parseStyle(props.style) : {})}}>
                    <video src={transformImageUri(src, filePath, allFiles)} controls style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </span>
            );
            return (
                <span className="media-wrapper" style={{display: 'inline-block', maxWidth: '100%', ...(props.style ? parseStyle(props.style) : {})}}>
                    <img {...sanitizeProps(props)} src={transformImageUri(src, filePath, allFiles)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </span>
            );
        },
        video: (props: any) => {
             const sanitized = sanitizeProps(props);
             return (
                 <span className="media-wrapper" style={{display: 'inline-block', maxWidth: '100%', ...(props.style ? parseStyle(props.style) : {})}}>
                     <video {...sanitized} src={transformImageUri(props.src || '', filePath, allFiles)} controls style={{width: '100%', height: '100%', borderRadius: '4px', display: 'block', objectFit: 'cover'}} />
                 </span>
             );
        },
        font: (props: any) => <span style={{color: props.color, ...parseStyle(props.style)}}>{props.children}</span>,
        center: ({node, ...props}: any) => <div {...sanitizeProps(props)} style={{textAlign: 'center', ...parseStyle(props.style)}} />,
        a: ({node, ...props}: any) => <a {...sanitizeProps(props)} onClick={(e) => handleLinkClick(e, props.href || '', filePath, allFiles, onFileSelect)} style={{cursor: 'pointer', color: 'var(--interactive-accent)', ...parseStyle(props.style)}} />,
        code: ({node, className, children, ...rest}: any) => {
            const match = /language-(\w+)/.exec(className || '');
            const language = match ? match[1] : '';

            if (language === 'mermaid') {
                return (
                    <MermaidReactComponent 
                        code={String(children).replace(/\n$/, '')} 
                    />
                );
            }
            return <CodeBlock className={className} children={children} node={node} {...rest} />;
        },
        pre: ({node, children, ...props}: any) => {
            // Don't wrap mermaid blocks in <pre>; they are block-level widgets.
            if (node && node.children && node.children.length === 1 && node.children[0].tagName === 'code') {
                const codeNode = node.children[0];
                const className = codeNode.properties?.className || [];
                if (Array.isArray(className) && className.includes('language-mermaid')) {
                    return <>{children}</>;
                }
            }
            return <pre {...sanitizeProps(props)} style={parseStyle(props.style)}>{children}</pre>;
        },
        blockquote: Callout,
    } as any;
}
