/**
 * TypeScript interfaces and types for the Visual Element Selector system
 */

export interface SelectedElement {
  selector: string;
  text: string;
  tagName: string;
  label: string;
  elementCount: number;
  type: "raw" | "repeating" | "tables";
  name?: string;
  fields?: FieldConfig[];
  relativeSelector?: string;
}

export interface FieldConfig {
  name: string;
  sub_selector: string;
  attribute: string;
}

export interface VisualElementSelectorProps {
  url: string;
  onSelectorsChange: (elements: SelectedElement[]) => void;
  onClose: () => void;
}

export interface ProxyTestResult {
  success: boolean;
  proxyUrl?: string;
  error?: string;
  alternatives?: string[];
  method?: 'headless_browser' | 'cors_proxy';
}

export type SelectionMode = "raw" | "repeating" | "tables";

export interface ModeHandlerContext {
  doc: Document;
  overlayContainer: HTMLElement;
  highlightOverlays: HTMLElement[];
  infoTooltip: HTMLElement | null;
  containerElement: SelectedElement | null;
  currentContainerSelector: string | null;
  createHighlightOverlay: (element: Element) => HTMLElement;
  createInfoTooltip: (element: Element, rect: DOMRect) => HTMLElement | null;
  clearTempHighlights: () => void;
  computeRelativeSelector: (element: Element, container: Element) => string;
}

export interface ModeHandler {
  handleHover: (target: Element, context: ModeHandlerContext) => void;
  handleClick: (target: Element, context: ModeHandlerContext) => SelectedElement | null;
  getModeName: () => string;
  getHighlightColor: () => string;
}

export interface IframeMessage {
  type: string;
  selectionMode?: SelectionMode;
  enabled?: boolean;
  selector?: string | null;
  elements?: SelectedElement[];
}

export interface CSSGenerationOptions {
  isRepeating?: boolean;
  maxMatches?: number;
  minMatches?: number;
}