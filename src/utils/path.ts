export const normalizePath = (path: string): string => {
    return path.replace(/\\/g, '/');
};

export const getBasename = (path: string): string => {
    const normalized = normalizePath(path);
    return normalized.split('/').pop() || '';
};

export const getDirname = (path: string): string => {
    const normalized = normalizePath(path);
    const parts = normalized.split('/');
    parts.pop();
    return parts.join('/');
};

export const joinPaths = (...parts: string[]): string => {
    return parts
        .map(part => normalizePath(part).replace(/^\/|\/$/g, ''))
        .filter(part => part.length > 0)
        .join('/');
};
