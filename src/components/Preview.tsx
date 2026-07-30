import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import './Preview.css';
import { Copy, Check, ChevronDown } from 'lucide-react';
import { useState, useEffect, useLayoutEffect, useRef, Children, isValidElement } from 'react';
import { normalizePath, getBasename } from '../utils/path';
import React from 'react';
import TurndownService from 'turndown';
import { visit } from 'unist-util-visit';

function rehypeSourceLine() {
  return (tree: any) => {
    visit(tree, 'element', (node: any) => {
      if (node.position && node.position.start && node.position.end) {
        node.properties = node.properties || {};
        node.properties['data-sourcepos'] = `${node.position.start.line}:${node.position.start.column}-${node.position.end.line}:${node.position.end.column}`;
      }
    });
  };
}

// removed remarkInjectSourcePos

// Fix paths to assets if they point to old directory
const fixPaths = (content: string, rootPath: string): string => {
    if (!rootPath) return content;
    
    const normalizedRoot = rootPath.replace(/\\/g, '/').replace(/\/$/, '');
    
    // Обрабатываем относительные пути, начинающиеся с /
    content = content.replace(/(src|href)="(\/[^"]+)"/g, (_match, attr, path) => {
        const absolutePath = `file:///${normalizedRoot}${path}`;
        return `${attr}="${absolutePath}"`;
    });
    
    // Обрабатываем старые абсолютные пути
    content = content.replace(/(file:\/\/\/[a-zA-Z]:(?:\/|\\)(?:Users|home)[^"'\s>]+)/gi, (match, fullUrl) => {
        try {
            const decodedUrl = decodeURIComponent(fullUrl);
            // Сначала проверяем, не указывает ли путь уже на правильную директорию
            if (decodedUrl.toLowerCase().includes(normalizedRoot.toLowerCase())) {
                return match;
            }
            // Ищем путь к assets
            const assetMatch = decodedUrl.match(/(?:assets\/[^"'\s>]+)/i);
            if (assetMatch) {
                const newPath = `file:///${normalizedRoot}/${assetMatch[0]}`;
                return newPath;
            }
        } catch (e) {
            console.warn('Failed to decode URL:', match);
        }
        return match;
    });
    
    return content;
};

// Helper to handle style attributes from HTML which might be strings
const parseStyle = (style: any): React.CSSProperties => {
    if (typeof style === 'object' && style !== null) return style;
    if (typeof style !== 'string') return {};
    
    try {
        return style.split(';').reduce((acc: any, rule) => {
            const firstColonIndex = rule.indexOf(':');
            if (firstColonIndex === -1) return acc;

            let prop = rule.substring(0, firstColonIndex).trim();
            const value = rule.substring(firstColonIndex + 1).trim();

            if (prop && value) {
                if (prop.toLowerCase() === 'boxshadow') prop = 'box-shadow';
                const camelProp = prop.replace(/-([a-z])/g, (g: any) => g[1].toUpperCase());
                acc[camelProp] = value;
            }
            return acc;
        }, {});
    } catch (e) {
        console.error('Error parsing style:', style, e);
        return {};
    }
};

const sanitizeProps = (props: any) => {
    const cleanProps: any = {};
    Object.keys(props).forEach(key => {
        if (key.includes(':') || key.includes(';') || key === 'node' || key === 'style') return;
        cleanProps[key] = props[key];
    });
    return cleanProps;
};

const Callout = ({ children }: any) => {
    const arrayChildren = Children.toArray(children);
    const firstChild = arrayChildren.find(child => {
        if (typeof child === 'string') return child.trim().length > 0;
        return true;
    }) || arrayChildren[0];

    const getRecursiveText = (node: any): string => {
        try {
            if (!node) return '';
            if (typeof node === 'string') return node;
            if (typeof node === 'number') return String(node);
            if (typeof node === 'boolean') return '';
            if (Array.isArray(node)) return node.map(n => getRecursiveText(n)).join('');
            if (typeof node === 'object') {
                if (node.props) {
                    if (node.props.children) return getRecursiveText(node.props.children);
                    if (node.props.nodeValue) return String(node.props.nodeValue);
                }
                if (node.children) return getRecursiveText(node.children);
            }
        } catch (e) { return ''; }
        return '';
    };
    
    let isCallout = false;
    let type = 'note';
    let title = '';
    let suffix = '';
    let validPChildren: React.ReactNode[] = [];
    
    const firstChildIndex = arrayChildren.indexOf(firstChild);
    let remainingChildren: React.ReactNode[] = firstChildIndex >= 0 
        ? arrayChildren.slice(firstChildIndex + 1).filter(child => {
            if (typeof child === 'string') return child.trim().length > 0;
            return true;
        })
        : [];

    let fullText = '';
    let match = null;
    
    if (typeof firstChild === 'string') {
        fullText = firstChild;
    } else if (isValidElement(firstChild) && firstChild.props) {
        const children = (firstChild.props as any).children;
        if (typeof children === 'string') fullText = children;
        else if (Array.isArray(children)) fullText = children.filter(c => typeof c === 'string').join('');
        
        if (!fullText) fullText = getRecursiveText(children);
    }
    
    if (!fullText) {
        try {
            const jsonStr = JSON.stringify(firstChild);
            const jsonMatch = jsonStr.match(/\[!(\w+)\]([+-]?)/);
            if (jsonMatch) fullText = jsonStr;
        } catch (e) {}
    }
    
    match = fullText.trim().match(/^\[!([\w-]+)\]([+-]?)/);
    if (!match) match = fullText.match(/\[!([\w-]+)\]([+-]?)/);

    if (match) {
            isCallout = true;
            type = match[1].toLowerCase();
            suffix = match[2];

            const tagLength = match[0].length;
            const textAfterTag = fullText.slice(tagLength).trim();
            const firstLineBreak = textAfterTag.indexOf('\n');
            const rawTitle = firstLineBreak === -1 ? textAfterTag : textAfterTag.slice(0, firstLineBreak);
            
            if (!title) title = rawTitle || (type.charAt(0).toUpperCase() + type.slice(1));

            if (isValidElement(firstChild) && (firstChild.props as any).children) {
                const pContent = (firstChild.props as any).children;
                if (typeof pContent === 'string') {
                    let bodyContent = pContent;
                    if (bodyContent.includes(match[0])) {
                        const afterTag = bodyContent.split(match[0])[1] || '';
                        if (rawTitle && afterTag.trim().startsWith(rawTitle)) {
                            bodyContent = afterTag.replace(rawTitle, '').trim();
                        } else {
                            bodyContent = afterTag.trim();
                        }
                    }
                    if (bodyContent.length > 0) validPChildren = [bodyContent];
                    else validPChildren = [];
                } else {
                    validPChildren = [];
                }
            } else {
                validPChildren = [];
            }
     }

    const [isCollapsed, setIsCollapsed] = useState(() => suffix === '-');
    const toggle = () => { if (suffix) setIsCollapsed(!isCollapsed); };

    if (!isCallout) {
        return (
            <blockquote style={{ borderLeft: 'none', paddingLeft: '16px', marginLeft: '0', color: 'var(--text-muted)' }}>
                {children}
            </blockquote>
        );
    }

    // Custom SVG icons from cards.html
    const svgIcons: Record<string, JSX.Element> = {
        // Info / Note - Circle with exclamation
        info: <svg width="1em" height="1em" viewBox="0 0 512 512" fill="currentColor"><path d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zm0-384c13.3 0 24 10.7 24 24V264c0 13.3-10.7 24-24 24s-24-10.7-24-24V152c0-13.3 10.7-24 24-24zM224 352a32 32 0 1 1 64 0 32 32 0 1 1 -64 0z"/></svg>,
        note: <svg width="1em" height="1em" viewBox="0 0 512 512" fill="currentColor"><path d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zm0-384c13.3 0 24 10.7 24 24V264c0 13.3-10.7 24-24 24s-24-10.7-24-24V152c0-13.3 10.7-24 24-24zM224 352a32 32 0 1 1 64 0 32 32 0 1 1 -64 0z"/></svg>,
        // Important - Fire
        important: <svg width="1em" height="1em" viewBox="0 0 448 512" fill="currentColor"><path d="M159.3 5.4c7.8-7.3 19.9-7.2 27.7 .1c27.6 25.9 53.5 53.8 77.7 84c11-14.4 23.5-30.1 37-42.9c7.9-7.4 20.1-7.4 28 .1c34.6 33 63.9 76.6 84.5 118c20.3 40.8 33.8 82.5 33.8 111.9C448 404.2 348.2 512 224 512C98.4 512 0 404.1 0 276.5c0-38.4 17.8-85.3 45.4-131.7C73.3 97.7 112.7 48.6 159.3 5.4zM225.7 416c25.3 0 47.7-7 68.8-21c42.1-29.4 53.4-88.2 28.1-134.4c-4.5-9-16-9.6-22.5-2l-25.2 29.3c-6.6 7.6-18.5 7.4-24.7-.5c-16.5-21-46-58.5-62.8-79.8c-6.3-8-18.3-8.1-24.7-.1c-33.8 42.5-50.8 69.3-50.8 99.4C112 375.4 162.6 416 225.7 416z"/></svg>,
        tip: <svg width="1em" height="1em" viewBox="0 0 448 512" fill="currentColor"><path d="M159.3 5.4c7.8-7.3 19.9-7.2 27.7 .1c27.6 25.9 53.5 53.8 77.7 84c11-14.4 23.5-30.1 37-42.9c7.9-7.4 20.1-7.4 28 .1c34.6 33 63.9 76.6 84.5 118c20.3 40.8 33.8 82.5 33.8 111.9C448 404.2 348.2 512 224 512C98.4 512 0 404.1 0 276.5c0-38.4 17.8-85.3 45.4-131.7C73.3 97.7 112.7 48.6 159.3 5.4zM225.7 416c25.3 0 47.7-7 68.8-21c42.1-29.4 53.4-88.2 28.1-134.4c-4.5-9-16-9.6-22.5-2l-25.2 29.3c-6.6 7.6-18.5 7.4-24.7-.5c-16.5-21-46-58.5-62.8-79.8c-6.3-8-18.3-8.1-24.7-.1c-33.8 42.5-50.8 69.3-50.8 99.4C112 375.4 162.6 416 225.7 416z"/></svg>,
        hint: <svg width="1em" height="1em" viewBox="0 0 448 512" fill="currentColor"><path d="M159.3 5.4c7.8-7.3 19.9-7.2 27.7 .1c27.6 25.9 53.5 53.8 77.7 84c11-14.4 23.5-30.1 37-42.9c7.9-7.4 20.1-7.4 28 .1c34.6 33 63.9 76.6 84.5 118c20.3 40.8 33.8 82.5 33.8 111.9C448 404.2 348.2 512 224 512C98.4 512 0 404.1 0 276.5c0-38.4 17.8-85.3 45.4-131.7C73.3 97.7 112.7 48.6 159.3 5.4zM225.7 416c25.3 0 47.7-7 68.8-21c42.1-29.4 53.4-88.2 28.1-134.4c-4.5-9-16-9.6-22.5-2l-25.2 29.3c-6.6 7.6-18.5 7.4-24.7-.5c-16.5-21-46-58.5-62.8-79.8c-6.3-8-18.3-8.1-24.7-.1c-33.8 42.5-50.8 69.3-50.8 99.4C112 375.4 162.6 416 225.7 416z"/></svg>,
        // Question / FAQ - Question mark circle
        question: <svg width="1em" height="1em" viewBox="0 0 512 512" fill="currentColor"><path d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM169.8 165.3c7.9-22.3 29.1-37.3 52.8-37.3h58.3c34.9 0 63.1 28.3 63.1 63.1c0 22.6-12.1 43.5-31.7 54.8L280 264.4c-.2 13-10.9 23.6-24 23.6c-13.3 0-24-10.7-24-24V250.5c0-8.6 4.6-16.5 12.1-20.8l44.3-25.4c4.7-2.7 7.6-7.7 7.6-13.1c0-8.4-6.8-15.1-15.1-15.1H222.6c-3.4 0-6.4 2.1-7.5 5.3l-.4 1.2c-4.4 12.5-18.2 19-30.6 14.6s-19-18.2-14.6-30.6l.4-1.2zM224 352a32 32 0 1 1 64 0 32 32 0 1 1 -64 0z"/></svg>,
        help: <svg width="1em" height="1em" viewBox="0 0 512 512" fill="currentColor"><path d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM169.8 165.3c7.9-22.3 29.1-37.3 52.8-37.3h58.3c34.9 0 63.1 28.3 63.1 63.1c0 22.6-12.1 43.5-31.7 54.8L280 264.4c-.2 13-10.9 23.6-24 23.6c-13.3 0-24-10.7-24-24V250.5c0-8.6 4.6-16.5 12.1-20.8l44.3-25.4c4.7-2.7 7.6-7.7 7.6-13.1c0-8.4-6.8-15.1-15.1-15.1H222.6c-3.4 0-6.4 2.1-7.5 5.3l-.4 1.2c-4.4 12.5-18.2 19-30.6 14.6s-19-18.2-14.6-30.6l.4-1.2zM224 352a32 32 0 1 1 64 0 32 32 0 1 1 -64 0z"/></svg>,
        faq: <svg width="1em" height="1em" viewBox="0 0 512 512" fill="currentColor"><path d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM169.8 165.3c7.9-22.3 29.1-37.3 52.8-37.3h58.3c34.9 0 63.1 28.3 63.1 63.1c0 22.6-12.1 43.5-31.7 54.8L280 264.4c-.2 13-10.9 23.6-24 23.6c-13.3 0-24-10.7-24-24V250.5c0-8.6 4.6-16.5 12.1-20.8l44.3-25.4c4.7-2.7 7.6-7.7 7.6-13.1c0-8.4-6.8-15.1-15.1-15.1H222.6c-3.4 0-6.4 2.1-7.5 5.3l-.4 1.2c-4.4 12.5-18.2 19-30.6 14.6s-19-18.2-14.6-30.6l.4-1.2zM224 352a32 32 0 1 1 64 0 32 32 0 1 1 -64 0z"/></svg>,
        // Error / Danger - Lightning bolt
        error: <svg width="1em" height="1em" viewBox="0 0 448 512" fill="currentColor"><path d="M349.4 44.6c5.9-13.7 1.5-29.7-10.6-38.5s-28.6-8-39.9 1.8l-256 224c-10 8.8-13.6 22.9-8.9 35.3S50.7 288 64 288H175.5L98.6 467.4c-5.9 13.7-1.5 29.7 10.6 38.5s28.6 8 39.9-1.8l256-224c10-8.8 13.6-22.9 8.9-35.3s-16.6-20.7-30-20.7H272.5L349.4 44.6z"/></svg>,
        danger: <svg width="1em" height="1em" viewBox="0 0 448 512" fill="currentColor"><path d="M349.4 44.6c5.9-13.7 1.5-29.7-10.6-38.5s-28.6-8-39.9 1.8l-256 224c-10 8.8-13.6 22.9-8.9 35.3S50.7 288 64 288H175.5L98.6 467.4c-5.9 13.7-1.5 29.7 10.6 38.5s28.6 8 39.9-1.8l256-224c10-8.8 13.6-22.9 8.9-35.3s-16.6-20.7-30-20.7H272.5L349.4 44.6z"/></svg>,
        fail: <svg width="1em" height="1em" viewBox="0 0 448 512" fill="currentColor"><path d="M349.4 44.6c5.9-13.7 1.5-29.7-10.6-38.5s-28.6-8-39.9 1.8l-256 224c-10 8.8-13.6 22.9-8.9 35.3S50.7 288 64 288H175.5L98.6 467.4c-5.9 13.7-1.5 29.7 10.6 38.5s28.6 8 39.9-1.8l256-224c10-8.8 13.6-22.9 8.9-35.3s-16.6-20.7-30-20.7H272.5L349.4 44.6z"/></svg>,
        failure: <svg width="1em" height="1em" viewBox="0 0 448 512" fill="currentColor"><path d="M349.4 44.6c5.9-13.7 1.5-29.7-10.6-38.5s-28.6-8-39.9 1.8l-256 224c-10 8.8-13.6 22.9-8.9 35.3S50.7 288 64 288H175.5L98.6 467.4c-5.9 13.7-1.5 29.7 10.6 38.5s28.6 8 39.9-1.8l256-224c10-8.8 13.6-22.9 8.9-35.3s-16.6-20.7-30-20.7H272.5L349.4 44.6z"/></svg>,
        bug: <svg width="1em" height="1em" viewBox="0 0 448 512" fill="currentColor"><path d="M349.4 44.6c5.9-13.7 1.5-29.7-10.6-38.5s-28.6-8-39.9 1.8l-256 224c-10 8.8-13.6 22.9-8.9 35.3S50.7 288 64 288H175.5L98.6 467.4c-5.9 13.7-1.5 29.7 10.6 38.5s28.6 8 39.9-1.8l256-224c10-8.8 13.6-22.9 8.9-35.3s-16.6-20.7-30-20.7H272.5L349.4 44.6z"/></svg>,
        warning: <svg width="1em" height="1em" viewBox="0 0 448 512" fill="currentColor"><path d="M349.4 44.6c5.9-13.7 1.5-29.7-10.6-38.5s-28.6-8-39.9 1.8l-256 224c-10 8.8-13.6 22.9-8.9 35.3S50.7 288 64 288H175.5L98.6 467.4c-5.9 13.7-1.5 29.7 10.6 38.5s28.6 8 39.9-1.8l256-224c10-8.8 13.6-22.9 8.9-35.3s-16.6-20.7-30-20.7H272.5L349.4 44.6z"/></svg>,
        caution: <svg width="1em" height="1em" viewBox="0 0 448 512" fill="currentColor"><path d="M349.4 44.6c5.9-13.7 1.5-29.7-10.6-38.5s-28.6-8-39.9 1.8l-256 224c-10 8.8-13.6 22.9-8.9 35.3S50.7 288 64 288H175.5L98.6 467.4c-5.9 13.7-1.5 29.7 10.6 38.5s28.6 8 39.9-1.8l256-224c10-8.8 13.6-22.9 8.9-35.3s-16.6-20.7-30-20.7H272.5L349.4 44.6z"/></svg>,
        attention: <svg width="1em" height="1em" viewBox="0 0 448 512" fill="currentColor"><path d="M349.4 44.6c5.9-13.7 1.5-29.7-10.6-38.5s-28.6-8-39.9 1.8l-256 224c-10 8.8-13.6 22.9-8.9 35.3S50.7 288 64 288H175.5L98.6 467.4c-5.9 13.7-1.5 29.7 10.6 38.5s28.6 8 39.9-1.8l256-224c10-8.8 13.6-22.9 8.9-35.3s-16.6-20.7-30-20.7H272.5L349.4 44.6z"/></svg>,
        // Example - Code brackets (rotated 90deg via style)
        example: <svg width="1em" height="1em" viewBox="0 0 512 512" fill="currentColor" style={{transform: 'rotate(90deg)'}}><path d="M260.353,254.878,131.538,33.1a2.208,2.208,0,0,0-3.829.009L.3,254.887A2.234,2.234,0,0,0,.3,257.122L129.116,478.9a2.208,2.208,0,0,0,3.83-.009L260.358,257.113A2.239,2.239,0,0,0,260.353,254.878Zm39.078-25.713a2.19,2.19,0,0,0,1.9,1.111h66.509a2.226,2.226,0,0,0,1.9-3.341L259.115,33.111a2.187,2.187,0,0,0-1.9-1.111H190.707a2.226,2.226,0,0,0-1.9,3.341ZM511.7,254.886,384.9,33.112A2.2,2.2,0,0,0,382.99,32h-66.6a2.226,2.226,0,0,0-1.906,3.34L440.652,256,314.481,476.66a2.226,2.226,0,0,0,1.906,3.34h66.6a2.2,2.2,0,0,0,1.906-1.112L511.7,257.114A2.243,2.243,0,0,0,511.7,254.886ZM366.016,284.917H299.508a2.187,2.187,0,0,0-1.9,1.111l-108.8,190.631a2.226,2.226,0,0,0,1.9,3.341h66.509a2.187,2.187,0,0,0,1.9-1.111l108.8-190.631A2.226,2.226,0,0,0,366.016,284.917Z"/></svg>,
        // Task / Todo - File with code
        task: <svg width="1em" height="1em" viewBox="0 0 384 512" fill="currentColor"><path d="M64 464c-8.8 0-16-7.2-16-16V64c0-8.8 7.2-16 16-16H224v80c0 17.7 14.3 32 32 32h80V448c0 8.8-7.2 16-16 16H64zM64 0C28.7 0 0 28.7 0 64V448c0 35.3 28.7 64 64 64H320c35.3 0 64-28.7 64-64V154.5c0-17-6.7-33.3-18.7-45.3L274.7 18.7C262.7 6.7 246.5 0 229.5 0H64zm97 289c9.4-9.4 9.4-24.6 0-33.9s-24.6-9.4-33.9 0L79 303c-9.4 9.4-9.4 24.6 0 33.9l48 48c9.4 9.4 24.6 9.4 33.9 0s9.4-24.6 0-33.9l-31-31 31-31zM257 255c-9.4-9.4-24.6-9.4-33.9 0s-9.4 24.6 0 33.9l31 31-31 31c-9.4 9.4-9.4 24.6 0 33.9s24.6 9.4 33.9 0l48-48c9.4-9.4 9.4-24.6 0-33.9l-48-48z"/></svg>,
        todo: <svg width="1em" height="1em" viewBox="0 0 384 512" fill="currentColor"><path d="M64 464c-8.8 0-16-7.2-16-16V64c0-8.8 7.2-16 16-16H224v80c0 17.7 14.3 32 32 32h80V448c0 8.8-7.2 16-16 16H64zM64 0C28.7 0 0 28.7 0 64V448c0 35.3 28.7 64 64 64H320c35.3 0 64-28.7 64-64V154.5c0-17-6.7-33.3-18.7-45.3L274.7 18.7C262.7 6.7 246.5 0 229.5 0H64zm97 289c9.4-9.4 9.4-24.6 0-33.9s-24.6-9.4-33.9 0L79 303c-9.4 9.4-9.4 24.6 0 33.9l48 48c9.4 9.4 24.6 9.4 33.9 0s9.4-24.6 0-33.9l-31-31 31-31zM257 255c-9.4-9.4-24.6-9.4-33.9 0s-9.4 24.6 0 33.9l31 31-31 31c-9.4 9.4-9.4 24.6 0 33.9s24.6 9.4 33.9 0l48-48c9.4-9.4 9.4-24.6 0-33.9l-48-48z"/></svg>,
        // Success / Check / Done - Checkmark
        success: <Check size="1.1em" />,
        check: <Check size="1.1em" />,
        done: <Check size="1.1em" />,
        // Quote / Cite - Keep copy icon
        quote: <Copy size="1.1em" />,
        cite: <Copy size="1.1em" />
    };

    const IconElement = svgIcons[type] || svgIcons.note;
    const colorMap: Record<string, string> = {
        abstract: '#00bfa5', summary: '#00bfa5', tldr: '#00bfa5', info: '#448aff', todo: '#448aff', note: '#448aff',
        tip: '#00bfa5', hint: '#00bfa5', important: '#00bfa5', success: '#00c853', check: '#00c853', done: '#00c853',
        question: '#ff9800', help: '#ff9800', faq: '#ff9800', warning: '#ff9800', caution: '#ff9800', attention: '#ff9800',
        failure: '#e91e63', fail: '#e91e63', missing: '#e91e63', danger: '#e91e63', error: '#e91e63', bug: '#e91e63',
        example: '#00c853', quote: '#9e9e9e', cite: '#9e9e9e'
    };
    
    const color = colorMap[type] || '#448aff';
    const hexToRgb = (hex: string) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '68, 138, 255';
    };
    const rgbColor = hexToRgb(color);

    return (
        <div 
            className={`callout callout-${type} ${type === 'example' ? 'fiol fiel' : ''} ${isCollapsed ? 'is-collapsed' : ''} ${suffix ? 'is-collapsible' : ''}`}
            data-collapsible={!!suffix}
            style={{ 
                // @ts-ignore
                '--callout-color': rgbColor 
            }}
        >
            <div className="callout-title" onClick={toggle}>
                 <div className="callout-icon">{IconElement}</div>
                 <div className="callout-title-inner">{title}</div>
                 {suffix && (
                     <div className="callout-fold">
                         <ChevronDown size="1.1em" />
                     </div>
                 )}
            </div>
            {!isCollapsed && (validPChildren.length > 0 || remainingChildren.length > 0) && (
                <div className="callout-content">
                   {validPChildren.length > 0 && (
                       <p className="callout-entry-p">
                           {validPChildren.map((child, i) => <span key={i}>{child}</span>)}
                       </p>
                   )}
                   {remainingChildren}
                </div>
            )}
        </div>
    );
};

    const CodeBlock = ({ children, className, node, ...rest }: any) => {
        const [copied, setCopied] = useState(false);
        // Sanitize rest props to ensure no objects specific to AST are passed to DOM
        const safeProps = sanitizeProps(rest);

        const match = /language-(\w+)/.exec(className || '');
        const langMap: Record<string, string> = {
            'js': 'javascript', 'ts': 'typescript', 'py': 'python', 'htm': 'markup', 'html': 'markup', 'xml': 'markup',
            'svg': 'markup', 'сыы': 'css', 'sh': 'bash', 'bash': 'bash', 'shell': 'bash', 'c++': 'cpp', 'c#': 'csharp'
        };

        const getRecursiveContent = (node: any): string => {
             if (!node) return '';
             if (typeof node === 'string') return node;
             if (typeof node === 'number') return String(node);
             if (Array.isArray(node)) return node.map(getRecursiveContent).join('');
             if (node.props && node.props.children) return getRecursiveContent(node.props.children);
             return ''; 
        };

        const contentStr = getRecursiveContent(children).replace(/\n$/, '');
        let language = match ? match[1].toLowerCase() : '';
        const trimmed = contentStr.trim();
        if (trimmed.startsWith('<!DOCTYPE html>') || trimmed.startsWith('<html') || trimmed.startsWith('<?xml')) language = 'markup';
        if (langMap[language]) language = langMap[language];
        const shouldUseHighlighter = !!language;

        const handleCopy = async () => {
            try {
                await navigator.clipboard.writeText(contentStr);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            } catch (err) { console.error('Failed to copy!', err); }
        };

        return shouldUseHighlighter ? (
            <div style={{ position: 'relative' }} className="code-block-wrapper" data-language={language}>
                <div className="code-block-header" style={{
                    position: 'absolute', top: '0', right: '0', display: 'flex', alignItems: 'center',
                    backgroundColor: '#2d2d2d', borderBottomLeftRadius: '4px', borderTopRightRadius: '4px',
                    zIndex: 10, overflow: 'hidden', userSelect: 'none'
                }}>
                    <div style={{ padding: '4px 8px', fontSize: '12px', fontFamily: 'monospace', color: '#858585', textTransform: 'uppercase', pointerEvents: 'none', borderRight: '1px solid #3e3e3e' }}>
                        {language === 'markup' ? 'html' : language}
                    </div>
                    <button className="copy-code-btn" onClick={handleCopy} style={{ background: 'transparent', border: 'none', color: copied ? '#4ade80' : '#b0b0b0', cursor: 'pointer', padding: '4px 8px', display: 'flex', alignItems: 'center', transition: 'color 0.2s' }} title="Копировать код">
                        {copied ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                </div>
                <div className="code-block-content">
                    <SyntaxHighlighter {...safeProps} PreTag="div" children={contentStr} language={language} style={vscDarkPlus} customStyle={{ background: '#252526', borderRadius: '4px', padding: '8px', margin: '0', fontSize: '16px', whiteSpace: 'pre' }} />
                </div>
            </div>
        ) : (
            <code {...safeProps} className={className} style={{ fontSize: '16px' }}>{children}</code>
        );
    };

    // Component for rendering code blocks from saved HTML (with copy animation)
    const HtmlCodeBlock = ({ codeContent, language }: { codeContent: string; language: string }) => {
        const [copied, setCopied] = useState(false);
        
        const langMap: Record<string, string> = {
            'js': 'javascript', 'ts': 'typescript', 'py': 'python', 
            'htm': 'markup', 'html': 'markup', 'xml': 'markup',
            'svg': 'markup', 'sh': 'bash', 'bash': 'bash', 'shell': 'bash'
        };
        const mappedLang = langMap[language] || language;
        
        const handleCopy = async () => {
            try {
                await navigator.clipboard.writeText(codeContent);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            } catch (err) { 
                console.error('Copy failed:', err); 
            }
        };
        
        return (
            <div style={{ position: 'relative' }} className="code-block-wrapper" data-language={mappedLang}>
                <div className="code-block-header" style={{
                    position: 'absolute', top: '0', right: '0', display: 'flex', alignItems: 'center',
                    backgroundColor: '#2d2d2d', borderBottomLeftRadius: '4px', borderTopRightRadius: '4px',
                    zIndex: 10, overflow: 'hidden', userSelect: 'none'
                }}>
                    <div style={{ padding: '4px 8px', fontSize: '12px', fontFamily: 'monospace', color: '#858585', textTransform: 'uppercase', pointerEvents: 'none', borderRight: '1px solid #3e3e3e' }}>
                        {mappedLang === 'markup' ? 'html' : (mappedLang || 'code')}
                    </div>
                    <button className="copy-code-btn" onClick={handleCopy} style={{ 
                        background: 'transparent', border: 'none', 
                        color: copied ? '#4ade80' : '#b0b0b0', 
                        cursor: 'pointer', padding: '4px 8px', 
                        display: 'flex', alignItems: 'center',
                        transition: 'color 0.2s'
                    }} title="Копировать код">
                        {copied ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                </div>
                <div className="code-block-content">
                    <SyntaxHighlighter PreTag="div" language={mappedLang || 'text'} style={vscDarkPlus} customStyle={{ background: '#252526', borderRadius: '4px', padding: '8px', margin: '0', fontSize: '16px', whiteSpace: 'pre' }}>
                        {codeContent}
                    </SyntaxHighlighter>
                </div>
            </div>
        );
    };

    // Helper to convert Markdown to HTML for Ghost Preview
    const markdownToHtmlHelper = (md: string): string => {
        // Callout Detection
        const calloutRegex = /^(?:>\s?)?\[!(\w+)\](.*)/;
        const match = md.match(calloutRegex);
        
        if (match) {
            const type = match[1];
            const title = match[2].trim() || type;
            const contentBody = md.split('\n').slice(1).join('\n').replace(/^>\s?/gm, '').trim();
            
        // Check for collapse syntax (+/-)
        const typeMatch = type.match(/^(\w+)([-+]?)$/);
        const cleanType = typeMatch ? typeMatch[1] : type;
        const collapseChar = typeMatch ? typeMatch[2] : '';
        const isFoldable = collapseChar !== '';
        
        // Dynamic icon selection based on callout type
        const iconSvgMap: Record<string, string> = {
            // Info / Note
            info: '<svg width="18" height="18" viewBox="0 0 512 512" fill="currentColor"><path d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zm0-384c13.3 0 24 10.7 24 24V264c0 13.3-10.7 24-24 24s-24-10.7-24-24V152c0-13.3 10.7-24 24-24zM224 352a32 32 0 1 1 64 0 32 32 0 1 1 -64 0z"/></svg>',
            note: '<svg width="18" height="18" viewBox="0 0 512 512" fill="currentColor"><path d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zm0-384c13.3 0 24 10.7 24 24V264c0 13.3-10.7 24-24 24s-24-10.7-24-24V152c0-13.3 10.7-24 24-24zM224 352a32 32 0 1 1 64 0 32 32 0 1 1 -64 0z"/></svg>',
            // Important / Tip / Hint - Fire
            important: '<svg width="18" height="18" viewBox="0 0 448 512" fill="currentColor"><path d="M159.3 5.4c7.8-7.3 19.9-7.2 27.7 .1c27.6 25.9 53.5 53.8 77.7 84c11-14.4 23.5-30.1 37-42.9c7.9-7.4 20.1-7.4 28 .1c34.6 33 63.9 76.6 84.5 118c20.3 40.8 33.8 82.5 33.8 111.9C448 404.2 348.2 512 224 512C98.4 512 0 404.1 0 276.5c0-38.4 17.8-85.3 45.4-131.7C73.3 97.7 112.7 48.6 159.3 5.4zM225.7 416c25.3 0 47.7-7 68.8-21c42.1-29.4 53.4-88.2 28.1-134.4c-4.5-9-16-9.6-22.5-2l-25.2 29.3c-6.6 7.6-18.5 7.4-24.7-.5c-16.5-21-46-58.5-62.8-79.8c-6.3-8-18.3-8.1-24.7-.1c-33.8 42.5-50.8 69.3-50.8 99.4C112 375.4 162.6 416 225.7 416z"/></svg>',
            tip: '<svg width="18" height="18" viewBox="0 0 448 512" fill="currentColor"><path d="M159.3 5.4c7.8-7.3 19.9-7.2 27.7 .1c27.6 25.9 53.5 53.8 77.7 84c11-14.4 23.5-30.1 37-42.9c7.9-7.4 20.1-7.4 28 .1c34.6 33 63.9 76.6 84.5 118c20.3 40.8 33.8 82.5 33.8 111.9C448 404.2 348.2 512 224 512C98.4 512 0 404.1 0 276.5c0-38.4 17.8-85.3 45.4-131.7C73.3 97.7 112.7 48.6 159.3 5.4zM225.7 416c25.3 0 47.7-7 68.8-21c42.1-29.4 53.4-88.2 28.1-134.4c-4.5-9-16-9.6-22.5-2l-25.2 29.3c-6.6 7.6-18.5 7.4-24.7-.5c-16.5-21-46-58.5-62.8-79.8c-6.3-8-18.3-8.1-24.7-.1c-33.8 42.5-50.8 69.3-50.8 99.4C112 375.4 162.6 416 225.7 416z"/></svg>',
            hint: '<svg width="18" height="18" viewBox="0 0 448 512" fill="currentColor"><path d="M159.3 5.4c7.8-7.3 19.9-7.2 27.7 .1c27.6 25.9 53.5 53.8 77.7 84c11-14.4 23.5-30.1 37-42.9c7.9-7.4 20.1-7.4 28 .1c34.6 33 63.9 76.6 84.5 118c20.3 40.8 33.8 82.5 33.8 111.9C448 404.2 348.2 512 224 512C98.4 512 0 404.1 0 276.5c0-38.4 17.8-85.3 45.4-131.7C73.3 97.7 112.7 48.6 159.3 5.4zM225.7 416c25.3 0 47.7-7 68.8-21c42.1-29.4 53.4-88.2 28.1-134.4c-4.5-9-16-9.6-22.5-2l-25.2 29.3c-6.6 7.6-18.5 7.4-24.7-.5c-16.5-21-46-58.5-62.8-79.8c-6.3-8-18.3-8.1-24.7-.1c-33.8 42.5-50.8 69.3-50.8 99.4C112 375.4 162.6 416 225.7 416z"/></svg>',
            // Question / Help / FAQ
            question: '<svg width="18" height="18" viewBox="0 0 512 512" fill="currentColor"><path d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM169.8 165.3c7.9-22.3 29.1-37.3 52.8-37.3h58.3c34.9 0 63.1 28.3 63.1 63.1c0 22.6-12.1 43.5-31.7 54.8L280 264.4c-.2 13-10.9 23.6-24 23.6c-13.3 0-24-10.7-24-24V250.5c0-8.6 4.6-16.5 12.1-20.8l44.3-25.4c4.7-2.7 7.6-7.7 7.6-13.1c0-8.4-6.8-15.1-15.1-15.1H222.6c-3.4 0-6.4 2.1-7.5 5.3l-.4 1.2c-4.4 12.5-18.2 19-30.6 14.6s-19-18.2-14.6-30.6l.4-1.2zM224 352a32 32 0 1 1 64 0 32 32 0 1 1 -64 0z"/></svg>',
            help: '<svg width="18" height="18" viewBox="0 0 512 512" fill="currentColor"><path d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM169.8 165.3c7.9-22.3 29.1-37.3 52.8-37.3h58.3c34.9 0 63.1 28.3 63.1 63.1c0 22.6-12.1 43.5-31.7 54.8L280 264.4c-.2 13-10.9 23.6-24 23.6c-13.3 0-24-10.7-24-24V250.5c0-8.6 4.6-16.5 12.1-20.8l44.3-25.4c4.7-2.7 7.6-7.7 7.6-13.1c0-8.4-6.8-15.1-15.1-15.1H222.6c-3.4 0-6.4 2.1-7.5 5.3l-.4 1.2c-4.4 12.5-18.2 19-30.6 14.6s-19-18.2-14.6-30.6l.4-1.2zM224 352a32 32 0 1 1 64 0 32 32 0 1 1 -64 0z"/></svg>',
            faq: '<svg width="18" height="18" viewBox="0 0 512 512" fill="currentColor"><path d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM169.8 165.3c7.9-22.3 29.1-37.3 52.8-37.3h58.3c34.9 0 63.1 28.3 63.1 63.1c0 22.6-12.1 43.5-31.7 54.8L280 264.4c-.2 13-10.9 23.6-24 23.6c-13.3 0-24-10.7-24-24V250.5c0-8.6 4.6-16.5 12.1-20.8l44.3-25.4c4.7-2.7 7.6-7.7 7.6-13.1c0-8.4-6.8-15.1-15.1-15.1H222.6c-3.4 0-6.4 2.1-7.5 5.3l-.4 1.2c-4.4 12.5-18.2 19-30.6 14.6s-19-18.2-14.6-30.6l.4-1.2zM224 352a32 32 0 1 1 64 0 32 32 0 1 1 -64 0z"/></svg>',
            // Error / Danger / Warning - Lightning bolt
            error: '<svg width="18" height="18" viewBox="0 0 448 512" fill="currentColor"><path d="M349.4 44.6c5.9-13.7 1.5-29.7-10.6-38.5s-28.6-8-39.9 1.8l-256 224c-10 8.8-13.6 22.9-8.9 35.3S50.7 288 64 288H175.5L98.6 467.4c-5.9 13.7-1.5 29.7 10.6 38.5s28.6 8 39.9-1.8l256-224c10-8.8 13.6-22.9 8.9-35.3s-16.6-20.7-30-20.7H272.5L349.4 44.6z"/></svg>',
            danger: '<svg width="18" height="18" viewBox="0 0 448 512" fill="currentColor"><path d="M349.4 44.6c5.9-13.7 1.5-29.7-10.6-38.5s-28.6-8-39.9 1.8l-256 224c-10 8.8-13.6 22.9-8.9 35.3S50.7 288 64 288H175.5L98.6 467.4c-5.9 13.7-1.5 29.7 10.6 38.5s28.6 8 39.9-1.8l256-224c10-8.8 13.6-22.9 8.9-35.3s-16.6-20.7-30-20.7H272.5L349.4 44.6z"/></svg>',
            fail: '<svg width="18" height="18" viewBox="0 0 448 512" fill="currentColor"><path d="M349.4 44.6c5.9-13.7 1.5-29.7-10.6-38.5s-28.6-8-39.9 1.8l-256 224c-10 8.8-13.6 22.9-8.9 35.3S50.7 288 64 288H175.5L98.6 467.4c-5.9 13.7-1.5 29.7 10.6 38.5s28.6 8 39.9-1.8l256-224c10-8.8 13.6-22.9 8.9-35.3s-16.6-20.7-30-20.7H272.5L349.4 44.6z"/></svg>',
            failure: '<svg width="18" height="18" viewBox="0 0 448 512" fill="currentColor"><path d="M349.4 44.6c5.9-13.7 1.5-29.7-10.6-38.5s-28.6-8-39.9 1.8l-256 224c-10 8.8-13.6 22.9-8.9 35.3S50.7 288 64 288H175.5L98.6 467.4c-5.9 13.7-1.5 29.7 10.6 38.5s28.6 8 39.9-1.8l256-224c10-8.8 13.6-22.9 8.9-35.3s-16.6-20.7-30-20.7H272.5L349.4 44.6z"/></svg>',
            bug: '<svg width="18" height="18" viewBox="0 0 448 512" fill="currentColor"><path d="M349.4 44.6c5.9-13.7 1.5-29.7-10.6-38.5s-28.6-8-39.9 1.8l-256 224c-10 8.8-13.6 22.9-8.9 35.3S50.7 288 64 288H175.5L98.6 467.4c-5.9 13.7-1.5 29.7 10.6 38.5s28.6 8 39.9-1.8l256-224c10-8.8 13.6-22.9 8.9-35.3s-16.6-20.7-30-20.7H272.5L349.4 44.6z"/></svg>',
            warning: '<svg width="18" height="18" viewBox="0 0 448 512" fill="currentColor"><path d="M349.4 44.6c5.9-13.7 1.5-29.7-10.6-38.5s-28.6-8-39.9 1.8l-256 224c-10 8.8-13.6 22.9-8.9 35.3S50.7 288 64 288H175.5L98.6 467.4c-5.9 13.7-1.5 29.7 10.6 38.5s28.6 8 39.9-1.8l256-224c10-8.8 13.6-22.9 8.9-35.3s-16.6-20.7-30-20.7H272.5L349.4 44.6z"/></svg>',
            caution: '<svg width="18" height="18" viewBox="0 0 448 512" fill="currentColor"><path d="M349.4 44.6c5.9-13.7 1.5-29.7-10.6-38.5s-28.6-8-39.9 1.8l-256 224c-10 8.8-13.6 22.9-8.9 35.3S50.7 288 64 288H175.5L98.6 467.4c-5.9 13.7-1.5 29.7 10.6 38.5s28.6 8 39.9-1.8l256-224c10-8.8 13.6-22.9 8.9-35.3s-16.6-20.7-30-20.7H272.5L349.4 44.6z"/></svg>',
            attention: '<svg width="18" height="18" viewBox="0 0 448 512" fill="currentColor"><path d="M349.4 44.6c5.9-13.7 1.5-29.7-10.6-38.5s-28.6-8-39.9 1.8l-256 224c-10 8.8-13.6 22.9-8.9 35.3S50.7 288 64 288H175.5L98.6 467.4c-5.9 13.7-1.5 29.7 10.6 38.5s28.6 8 39.9-1.8l256-224c10-8.8 13.6-22.9 8.9-35.3s-16.6-20.7-30-20.7H272.5L349.4 44.6z"/></svg>',
            // Example - Code brackets  
            example: '<svg width="18" height="18" viewBox="0 0 512 512" fill="currentColor" style="transform: rotate(90deg)"><path d="M260.353,254.878,131.538,33.1a2.208,2.208,0,0,0-3.829.009L.3,254.887A2.234,2.234,0,0,0,.3,257.122L129.116,478.9a2.208,2.208,0,0,0,3.83-.009L260.358,257.113A2.239,2.239,0,0,0,260.353,254.878Zm39.078-25.713a2.19,2.19,0,0,0,1.9,1.111h66.509a2.226,2.226,0,0,0,1.9-3.341L259.115,33.111a2.187,2.187,0,0,0-1.9-1.111H190.707a2.226,2.226,0,0,0-1.9,3.341ZM511.7,254.886,384.9,33.112A2.2,2.2,0,0,0,382.99,32h-66.6a2.226,2.226,0,0,0-1.906,3.34L440.652,256,314.481,476.66a2.226,2.226,0,0,0,1.906,3.34h66.6a2.2,2.2,0,0,0,1.906-1.112L511.7,257.114A2.243,2.243,0,0,0,511.7,254.886ZM366.016,284.917H299.508a2.187,2.187,0,0,0-1.9,1.111l-108.8,190.631a2.226,2.226,0,0,0,1.9,3.341h66.509a2.187,2.187,0,0,0,1.9-1.111l108.8-190.631A2.226,2.226,0,0,0,366.016,284.917Z"/></svg>',
            // Task / Todo - File with code
            task: '<svg width="18" height="18" viewBox="0 0 384 512" fill="currentColor"><path d="M64 464c-8.8 0-16-7.2-16-16V64c0-8.8 7.2-16 16-16H224v80c0 17.7 14.3 32 32 32h80V448c0 8.8-7.2 16-16 16H64zM64 0C28.7 0 0 28.7 0 64V448c0 35.3 28.7 64 64 64H320c35.3 0 64-28.7 64-64V154.5c0-17-6.7-33.3-18.7-45.3L274.7 18.7C262.7 6.7 246.5 0 229.5 0H64zm97 289c9.4-9.4 9.4-24.6 0-33.9s-24.6-9.4-33.9 0L79 303c-9.4 9.4-9.4 24.6 0 33.9l48 48c9.4 9.4 24.6 9.4 33.9 0s9.4-24.6 0-33.9l-31-31 31-31zM257 255c-9.4-9.4-24.6-9.4-33.9 0s-9.4 24.6 0 33.9l31 31-31 31c-9.4 9.4-9.4 24.6 0 33.9s24.6 9.4 33.9 0l48-48c9.4-9.4 9.4-24.6 0-33.9l-48-48z"/></svg>',
            todo: '<svg width="18" height="18" viewBox="0 0 384 512" fill="currentColor"><path d="M64 464c-8.8 0-16-7.2-16-16V64c0-8.8 7.2-16 16-16H224v80c0 17.7 14.3 32 32 32h80V448c0 8.8-7.2 16-16 16H64zM64 0C28.7 0 0 28.7 0 64V448c0 35.3 28.7 64 64 64H320c35.3 0 64-28.7 64-64V154.5c0-17-6.7-33.3-18.7-45.3L274.7 18.7C262.7 6.7 246.5 0 229.5 0H64zm97 289c9.4-9.4 9.4-24.6 0-33.9s-24.6-9.4-33.9 0L79 303c-9.4 9.4-9.4 24.6 0 33.9l48 48c9.4 9.4 24.6 9.4 33.9 0s9.4-24.6 0-33.9l-31-31 31-31zM257 255c-9.4-9.4-24.6-9.4-33.9 0s-9.4 24.6 0 33.9l31 31-31 31c-9.4 9.4-9.4 24.6 0 33.9s24.6 9.4 33.9 0l48-48c9.4-9.4 9.4-24.6 0-33.9l-48-48z"/></svg>',
            // Success / Check - Checkmark
            success: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>',
            check: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>',
            done: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>',
            // Quote / Cite
            quote: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>',
            cite: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>'
        };
        
        const iconSvg = iconSvgMap[cleanType.toLowerCase()] || iconSvgMap.note;
        
        return `
            <div class="callout callout-${cleanType.toLowerCase()}${isFoldable ? ' is-collapsible' : ''}" data-collapsible="${isFoldable}">
                <div class="callout-title">
                    <div class="callout-icon">${iconSvg}</div>
                    <div class="callout-title-inner">${title}</div>
                    ${isFoldable ? '<div class="callout-fold"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg></div>' : ''}
                </div>
                <div class="callout-content"><p>${contentBody}</p></div>
            </div>
        `;
        }
        
        // Strip blockquote markers
        let processed = md.replace(/^>\s?/gm, '');
        
        // Basic Headers
        processed = processed.replace(/^### (.*$)/gm, '<h3>$1</h3>');
        processed = processed.replace(/^## (.*$)/gm, '<h2>$1</h2>');
        processed = processed.replace(/^# (.*$)/gm, '<h1>$1</h1>');

        // Simple line breaks for non-headers
        processed = processed.replace(/\n/g, '<br>');
        
        return processed;
    };

    const _setupInteractions = (container: HTMLElement) => {
            container.addEventListener('click', async (e) => {
                const target = e.target as HTMLElement;
                const btn = target.closest('.copy-code-btn');
                
                if (btn) {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    const wrapper = btn.closest('.code-block-wrapper');
                    if (wrapper) {
                        const contentDiv = wrapper.querySelector('.code-block-content');
                        if (contentDiv) {
                            const text = contentDiv.textContent || '';
                            try {
                                await navigator.clipboard.writeText(text);
                                const originalHtml = btn.innerHTML;
                                const checkIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-check"><path d="M20 6 9 17l-5-5"/></svg>';
                                btn.innerHTML = checkIcon;
                                (btn as HTMLElement).style.color = '#4ade80';
                                setTimeout(() => {
                                    btn.innerHTML = originalHtml;
                                    (btn as HTMLElement).style.color = '#b0b0b0';
                                }, 2000);
                            } catch (err) {
                                console.error('Copy failed:', err);
                            }
                        }
                    }
                }

                // Handle collapsible callout toggle
                const calloutTitle = target.closest('.callout-title');
                if (calloutTitle) {
                    const callout = calloutTitle.closest('.callout[data-collapsible="true"]');
                    if (callout) {
                        e.stopPropagation();
                        callout.classList.toggle('is-collapsed');
                    }
                }
            });

            // Markdown code fence detection - detect ```lang...``` and convert to code block
            container.addEventListener('input', (e) => {
                const target = e.target as HTMLElement;
                // Only process if we're typing in a text node or paragraph
                if (!target.closest('.code-block-wrapper')) {
                    const selection = window.getSelection();
                    if (!selection || selection.rangeCount === 0) return;
                    
                    const range = selection.getRangeAt(0);
                    const textNode = range.startContainer;
                    if (textNode.nodeType !== Node.TEXT_NODE) return;
                    
                    const text = textNode.textContent || '';
                    // Match opening ``` with optional language, content, and closing ```
                    const codeFenceRegex = /```(\w*)\n([\s\S]*?)```/;
                    const match = text.match(codeFenceRegex);
                    
                    if (match) {
                        const language = match[1] || 'plaintext';
                        const codeContent = match[2].trim();
                        const fullMatch = match[0];
                        
                        // Create code block HTML
                        const codeBlockHtml = `<pre><div class="code-block-wrapper" data-language="${language}" style="position: relative;"><div class="code-block-content">${codeContent.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div></div></pre>`;
                        
                        // Find the parent element to replace content in
                        const parentEl = textNode.parentElement;
                        if (parentEl) {
                            const beforeText = text.substring(0, text.indexOf(fullMatch));
                            const afterText = text.substring(text.indexOf(fullMatch) + fullMatch.length);
                            
                            // Create a temporary container for the new content
                            const tempDiv = document.createElement('div');
                            tempDiv.innerHTML = beforeText + codeBlockHtml + afterText;
                            
                            // Replace textNode content with the HTML
                            const fragment = document.createDocumentFragment();
                            while (tempDiv.firstChild) {
                                fragment.appendChild(tempDiv.firstChild);
                            }
                            
                            // Replace the text node with our new content
                            const parentOfText = textNode.parentNode;
                            if (parentOfText) {
                                parentOfText.replaceChild(fragment, textNode);
                            }
                        }
                    }
                }
            });
    };

    const _setupResize = (container: HTMLElement) => {
        // Make resizable elements
        const makeResizable = (element: HTMLElement) => {
            // Skip if already has resize handles or is inside code block content
            if (element.querySelector('.resize-handle')) return;
            if (element.closest('.code-block-content')) return;
            if (element.classList.contains('resize-handle')) return;
            
            // Create resize handles - all corners and edges
            const handles = ['nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w'];
            handles.forEach(pos => {
                const handle = document.createElement('div');
                handle.className = `resize-handle handle-${pos}`;
                handle.dataset.handle = pos;
                handle.contentEditable = 'false';
                element.appendChild(handle);
            });
            
            element.style.position = 'relative';
            element.classList.add('resizable');
        };
        
        // Apply resize to ALL block elements that could be resized
        const applyResizeToElements = () => {
            // Comprehensive selector for all resizable elements
            const resizableSelector = [
                '.media-wrapper',
                '.callout',
                '.code-block-wrapper',
                'table',
                'blockquote:not(.callout)',
                'button',
                '.flex-row',
                '.flex-col',
                '.grid-cell',
                'div[style*="background"]',
                'div[style*="border"]',
                'div[style*="padding"]'
            ].join(', ');
            
            container.querySelectorAll(resizableSelector).forEach(el => {
                const htmlEl = el as HTMLElement;
                // Don't add handles to elements inside other resizable elements
                if (!htmlEl.closest('.resizable') || htmlEl.classList.contains('callout') || htmlEl.classList.contains('code-block-wrapper') || htmlEl.classList.contains('grid-cell')) {
                    makeResizable(htmlEl);
                }
            });
        };
        
        // Initial setup
        applyResizeToElements();
        
        // Resize state
        let isResizing = false;
        let currentElement: HTMLElement | null = null;
        let currentHandle = '';
        let startX = 0;
        let startY = 0;
        let startWidth = 0;
        let startHeight = 0;
        
        // Mouse down on handle
        container.addEventListener('mousedown', (e) => {
            const target = e.target as HTMLElement;
            if (target.classList.contains('resize-handle')) {
                e.preventDefault();
                e.stopPropagation();
                
                currentHandle = target.dataset.handle || 'se';
                currentElement = target.parentElement as HTMLElement;
                
                if (!currentElement) return;
                
                isResizing = true;
                startX = e.clientX;
                startY = e.clientY;
                startWidth = currentElement.offsetWidth;
                startHeight = currentElement.offsetHeight;
                
                // Freeze siblings in flex row so they don't deform
                const parent = currentElement.parentElement;
                if (parent && parent.classList.contains('flex-row')) {
                    Array.from(parent.children).forEach(child => {
                        const el = child as HTMLElement;
                        if (el !== currentElement && (el.classList.contains('resizable') || el.classList.contains('callout') || el.classList.contains('media-wrapper'))) {
                            if (el.style.flex !== 'none') {
                                // Freeze their current computed width
                                el.style.width = `${el.offsetWidth}px`;
                                el.style.flex = 'none';
                            }
                        }
                    });
                }
                
                currentElement.classList.add('resizing');
                document.body.style.cursor = getComputedStyle(target).cursor;
                document.body.style.userSelect = 'none';
            }
        });
        
        // Mouse move for resize
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing || !currentElement) return;
            
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            
            let newWidth = startWidth;
            let newHeight = startHeight;
            
            const minSize = 30;
            
            // Handle all resize directions
            switch(currentHandle) {
                case 'e':
                     newWidth = Math.max(minSize, startWidth + dx);
                     break;
                case 'w':
                     newWidth = Math.max(minSize, startWidth - dx);
                     break;
                case 's':
                     newHeight = Math.max(minSize, startHeight + dy);
                     break;
                case 'n':
                     newHeight = Math.max(minSize, startHeight - dy);
                     break;
                case 'se':
                     newWidth = Math.max(minSize, startWidth + dx);
                     newHeight = Math.max(minSize, startHeight + dy);
                     break;
                case 'sw':
                     newWidth = Math.max(minSize, startWidth - dx);
                     newHeight = Math.max(minSize, startHeight + dy);
                     break;
                case 'ne':
                     newWidth = Math.max(minSize, startWidth + dx);
                     newHeight = Math.max(minSize, startHeight - dy);
                     break;
                case 'nw':
                     newWidth = Math.max(minSize, startWidth - dx);
                     newHeight = Math.max(minSize, startHeight - dy);
                     break;
            }
            
            // For images and videos, maintain aspect ratio when using corner handles
            if ((currentElement.tagName === 'IMG' || currentElement.tagName === 'VIDEO' || currentElement.classList.contains('media-wrapper')) && 
                ['se', 'sw', 'ne', 'nw'].includes(currentHandle)) {
                const aspectRatio = startWidth / startHeight;
                // Use the larger delta to determine size
                if (Math.abs(dx) > Math.abs(dy)) {
                    newHeight = newWidth / aspectRatio;
                } else {
                    newWidth = newHeight * aspectRatio;
                }
            }
            
            // Apply dimensions
            if (['e', 'w', 'se', 'sw', 'ne', 'nw'].includes(currentHandle)) {
                if (currentElement.classList.contains('grid-cell')) {
                    const parent = currentElement.parentElement;
                    if (parent && parent.classList.contains('dashboard-grid')) {
                        const colWidth = parent.offsetWidth / 12;
                        const span = Math.max(1, Math.min(12, Math.round(newWidth / colWidth)));
                        currentElement.style.gridColumn = `span ${span}`;
                        currentElement.style.width = ''; // remove absolute width
                    } else {
                        currentElement.style.width = `${newWidth}px`;
                    }
                } else {
                    currentElement.style.width = `${newWidth}px`;
                }
            }
            
            // Only apply height for elements that need it
            if (['s', 'n', 'se', 'sw', 'ne', 'nw'].includes(currentHandle)) {
                currentElement.style.height = `${newHeight}px`;
            }
            
            // For images - ensure they don't use max-width 100%
            if (currentElement.tagName === 'IMG' || currentElement.tagName === 'VIDEO' || currentElement.classList.contains('media-wrapper')) {
                currentElement.style.maxWidth = 'none';
            }
            
            // Override flex properties if inside a flex container to allow manual sizing
            currentElement.style.flex = 'none';
            
            // Keep element in document flow (don't use position:absolute)
            currentElement.style.boxSizing = 'border-box';
        };
        
        document.addEventListener('mousemove', handleMouseMove);
        
        // Mouse up - finish resize
        const handleMouseUp = () => {
            if (isResizing && currentElement) {
                currentElement.classList.remove('resizing');
                isResizing = false;
                currentElement = null;
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
            }
        };
        
        document.addEventListener('mouseup', handleMouseUp);
        
        // Re-apply resize handles when content changes (MutationObserver)
        const observer = new MutationObserver(() => {
            applyResizeToElements();
        });
        
        observer.observe(container, { childList: true, subtree: true });
        
        // Return cleanup function
        return () => {
            observer.disconnect();
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    };

    const _setupDragAndDrop = (container: HTMLElement) => {
            let draggedItem: HTMLElement | null = null;
            let indicator: HTMLElement | null = null;
            
            // Get filePath from window (set by Preview component)
            const getCurrentFilePath = () => (window as any).__currentFilePath || '';
            
            // Interaction State
            let targetElement: HTMLElement | null = null;
            let insertionType: 'before' | 'after' | 'left' | 'right' | 'inside' | null = null;

            // Visual Indicator
            const createIndicator = () => {
                if (!indicator) {
                    indicator = document.createElement('div');
                    indicator.className = 'drop-indicator';
                    document.body.appendChild(indicator);
                }
            };

            const updateIndicator = (rect: DOMRect, type: 'before' | 'after' | 'left' | 'right') => {
                if (!indicator) createIndicator();
                if (!indicator) return;

                indicator.style.display = 'block';
                
                // Reset dimensions and background
                indicator.style.width = '';
                indicator.style.height = '';
                indicator.style.backgroundColor = '';
                
                if (type === 'before') { // Top
                    indicator.style.top = `${rect.top - 2}px`;
                    indicator.style.left = `${rect.left}px`;
                    indicator.style.width = `${rect.width}px`;
                    indicator.style.height = '4px';
                } else if (type === 'after') { // Bottom
                    indicator.style.top = `${rect.bottom - 2}px`;
                    indicator.style.left = `${rect.left}px`;
                    indicator.style.width = `${rect.width}px`;
                    indicator.style.height = '4px';
                } else if (type === 'left') {
                    indicator.style.top = `${rect.top}px`;
                    indicator.style.left = `${rect.left - 2}px`;
                    indicator.style.height = `${rect.height}px`;
                    indicator.style.width = '4px';
                } else if (type === 'right') {
                    indicator.style.top = `${rect.top}px`;
                    indicator.style.left = `${rect.right - 2}px`;
                    indicator.style.height = `${rect.height}px`;
                    indicator.style.width = '4px';
                }
            };

            const clearVisuals = () => {
               if (indicator) indicator.style.display = 'none';
               targetElement = null;
               insertionType = null;
            };

            // Recursively make elements draggable
            const makeDraggable = (root: HTMLElement) => {
                const significantSelector = 'p, h1, h2, h3, h4, h5, h6, ul, ol, li, img, button, table, blockquote, .callout, pre, .code-block-wrapper, .flex-row, .flex-col, .dashboard-grid, .grid-cell';
                
                const processNode = (child: any) => {
                    if (!child || !child.tagName) return;
                    if (child.tagName === 'SCRIPT' || child.tagName === 'STYLE') return;
                    if (child.closest && child.closest('.code-block-content')) return; 
                    if (child.parentElement && child.parentElement.closest('.callout') && !child.classList.contains('callout')) return; 

                    if (!child.classList.contains('draggable-block')) {
                        child.classList.add('draggable-block');
                        
                        child.addEventListener('mouseenter', (e: MouseEvent) => {
                            if (container.contentEditable === 'true' && !draggedItem) {
                                e.stopPropagation();
                                
                                // Remove old hover handle if exists
                                const oldHandle = container.querySelector('.hover-drag-handle');
                                if (oldHandle) oldHandle.remove();

                                // Add new handle
                                const handle = document.createElement('div');
                                handle.className = 'custom-drag-handle hover-drag-handle';
                                handle.contentEditable = 'false';
                                handle.draggable = true;
                                Object.assign(handle.style, {
                                    position: 'absolute',
                                    right: '8px',
                                    top: '8px',
                                    width: '32px',
                                    height: '32px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'grab',
                                    color: '#ffffff',
                                    borderRadius: '6px',
                                    userSelect: 'none',
                                    zIndex: '10',
                                    backgroundColor: 'var(--interactive-accent)',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                                    opacity: '1',
                                    transition: 'all 0.2s ease'
                                });
                                handle.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 5h.01M9 12h.01M9 19h.01M15 5h.01M15 12h.01M15 19h.01"/></svg>';
                                handle.addEventListener('mouseenter', () => {
                                    handle.style.transform = 'scale(1.1)';
                                    handle.style.backgroundColor = '#2ecc71';
                                    handle.style.boxShadow = '0 0 15px rgba(46, 204, 113, 0.8)';
                                });
                                handle.addEventListener('mouseleave', () => {
                                    handle.style.transform = 'scale(1)';
                                    handle.style.backgroundColor = 'var(--interactive-accent)';
                                    handle.style.boxShadow = '0 4px 12px rgba(0,0,0,0.4)';
                                });
                                
                                if (window.getComputedStyle(child).position === 'static') {
                                    child.style.position = 'relative';
                                }
                                child.appendChild(handle);
                            }
                        });
                        child.addEventListener('mouseleave', (e: MouseEvent) => {
                            const handle = child.querySelector('.hover-drag-handle');
                            if (handle && (!e.relatedTarget || !child.contains(e.relatedTarget as Node))) {
                                handle.remove();
                            }
                        });
                    }
                };

                const elements = root.querySelectorAll(significantSelector);
                Array.from(elements).forEach(processNode);

                const dragObserver = new MutationObserver((mutations) => {
                    mutations.forEach(mutation => {
                        mutation.addedNodes.forEach((node: any) => {
                            if (node.nodeType === Node.ELEMENT_NODE) {
                                if (node.matches && node.matches(significantSelector)) {
                                    processNode(node);
                                }
                                if (node.querySelectorAll) {
                                    const nested = node.querySelectorAll(significantSelector);
                                    if (nested.length > 0) {
                                        Array.from(nested).forEach(processNode);
                                    }
                                }
                            }
                        });
                    });
                });
                
                dragObserver.observe(root, { childList: true, subtree: true });
                return dragObserver;
            };

            // Initial setup and observer
            const dragObserver = makeDraggable(container);

            const onDragStart = (e: any) => {
                if (container.contentEditable !== 'true') return;
                let target = e.target as HTMLElement;
                if (target.classList.contains('custom-drag-handle')) {
                    draggedItem = target.parentElement as HTMLElement;
                } else {
                    draggedItem = target.closest('.draggable-block') as HTMLElement || target;
                }
                
                if (!draggedItem) return;
                
                // Smart Selection
                const wrapper = draggedItem.closest('.callout, .code-block-wrapper, .flex-row');
                if (wrapper && container.contains(wrapper) && wrapper !== container) {
                     draggedItem = wrapper as HTMLElement;
                }

                draggedItem.classList.add('sortable-dragging');
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', '');
                e.stopPropagation();
            };

            const onDragEnd = () => {
                 if (draggedItem) draggedItem.classList.remove('sortable-dragging');
                 clearVisuals();
                 draggedItem = null;
                 makeDraggable(container);
            };

            const onDragOver = (e: any) => {
                e.preventDefault();
                e.stopPropagation();

                const target = e.target as HTMLElement;
                
                // Find best target block
                let block = target.closest('.draggable-block') as HTMLElement;
                const dropContainer = target.closest('.grid-cell, .callout, blockquote, td, th') as HTMLElement;

                let min = 0, distTop = 0, distBottom = 0, distLeft = 0, distRight = 0;
                let rect: DOMRect | null = null;
                if (block) {
                    rect = block.getBoundingClientRect();
                    const x = e.clientX;
                    const y = e.clientY;
                    distTop = Math.abs(y - rect.top);
                    distBottom = Math.abs(y - rect.bottom);
                    distLeft = Math.abs(x - rect.left);
                    distRight = Math.abs(x - rect.right);
                    min = Math.min(distTop, distBottom, distLeft, distRight);
                }

                if (dropContainer) {
                    const isBlockOutsideContainer = block && !dropContainer.contains(block);
                    if (!block || isBlockOutsideContainer || (dropContainer === block && min > 15)) {
                        // Drop inside the container
                        targetElement = dropContainer;
                        insertionType = 'inside';
                        
                        if (!indicator) createIndicator();
                        if (indicator) {
                             indicator.style.display = 'block';
                             indicator.style.top = `${dropContainer.getBoundingClientRect().top}px`;
                             indicator.style.left = `${dropContainer.getBoundingClientRect().left}px`;
                             indicator.style.width = `${dropContainer.offsetWidth}px`;
                             indicator.style.height = `${dropContainer.offsetHeight}px`;
                             indicator.style.backgroundColor = 'rgba(68, 138, 255, 0.2)'; // Highlight color
                        }
                        return;
                    }
                }
                
                if (block && (!draggedItem || !block.contains(draggedItem)) && block !== draggedItem) {
                    targetElement = block;
                    
                    if (min === distTop) insertionType = 'before';
                    else if (min === distBottom) insertionType = 'after';
                    else if (min === distLeft) insertionType = 'left';
                    else insertionType = 'right';

                    updateIndicator(rect as DOMRect, insertionType);
                } else if (!block && target.closest('.design-mode-container')) {
                    // Only look at top-level blocks to avoid selecting inner cells
                    const topLevelBlocks = Array.from(container.children).filter(child => child.classList.contains('draggable-block'));
                    if (topLevelBlocks.length > 0) {
                        let closestBlock: HTMLElement | null = null;
                        let closestDist = Infinity;
                        let bestType: 'before' | 'after' = 'after';

                        topLevelBlocks.forEach(child => {
                             const childRect = (child as HTMLElement).getBoundingClientRect();
                             const dTop = Math.abs(e.clientY - childRect.top);
                             const dBottom = Math.abs(e.clientY - childRect.bottom);
                             
                             if (dTop < closestDist) {
                                 closestDist = dTop;
                                 closestBlock = child as HTMLElement;
                                 bestType = 'before';
                             }
                             if (dBottom < closestDist) {
                                 closestDist = dBottom;
                                 closestBlock = child as HTMLElement;
                                 bestType = 'after';
                             }
                        });

                        if (closestBlock) {
                            targetElement = closestBlock;
                            insertionType = bestType;
                            updateIndicator((closestBlock as HTMLElement).getBoundingClientRect(), bestType);
                        }
                    } else {
                        targetElement = container;
                        insertionType = 'inside';
                        if (!indicator) createIndicator();
                        if (indicator) {
                             indicator.style.display = 'block';
                             const containerRect = container.getBoundingClientRect();
                             indicator.style.top = `${containerRect.top + 10}px`;
                             indicator.style.left = `${containerRect.left + 10}px`;
                             indicator.style.width = `${containerRect.width - 20}px`;
                             indicator.style.height = '4px';
                             indicator.style.backgroundColor = 'var(--interactive-accent)';
                        }
                    }
                } else {
                    clearVisuals();
                }
            };

            const onDragLeave = () => {
                 // only clear if leaving window or container really far?
                 // relying on dragover to clear works better usually
            };

            const onDrop = async (e: any) => {
                e.preventDefault();
                e.stopPropagation();
                
                if (indicator) indicator.style.display = 'none';

                let itemToDrop = draggedItem;

                // Handle files dropped from OS (images/videos)
                const files = e.dataTransfer?.files as FileList;
                if (files && files.length > 0 && !draggedItem) {
                    for (const file of Array.from(files)) {
                        const isImage = file.type.startsWith('image/');
                        const isVideo = file.type.startsWith('video/');
                        
                        if ((isImage || isVideo) && (file as any).path) {
                            try {
                                // Get base directory from filePath
                                const currentFilePath = getCurrentFilePath();
                                // Normalize path separators
                                const normalizedPath = currentFilePath.replace(/\\/g, '/');
                                const baseDir = normalizedPath.substring(0, normalizedPath.lastIndexOf('/'));
                                const assetsDir = `${baseDir}/assets`;
                                const newName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
                                const destPath = `${assetsDir}/${newName}`;
                                
                                console.log('Copying file to:', destPath);
                                
                                // Copy file to assets folder
                                await window.electronAPI.copyFile((file as any).path, destPath);
                                
                                // Create media element with proper file:// URL
                                const fileUrl = `file:///${destPath.replace(/\\/g, '/')}`;
                                console.log('Image URL:', fileUrl);
                                
                                if (isVideo) {
                                     const wrapper = document.createElement('div');
                                     wrapper.className = 'media-wrapper resizable';
                                     wrapper.style.display = 'inline-block';
                                     wrapper.style.maxWidth = '100%';
                                     
                                     const videoEl = document.createElement('video');
                                     videoEl.src = fileUrl;
                                     videoEl.setAttribute('controls', 'true');
                                     videoEl.style.width = '100%';
                                     videoEl.style.height = '100%';
                                     videoEl.style.display = 'block';
                                     videoEl.style.borderRadius = '4px';
                                     
                                     wrapper.appendChild(videoEl);
                                     itemToDrop = wrapper;
                                 } else {
                                     const wrapper = document.createElement('div');
                                     wrapper.className = 'media-wrapper resizable';
                                     wrapper.style.display = 'inline-block';
                                     wrapper.style.maxWidth = '100%';
                                     
                                     const imgEl = document.createElement('img');
                                     imgEl.src = fileUrl;
                                     imgEl.style.width = '100%';
                                     imgEl.style.height = '100%';
                                     imgEl.style.display = 'block';
                                     
                                     wrapper.appendChild(imgEl);
                                     itemToDrop = wrapper;
                                 }
                                
                                // Trigger file explorer refresh
                                if ((window as any).__previewOnRefresh) {
                                    (window as any).__previewOnRefresh();
                                }
                            } catch (err) {
                                console.error('Failed to copy media file:', err);
                            }
                        }
                    }
                }

                // Handle files dragged from internal file explorer
                if (!itemToDrop) {
                    const internalMediaPath = e.dataTransfer?.getData('application/x-media-path');
                    if (internalMediaPath) {
                        // Normalize path and create file URL
                        const normalizedPath = internalMediaPath.replace(/\\/g, '/');
                        const fileUrl = `file:///${normalizedPath}`;
                        
                        // Check if it's a video or image
                        const isVideo = /\.(mp4|webm|ogv|mkv|mov|avi)$/i.test(internalMediaPath);
                        
                        if (isVideo) {
                            const videoEl = document.createElement('video');
                            videoEl.src = fileUrl;
                            videoEl.setAttribute('controls', 'true');
                            videoEl.style.maxWidth = '100%';
                            itemToDrop = videoEl;
                        } else {
                            const imgEl = document.createElement('img');
                            imgEl.src = fileUrl;
                            imgEl.style.maxWidth = '100%';
                            imgEl.alt = '';
                            itemToDrop = imgEl;
                        }
                    }
                }

                // Handle External Drop (templates or text)
                if (!itemToDrop) {
                    const content = (window as any).__draggingTemplateContent || e.dataTransfer.getData('text/plain');
                    if (content) {
                         const newHtml = markdownToHtmlHelper(content);
                         const tempDiv = document.createElement('div');
                         tempDiv.innerHTML = newHtml;

                         const nodes = Array.from(tempDiv.children) as HTMLElement[];
                         if (nodes.length === 1) itemToDrop = nodes[0];
                         else {
                             // Wrap multiple items if needed, or just append first?
                             // For simplicity, let's wrap in a div if multiple
                             const wrapper = document.createElement('div');
                             nodes.forEach(n => wrapper.appendChild(n));
                             itemToDrop = wrapper;
                         }
                         (window as any).__draggingTemplateContent = null;
                    }
                }

                if (itemToDrop && targetElement && insertionType) {
                    // Prevent circular DOM manipulation - can't drop parent on child
                    if (itemToDrop.contains(targetElement)) {
                        // Invalid drop - the item we're dropping contains the target
                        clearVisuals();
                        if (draggedItem) {
                            draggedItem.classList.remove('sortable-dragging');
                            draggedItem.style.opacity = '';
                        }
                        draggedItem = null;
                        return;
                    }
                    
                    if (insertionType === 'inside') {
                        // Clear the cell if it only contains the placeholder text or is empty
                        let containerToAppend = targetElement;
                        if (targetElement.classList.contains('callout')) {
                            const content = targetElement.querySelector('.callout-content');
                            if (content) containerToAppend = content as HTMLElement;
                        }
                        containerToAppend.appendChild(itemToDrop);
                    }
                    else if (insertionType === 'before') {
                        targetElement.before(itemToDrop);
                    } 
                    else if (insertionType === 'after') {
                        targetElement.after(itemToDrop);
                    }
                    else if (insertionType === 'left' || insertionType === 'right') {
                        // Auto-Column Creation
                        const parent = targetElement.parentElement;
                        
                        // Check if already in a flex row
                        if (parent && parent.classList.contains('flex-row')) {
                            if (itemToDrop instanceof HTMLElement) {
                                // If item doesn't have an explicit flex or width set, give it flex-1
                                if (!itemToDrop.style.flex && !itemToDrop.style.width) {
                                    itemToDrop.style.flex = '1 1 0%';
                                    itemToDrop.style.minWidth = '0px';
                                }
                            }
                            if (insertionType === 'left') targetElement.before(itemToDrop);
                            else targetElement.after(itemToDrop);
                        } else {
                            // Create new Flex Row wrapper
                            const row = document.createElement('div');
                            row.className = 'flex-row';
                            row.style.display = 'flex';
                            row.style.gap = '16px';
                            row.style.width = '100%';
                            row.style.alignItems = 'flex-start'; // Top align usually best

                            targetElement.replaceWith(row);
                            
                            // Ensure items have flex-1
                            targetElement.style.flex = '1 1 0%';
                            targetElement.style.minWidth = '0px';
                            
                            if (itemToDrop instanceof HTMLElement) {
                                itemToDrop.style.flex = '1 1 0%';
                                itemToDrop.style.minWidth = '0px';
                            }

                            if (insertionType === 'left') {
                                row.appendChild(itemToDrop);
                                row.appendChild(targetElement);
                            } else {
                                row.appendChild(targetElement);
                                row.appendChild(itemToDrop);
                            }
                        }
                    }
                } else if (itemToDrop && !targetElement && itemToDrop !== draggedItem) {
                    // Only append to end if it's a NEW external item (template/file), 
                    // NOT an existing element being re-dragged
                    container.appendChild(itemToDrop);
                }
                // If draggedItem was dropped without a valid target, it stays in place (no action needed)
                
                
                if (draggedItem) {
                    draggedItem.classList.remove('sortable-dragging');
                    draggedItem.style.opacity = '';
                }
                makeDraggable(container);
                draggedItem = null;
                clearVisuals();
            };

            container.addEventListener('dragstart', onDragStart);
            container.addEventListener('dragend', onDragEnd);
            container.addEventListener('dragover', onDragOver);
            container.addEventListener('dragenter', (e) => e.preventDefault());
            container.addEventListener('dragleave', onDragLeave);
            container.addEventListener('drop', onDrop);

            return () => {
                 container.removeEventListener('dragstart', onDragStart);
                 container.removeEventListener('dragend', onDragEnd);
                 container.removeEventListener('dragover', onDragOver);
                 container.removeEventListener('dragleave', onDragLeave);
                 container.removeEventListener('drop', onDrop);
                 if (indicator) indicator.remove();
                 if (dragObserver) dragObserver.disconnect();
            };
    };

    interface PreviewProps {
        content: string;
        filePath: string;
        allFiles: string[];
        onFileSelect: (file: string) => void;
        onNavigateLink?: (linkText: string) => void;
        onTagClick?: (tag: string) => void;
        designMode?: boolean;
        onRegisterSave?: (saveFn: () => string) => void;
        onAutoSave?: (content: string) => void;
        selectedBlocks?: HTMLElement[];
        onSelectBlocks?: (blocks: HTMLElement[]) => void;
        rootPath?: string;
        onRefresh?: () => void;
        activeSourcePos?: string | null;
        onSelectSourcePos?: (pos: string | null) => void;
    }

    export default function Preview({ content, filePath, allFiles, onFileSelect, designMode = false, onRegisterSave, onAutoSave, selectedBlocks, onSelectBlocks, rootPath: _rootPath, onRefresh, activeSourcePos, onSelectSourcePos }: PreviewProps) {

    const editableRef = useRef<HTMLDivElement>(null);
    const previewRef = useRef<HTMLDivElement>(null);
    const dndCleanupRef = useRef<(() => void) | null>(null);
    const resizeCleanupRef = useRef<(() => void) | null>(null);
    const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const mutationObserverRef = useRef<MutationObserver | null>(null);
    const lastSavedContentRef = useRef<string>(content);
    
    // Fix paths to assets
    const fixedContent = fixPaths(content, _rootPath || '');
    
    // We use the prop 'selectedBlock' if available, otherwise we could track locally but App.tsx handles it now.
// const [selectedBlock, setSelectedBlock] = useState<HTMLElement | null>(null);

    // Keep activeSourcePos in a ref so we can always access the latest value
    // without it being a stale closure issue inside layout effects
    const activeSourcePosRef = useRef<string | null | undefined>(activeSourcePos);
    activeSourcePosRef.current = activeSourcePos;

    // Track whether we need to scroll on the next highlight application
    const needsScrollRef = useRef<boolean>(false);

    // When activeSourcePos changes (new click from editor or preview), mark that we need scroll
    useEffect(() => {
        needsScrollRef.current = true;
    }, [activeSourcePos]);

    // Helper: find best element for a given sourcePos string
    const findBestElement = (root: HTMLElement, sourcePos: string): Element | null => {
        // 1. Try exact match first
        let best = root.querySelector(`[data-sourcepos="${sourcePos}"]`);
        if (best) return best;

        // 2. Fallback to line range logic
        const lineStr = sourcePos.split('-')[0];
        const line = parseInt(lineStr.split(':')[0] || lineStr, 10);
        if (isNaN(line)) return null;

        let bestRangeSize = Infinity;
        const elements = root.querySelectorAll('[data-sourcepos]');
        for (const el of elements) {
            const pos = (el as HTMLElement).dataset.sourcepos;
            if (!pos) continue;
            const match = pos.match(/^(\d+):\d+-(\d+):\d+$/);
            if (match) {
                const startLine = parseInt(match[1], 10);
                const endLine = parseInt(match[2], 10);
                if (line >= startLine && line <= endLine) {
                    const rangeSize = endLine - startLine;
                    if (rangeSize < bestRangeSize) {
                        bestRangeSize = rangeSize;
                        best = el;
                    }
                }
            }
        }
        return best;
    };

    // useLayoutEffect runs synchronously after every DOM paint.
    // This means even if ReactMarkdown recreates the DOM, we ALWAYS re-apply the highlight.
    // We use activeSourcePosRef.current instead of activeSourcePos to avoid needing
    // it as a dependency (which would cause issues) — the ref is always up-to-date.
    useLayoutEffect(() => {
        if (!previewRef.current || designMode) return;
        const pos = activeSourcePosRef.current;

        // Remove all existing highlights
        previewRef.current.querySelectorAll('.live-highlight').forEach(el => {
            el.classList.remove('live-highlight');
        });

        if (!pos) return;

        const bestElement = findBestElement(previewRef.current, pos);
        if (bestElement) {
            bestElement.classList.add('live-highlight');
            if (needsScrollRef.current) {
                needsScrollRef.current = false;
                bestElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }
    });
    
    const selectedBlocksRef = useRef<HTMLElement[]>([]);
    useEffect(() => {
        selectedBlocksRef.current = selectedBlocks || [];
        
        if (editableRef.current) {
            editableRef.current.querySelectorAll('.selected-block').forEach(el => {
                el.classList.remove('selected-block');
                const dragHandle = el.querySelector('.custom-drag-handle');
                if (dragHandle) dragHandle.remove();
            });
            if (selectedBlocks && selectedBlocks.length > 0) {
                selectedBlocks.forEach(block => {
                    if (editableRef.current?.contains(block)) {
                        block.classList.add('selected-block');
                        
                        // Inject drag handle
                        if (designMode && !block.querySelector('.custom-drag-handle')) {
                            const handle = document.createElement('div');
                            handle.className = 'custom-drag-handle';
                            handle.contentEditable = 'false';
                            handle.draggable = true;
                            handle.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 5h.01M9 12h.01M9 19h.01M15 5h.01M15 12h.01M15 19h.01"/></svg>';
                            Object.assign(handle.style, {
                                position: 'absolute',
                                left: '-20px',
                                top: '4px',
                                width: '16px',
                                height: '20px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'grab',
                                color: 'var(--text-muted)',
                                borderRadius: '4px',
                                userSelect: 'none',
                                zIndex: '10'
                            });
                            // Make sure the block is relative so we can position absolutely
                            if (window.getComputedStyle(block).position === 'static') {
                                block.style.position = 'relative';
                            }
                            block.appendChild(handle);
                        }
                    }
                });
            }
        }
    }, [selectedBlocks]);

    // Helper to notify parent
    const handleSelect = (block: HTMLElement | null, isMultiSelect = false) => {
        if (!onSelectBlocks) {
            return;
        }
        if (!block) {
            onSelectBlocks([]);
            return;
        }
        
        if (isMultiSelect) {
            const current = selectedBlocksRef.current;
            if (current.includes(block)) {
                onSelectBlocks(current.filter(b => b !== block));
            } else {
                onSelectBlocks([...current, block]);
            }
        } else {
            onSelectBlocks([block]);
        }
    };

    // Set window variables for access from _setupDragAndDrop
    useEffect(() => {
        (window as any).__currentFilePath = filePath;
        (window as any).__previewOnRefresh = onRefresh;
        
        return () => {
            delete (window as any).__currentFilePath;
            delete (window as any).__previewOnRefresh;
        };
    }, [filePath, onRefresh]);

    // Paste handler for clipboard images
    useEffect(() => {
        if (!designMode) return;

        const handlePaste = async (e: ClipboardEvent) => {
            const items = e.clipboardData?.items;
            if (!items) return;

            for (const item of Array.from(items)) {
                if (item.type.startsWith('image/')) {
                    e.preventDefault();
                    const blob = item.getAsFile();
                    if (!blob) continue;

                    try {
                        const buffer = await blob.arrayBuffer();
                        const ext = item.type.split('/')[1] || 'png';
                        // Normalize path separators
                        const normalizedPath = filePath.replace(/\\/g, '/');
                        const baseDir = normalizedPath.substring(0, normalizedPath.lastIndexOf('/'));
                        const assetsDir = `${baseDir}/assets`;
                        const newName = `${Date.now()}-clipboard.${ext}`;
                        const destPath = `${assetsDir}/${newName}`;

                        console.log('Pasting to:', destPath);

                        await window.electronAPI.saveBlob(destPath, Array.from(new Uint8Array(buffer)));

                        // Create file:// URL with triple slashes for Windows
                        const fileUrl = `file:///${destPath.replace(/\\/g, '/')}`;
                        console.log('Paste image URL:', fileUrl);

                        // Insert image at cursor or end
                                if (editableRef.current) {
                                    const imgEl = document.createElement('img');
                                    imgEl.src = fileUrl;
                                    imgEl.style.maxWidth = '100%';
                                    imgEl.alt = '';

                                    editableRef.current.appendChild(imgEl);
                                }

                        // Refresh file explorer
                        if (onRefresh) onRefresh();
                    } catch (err) {
                        console.error('Failed to paste image:', err);
                    }
                }
            }
        };

        document.addEventListener('paste', handlePaste);
        return () => document.removeEventListener('paste', handlePaste);
    }, [designMode, filePath, onRefresh]);

        const handleBlockClick = (e: React.MouseEvent) => {
            let target = e.target as HTMLElement;
            if (target.closest('.block-toolbar')) return;

            if (!designMode) {
                // In Preview mode, just find the closest element with data-sourcepos and sync
                const blockElement = target.closest('[data-sourcepos]');
                console.log("Clicked preview element:", target, "Found data-sourcepos element:", blockElement);
                if (blockElement && onSelectSourcePos) {
                    const sourcePos = blockElement.getAttribute('data-sourcepos');
                    console.log("Found sourcePos:", sourcePos);
                    if (sourcePos) {
                        e.stopPropagation();
                        onSelectSourcePos(sourcePos);
                    }
                }
                return;
            }

            if (editableRef.current && editableRef.current.contains(target) && target !== editableRef.current) {
                let blockElement = target.closest('.draggable-block');
                if (!blockElement) {
                     // Fallback for elements that might not have the class yet
                     blockElement = target.closest('.code-block-wrapper, .callout, table, p, h1, h2, h3, h4, h5, h6, li, blockquote, img, video, hr');
                }
                
                if (blockElement && editableRef.current.contains(blockElement)) {
                    target = blockElement as HTMLElement;
                }

                e.stopPropagation();
                handleSelect(target, e.ctrlKey || e.metaKey);
                
                // Sync with editor
                if (onSelectSourcePos) {
                    const posTarget = target.closest('[data-sourcepos]');
                    const sourcePos = posTarget ? posTarget.getAttribute('data-sourcepos') : null;
                    if (sourcePos) onSelectSourcePos(sourcePos);
                }
            } else {
                handleSelect(null);
            }
        };



    const cleanHTML = (root: HTMLElement): string => {
            const clone = root.cloneNode(true) as HTMLElement;
            const traverse = (el: HTMLElement) => {
                // Remove attributes added by DnD or Editor
                el.removeAttribute('draggable');
                el.removeAttribute('contenteditable');
                el.removeAttribute('spellcheck');
                el.removeAttribute('data-collapsible'); 
                el.removeAttribute('data-sourcepos');
                
                // Remove DnD and resize classes
                el.classList.remove('sortable-dragging', 'sortable-drop-target', 'draggable-block', 'draggable-hover', 'cell-drop-active', 'row-drop-active', 'live-highlight', 'resizable', 'resizing', 'selected-block');
                if (el.classList.length === 0) el.removeAttribute('class');

                // Remove specific styles added by our JS (just in case stale ones exist)
                el.style.cursor = '';
                el.style.outline = '';
                el.style.opacity = '';
                
                // Remove 'node' attribute if leaked
                el.removeAttribute('node');

                // If style is empty, remove it
                if (el.getAttribute('style') === '') el.removeAttribute('style');

                Array.from(el.children).forEach(child => traverse(child as HTMLElement));
            };
            
            // Explicitly remove code block headers and resize handles logic BEFORE traversal
            const headers = clone.querySelectorAll('.code-block-header');
            headers.forEach(h => h.remove());
            
            const handles = clone.querySelectorAll('.resize-handle, .custom-drag-handle');
            handles.forEach(h => h.remove());

            // Fix nested code-block-wrappers: keep only the outermost, extract deepest code content
            const codeWrappers = clone.querySelectorAll('.code-block-wrapper');
            codeWrappers.forEach(wrapper => {
                // Check if this wrapper has nested code-block-wrappers inside
                const nestedWrappers = wrapper.querySelectorAll('.code-block-wrapper');
                if (nestedWrappers.length > 0) {
                    // Find the deepest code element
                    let deepest = wrapper;
                    while (deepest.querySelector('.code-block-wrapper')) {
                        deepest = deepest.querySelector('.code-block-wrapper')!;
                    }
                    
                    // Get the actual code content from deepest level
                    const codeEl = deepest.querySelector('code');
                    const language = wrapper.getAttribute('data-language') || '';
                    
                    // Replace wrapper content with clean structure
                    wrapper.innerHTML = '';
                    const contentDiv = document.createElement('div');
                    contentDiv.className = 'code-block-content';
                    if (codeEl) {
                        contentDiv.textContent = codeEl.textContent || '';
                    }
                    wrapper.appendChild(contentDiv);
                    wrapper.setAttribute('data-language', language);
                }
            });

            // Clean up media wrappers: transfer styles to inner img/video, then unwrap
            const mediaWrappers = clone.querySelectorAll('.media-wrapper');
            mediaWrappers.forEach(wrapper => {
                const htmlWrapper = wrapper as HTMLElement;
                const innerMedia = htmlWrapper.querySelector('img, video') as HTMLElement;
                if (innerMedia) {
                    if (htmlWrapper.style.width) innerMedia.style.width = htmlWrapper.style.width;
                    if (htmlWrapper.style.height) innerMedia.style.height = htmlWrapper.style.height;
                    if (htmlWrapper.style.maxWidth) innerMedia.style.maxWidth = htmlWrapper.style.maxWidth;
                    htmlWrapper.parentNode?.replaceChild(innerMedia, htmlWrapper);
                } else {
                    htmlWrapper.remove();
                }
            });

            traverse(clone);
            
            // Prevent Turndown from stripping empty layout elements
            const layoutElements = clone.querySelectorAll('.grid-cell, .dashboard-grid, .flex-row, .flex-col');
            layoutElements.forEach(el => {
                const html = el.innerHTML.trim();
                if (html === '' || html === '&#8203;') {
                    el.innerHTML = '<br class="empty-cell-placeholder" style="display:none" />';
                }
            });

            return clone.innerHTML;
        };

        // Register Save Callback
        useEffect(() => {
            if (onRegisterSave) {
                onRegisterSave(() => {
                    if (editableRef.current) {
                         const html = cleanHTML(editableRef.current);
                         const turndownService = new TurndownService({
                             headingStyle: 'atx',
                             codeBlockStyle: 'fenced',
                             emDelimiter: '*'
                         });

                         // Custom rule for Code Blocks (SyntaxHighlighter)
                         turndownService.addRule('syntaxHighlighter', {
                             filter: (node) => {
                                 return node.classList && node.classList.contains('code-block-wrapper');
                             },
                             replacement: (_content, node) => {
                                 const element = node as HTMLElement;
                                 const language = element.getAttribute('data-language') || '';
                                 
                                 let codeText = '';
                                 // Try to find the content wrapper first (new structure)
                                 const contentWrapper = element.querySelector('.code-block-content');
                                 if (contentWrapper) {
                                     codeText = contentWrapper.textContent || '';
                                 } else {
                                     // Fallback: iterate children and skip header (legacy support)
                                     element.childNodes.forEach((child) => {
                                         const el = child as HTMLElement;
                                         if (el.nodeType === 1 && !el.classList.contains('code-block-header')) {
                                             codeText += el.textContent;
                                         }
                                     });
                                 }
                                 
                                 return `\n\`\`\`${language}\n${codeText}\n\`\`\`\n`;
                             }
                         });

                         // Preserve standard HTML tags for layout (Moved to end to allow custom rules to fire first)
                         turndownService.keep(['div', 'span', 'table', 'tbody', 'tr', 'td', 'th', 'font', 'video'] as any);

                         return turndownService.turndown(html);
                    }
                    return fixedContent;
                });
            }
        }, [onRegisterSave, fixedContent]);

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
                        const turndownService = new TurndownService({
                            headingStyle: 'atx',
                            codeBlockStyle: 'fenced',
                            emDelimiter: '*'
                        });

                        // Custom rule for Code Blocks - preserve as HTML to avoid markdown interpretation issues
                        turndownService.addRule('syntaxHighlighter', {
                            filter: (node) => node.classList.contains('code-block-wrapper'),
                            replacement: (_content, node) => {
                                const element = node as HTMLElement;
                                const language = element.getAttribute('data-language') || '';
                                const contentWrapper = element.querySelector('.code-block-content');
                                // Get the deepest code element or text content
                                const codeEl = contentWrapper?.querySelector('code');
                                let codeText = codeEl ? codeEl.textContent || '' : (contentWrapper ? contentWrapper.textContent || '' : element.textContent || '');
                                // Escape HTML special chars and markdown # at line start
                                codeText = codeText
                                    .replace(/&/g, '&amp;')
                                    .replace(/</g, '&lt;')
                                    .replace(/>/g, '&gt;')
                                    .replace(/^#/gm, '&#35;');  // Escape # at start of any line
                                // Return as HTML pre/code to prevent markdown interpretation
                                return `<pre><div class="code-block-wrapper" data-language="${language}" style="position: relative;"><div class="code-block-content">${codeText}</div></div></pre>`;
                            }
                        });

                        turndownService.addRule('image', {
                            filter: 'img',
                            replacement: function (_content, node) {
                                const alt = (node as Element).getAttribute('alt') || '';
                                const src = (node as Element).getAttribute('src') || '';
                                return src ? `![${alt}](<${src}>)` : '';
                            }
                        });

                        turndownService.keep(['div', 'span', 'table', 'tbody', 'tr', 'td', 'th', 'font', 'video', 'br'] as any);

                        const markdown = turndownService.turndown(html);
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
        }, [designMode, onAutoSave]);

        // Clear selection when exiting Design Mode
        useEffect(() => {
            if (!designMode && onSelectBlocks && selectedBlocks && selectedBlocks.length > 0) {
                onSelectBlocks([]);
            }
        }, [designMode, onSelectBlocks, selectedBlocks]);

        // Handle entering Design Mode and external content changes
        useEffect(() => {
            // Cleanup previous if exists immediately
            if (dndCleanupRef.current) {
                 dndCleanupRef.current();
                 dndCleanupRef.current = null;
            }

            if (designMode && previewRef.current) {
                const timer = setTimeout(() => {
                    if (previewRef.current && editableRef.current) {
                        // Only sync DOM if entering design mode OR content was changed externally (e.g. from code editor)
                        // If it matches lastSavedContentRef, it means the change originated from the visual editor itself.
                        if (content !== lastSavedContentRef.current || editableRef.current.innerHTML === '') {
                            editableRef.current.innerHTML = previewRef.current.innerHTML;
                            // Update last saved content so we don't infinitely re-sync
                            lastSavedContentRef.current = content;
                        }
                        
                        _setupInteractions(editableRef.current);
                        dndCleanupRef.current = _setupDragAndDrop(editableRef.current);
                        resizeCleanupRef.current = _setupResize(editableRef.current);
                    }
                }, 100);
                return () => clearTimeout(timer);
            }
            
            return () => {
                if (dndCleanupRef.current) {
                    dndCleanupRef.current();
                    dndCleanupRef.current = null;
                }
                if (resizeCleanupRef.current) {
                    resizeCleanupRef.current();
                    resizeCleanupRef.current = null;
                }
            };
        }, [designMode, content]);



    if (!fixedContent && !designMode) return null;

    const transformImageUri = (uri: string) => {
        if (!uri || uri.startsWith('http') || uri.startsWith('data:') || uri.startsWith('file:')) return uri;
        let targetPath = '';
        const aggressiveDecode = (str: string) => {
            let decoded = str;
            try {
                let last = '';
                let attempts = 0;
                while (decoded !== last && attempts < 5) { last = decoded; decoded = decodeURIComponent(last); attempts++; }
            } catch (e) { try { decoded = decodeURI(decoded); } catch (e2) {} }
            return decoded;
        };
        const decodedUri = aggressiveDecode(uri).trim();
        const isAbsolute = decodedUri.match(/^[a-zA-Z]:\\/) || decodedUri.startsWith('/');
        if (isAbsolute) targetPath = decodedUri;
        else {
            const isFilenameOnly = !decodedUri.includes('/') && !decodedUri.includes('\\');
            if (isFilenameOnly) targetPath = decodedUri;
            else {
                const lastSlashIndex = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
                const fileDir = filePath.substring(0, lastSlashIndex).replace(/\\/g, '/');
                const cleanUri = decodedUri.replace(/\\/g, '/').replace(/^\.\//, '');
                targetPath = `${fileDir}/${cleanUri}`.split('/').reduce((stack: string[], part) => {
                    if (part === '..') stack.pop();
                    else if (part !== '' && part !== '.') stack.push(part);
                    return stack;
                }, []).join('/');
            }
        }
        
        const strategies = [targetPath, targetPath, getBasename(targetPath) || '', getBasename(decodedUri) || ''];
        const normalize = (p: string) => normalizePath(p).toLowerCase();
        let fullPath = '';
        for (const strat of strategies) {
            if (!strat) continue;
            const search = normalize(strat);
            let found = allFiles.find(f => normalize(f) === search) || allFiles.find(f => normalize(f).endsWith(search));
            if (found) { fullPath = found; break; }
        }

        if (!fullPath && targetPath) {
             const isAbsolute = targetPath.match(/^[a-zA-Z]:/) || targetPath.startsWith('/');
             if (!isAbsolute) {
                 const lastSlashIndex = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
                 const fileDir = filePath.substring(0, lastSlashIndex);
                 fullPath = `${normalizePath(fileDir)}/${normalizePath(targetPath)}`;
             } else fullPath = targetPath;
        }

        if (!fullPath) return uri;
        return `file:///${encodeURI(normalizePath(fullPath))}`;
    };

    const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
        if (!href) return;
        if (href.startsWith('obsidian://')) {
            e.preventDefault();
            const match = href.match(/[?&]file=([^&]+)/);
            if (match && match[1]) {
                const decodedFile = decodeURIComponent(match[1]);
                const strategies = [ decodedFile, getBasename(decodedFile) ];
                const normalize = (p: string) => normalizePath(p).toLowerCase();
                let found = undefined;
                for (const strat of strategies) {
                    if (!strat) continue;
                    const search = normalize(strat);
                    found = allFiles.find(f => normalize(f) === search) || allFiles.find(f => normalize(f).endsWith(search));
                    if (found) break;
                }
                if (found) { onFileSelect(found); return; }
            }
            return;
        }
        if (href.startsWith('http') || href.startsWith('mailto:')) return;
        e.preventDefault();
        
        let decodedHref = href;
        try { decodedHref = decodeURIComponent(href); } catch(e) {}
        
        let targetPath = '';
        if (decodedHref.startsWith('/') || decodedHref.match(/^[a-zA-Z]:/)) targetPath = decodedHref;
        else {
             const lastSlashIndex = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
             const fileDir = filePath.substring(0, lastSlashIndex);
             const combined = `${normalizePath(fileDir)}/${normalizePath(decodedHref)}`;
             targetPath = combined.split('/').reduce((stack: string[], part) => {
                if (part === '..') stack.pop();
                else if (part !== '' && part !== '.') stack.push(part);
                return stack;
            }, []).join('/');
        }

        const strategies = [targetPath, targetPath, getBasename(targetPath) || '', getBasename(decodedHref) || ''];
        const normalize = (p: string) => normalizePath(p).toLowerCase();
        let found = undefined;
        for (const strat of strategies) {
            if (!strat) continue;
            const search = normalize(strat);
            found = allFiles.find(f => normalize(f) === search) || allFiles.find(f => normalize(f).endsWith(search));
            if (found) break;
        }
        if (found) onFileSelect(found);
        else alert(`Файл не найден!\n\nИскали:\n${targetPath}`);
    };

    const processedContent = fixedContent
        .replace(/!\[([^\]]*)\]\s*\((?!<)([^)]+)\)/g, '![$1](<$2>)')
        .replace(/!\[\[([^|\]]+)(?:\|.*?)?\]\]/g, (_, filename) => `![${filename}](<${filename}>)`)
        .replace(/\[\[(.*?)\|(.*?)\]\]/g, '[$2](<$1>)')
        .replace(/\[\[(.*?)\]\]/g, '[$1](<$1>)');

    return (
        <div 
            className={`markdown-preview${designMode ? ' design-mode' : ''}`} 
            style={{ padding: '20px 40px', paddingBottom: '100px', height: '100%', overflowY: 'auto', boxSizing: 'border-box' }}
            onClick={() => {
                if (designMode && onSelectBlocks) {
                    // Only clear if the click wasn't already handled (e.stopPropagation) by a block
                    onSelectBlocks([]);
                }
            }}
        >
            <div className="markdown-content-wrapper" style={{ position: 'relative' }}>

                {designMode && (
                    <div 
                        onClick={handleBlockClick}
                        ref={editableRef}
                        className="design-mode-container"
                        contentEditable
                        suppressContentEditableWarning
                        style={{
                            outline: '2px solid var(--interactive-accent)',
                            minHeight: '200px',
                            padding: '10px',
                            borderRadius: '4px',
                            backgroundColor: 'var(--background-primary)'
                        }}
                    />
                )}

                <div ref={previewRef} style={{ display: designMode ? 'none' : 'block' }} onClick={handleBlockClick}>
                    <ReactMarkdown 
                        remarkPlugins={[remarkGfm]} 
                        rehypePlugins={[rehypeRaw, rehypeSourceLine]}
                        urlTransform={transformImageUri}
                        components={{
                            h1: ({node, ...props}: any) => <h1 {...sanitizeProps(props)} style={{...parseStyle(props.style), margin: '1em 0'}} />,
                            h2: ({node, ...props}: any) => <h2 {...sanitizeProps(props)} style={{...parseStyle(props.style), margin: '0.8em 0'}} />,
                            h3: ({node, ...props}: any) => <h3 {...sanitizeProps(props)} style={parseStyle(props.style)} />,
                            div: ({node, className, children, ...props}: any) => {
                                // Handle code-block-wrapper specially to avoid markdown interpretation
                                if (className && className.includes('code-block-wrapper')) {
                                    const language = props['data-language'] || '';
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
                                    // Decode HTML entities that may have been escaped
                                    codeContent = codeContent
                                        .replace(/&lt;/g, '<')
                                        .replace(/&gt;/g, '>')
                                        .replace(/&amp;/g, '&')
                                        .replace(/&#35;/g, '#')
                                        .replace(/\n$/, '');
                                    
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
                                        <video src={transformImageUri(src)} controls style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    </span>
                                );
                                return (
                                    <span className="media-wrapper" style={{display: 'inline-block', maxWidth: '100%', ...(props.style ? parseStyle(props.style) : {})}}>
                                        <img {...sanitizeProps(props)} src={transformImageUri(src)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    </span>
                                );
                            },
                            video: (props: any) => {
                                 const sanitized = sanitizeProps(props);
                                 return (
                                     <span className="media-wrapper" style={{display: 'inline-block', maxWidth: '100%', ...(props.style ? parseStyle(props.style) : {})}}>
                                         <video {...sanitized} src={transformImageUri(props.src || '')} controls style={{width: '100%', height: '100%', borderRadius: '4px', display: 'block', objectFit: 'cover'}} />
                                     </span>
                                 );
                            },
                            font: (props: any) => <span style={{color: props.color, ...parseStyle(props.style)}}>{props.children}</span>,
                            center: ({node, ...props}: any) => <div {...sanitizeProps(props)} style={{textAlign: 'center', ...parseStyle(props.style)}} />,
                            a: ({node, ...props}: any) => <a {...sanitizeProps(props)} onClick={(e) => handleLinkClick(e, props.href || '')} style={{cursor: 'pointer', color: 'var(--interactive-accent)', ...parseStyle(props.style)}} />,
                            code: CodeBlock,
                            blockquote: Callout,
                        } as any}
                    >
                        {processedContent}
                    </ReactMarkdown>
                </div>
            </div>
        </div>
    );
}
