import { visit } from 'unist-util-visit';
import React from 'react';

// ─── Module-level constants (shared across components) ────────────────────────

/** Maps short language aliases to Prism language names */
export const LANG_MAP: Record<string, string> = {
    'js': 'javascript', 'ts': 'typescript', 'py': 'python',
    'htm': 'markup', 'html': 'markup', 'xml': 'markup',
    'svg': 'markup', 'sh': 'bash', 'bash': 'bash', 'shell': 'bash',
    'c++': 'cpp', 'c#': 'csharp'
};

/** Callout type → accent color */
export const CALLOUT_COLOR_MAP: Record<string, string> = {
    abstract: '#00bfa5', summary: '#00bfa5', tldr: '#00bfa5',
    info: '#448aff', todo: '#448aff', note: '#448aff',
    tip: '#00bfa5', hint: '#00bfa5', important: '#00bfa5',
    success: '#00c853', check: '#00c853', done: '#00c853',
    question: '#ff9800', help: '#ff9800', faq: '#ff9800',
    warning: '#ff9800', caution: '#ff9800', attention: '#ff9800',
    failure: '#e91e63', fail: '#e91e63', missing: '#e91e63',
    danger: '#e91e63', error: '#e91e63', bug: '#e91e63',
    example: '#00c853', quote: '#9e9e9e', cite: '#9e9e9e'
};

/** Convert hex color to "r, g, b" string for CSS custom properties */
export const hexToRgb = (hex: string): string => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
        ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
        : '68, 138, 255';
};

/** Auto-detect language based on simple heuristics (C++, C, Python, HTML, CSS, JavaScript) */
export const detectLanguage = (code: string): string => {
    if (!code || code.trim() === '') return 'text';
    
    // HTML detection
    if (/^\s*<!DOCTYPE html>/i.test(code) || /^\s*<html/i.test(code) || /^\s*<div/i.test(code)) {
        return 'html';
    }
    
    // C / C++ detection
    if (code.includes('#include') || code.includes('int main(') || code.includes('std::cout') || code.includes('printf(')) {
        if (code.includes('std::') || code.includes('iostream') || code.includes('vector<')) return 'cpp';
        return 'c';
    }
    
    // CSS detection
    if (/body\s*{/i.test(code) || /\.[a-zA-Z0-9_-]+\s*{/i.test(code) || /#\w+\s*{/.test(code) || /margin:\s*\d/.test(code) || /padding:\s*\d/.test(code)) {
        if (!code.includes('function') && !code.includes('def ')) {
            return 'css';
        }
    }
    
    // Python detection
    if (code.includes('def ') || code.includes('import ') || code.includes('print(') || /^\s*if __name__ == ['"]__main__['"]:/m.test(code) || code.includes('self.')) {
        if (!code.includes('const ') && !code.includes('let ') && !code.includes('var ') && !code.includes(';')) {
            return 'python';
        }
    }
    
    // JS detection
    if (code.includes('const ') || code.includes('let ') || code.includes('function()') || code.includes('console.log') || code.includes('document.') || code.includes('=>')) {
        return 'javascript';
    }
    
    return 'text';
};

export function rehypeSourceLine() {
  return (tree: any) => {
    visit(tree, 'element', (node: any) => {
      if (node.position && node.position.start && node.position.end) {
        node.properties = node.properties || {};
        node.properties['data-sourcepos'] = `${node.position.start.line}:${node.position.start.column}-${node.position.end.line}:${node.position.end.column}`;
      }
    });
  };
}

// Fix paths to assets if they point to old directory
export const fixPaths = (content: string, rootPath: string): string => {
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
export const parseStyle = (style: any): React.CSSProperties => {
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

export const sanitizeProps = (props: any) => {
    const cleanProps: any = {};
    Object.keys(props).forEach(key => {
        if (key.includes(':') || key.includes(';') || key === 'node' || key === 'style') return;
        cleanProps[key] = props[key];
    });
    return cleanProps;
};
