import { normalizePath, getBasename } from './path';
import React from 'react';

export const transformImageUri = (uri: string, filePath: string, allFiles: string[]) => {
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

export const handleLinkClick = (
    e: React.MouseEvent<HTMLAnchorElement>, 
    href: string, 
    filePath: string,
    allFiles: string[],
    onFileSelect: (path: string) => void
) => {
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
