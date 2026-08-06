import { createContext, useContext } from 'react';

/**
 * Context that carries the current design/reading mode flag
 * to all markdown sub-components (e.g. Callout, DiagramCallout).
 *
 * In Preview.tsx:
 *   - Reading Mode renders inside <previewRef>   → designMode = false
 *   - Design Mode  renders inside <editableRef>  → designMode = true
 *
 * Callout.tsx (and DiagramCallout) consume this context to decide
 * whether interactive controls (buttons, editors) should be shown.
 */
export const DesignModeContext = createContext<boolean>(false);
export const useDesignMode = () => useContext(DesignModeContext);
