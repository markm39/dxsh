/**
 * Mode-specific highlighting and interaction handlers
 * Each mode (all, table, repeating) has its own focused logic
 */

import { 
  ModeHandler, 
  ModeHandlerContext, 
  SelectedElement, 
  SelectionMode 
} from './types';
import { 
  findElementsWithSameStructure, 
  generateOptimalSelector, 
  computeRelativeSelector 
} from './selectorUtils';

/**
 * Raw Mode Handler - Highlights specific individual elements for text/content extraction
 */
export class RawModeHandler implements ModeHandler {
  getModeName(): string {
    return "raw";
  }

  getHighlightColor(): string {
    return "#00d4ff"; // Blue
  }

  handleHover(target: Element, context: ModeHandlerContext): void {
    console.log(`🔍 RAW MODE: Highlighting specific element ${target.tagName.toLowerCase()}`);
    
    const overlay = context.createHighlightOverlay(target);
    overlay.style.border = '3px solid #00d4ff';
    overlay.style.background = 'rgba(0, 212, 255, 0.1)';
    context.overlayContainer.appendChild(overlay);
    context.highlightOverlays.push(overlay);
    target.classList.add("temp-multi-hover");
    
    // Create tooltip
    const rect = target.getBoundingClientRect();
    context.infoTooltip = context.createInfoTooltip(target, rect);
    if (context.infoTooltip) {
      context.overlayContainer.appendChild(context.infoTooltip);
    }
  }

  handleClick(target: Element, context: ModeHandlerContext): SelectedElement {
    console.log(`🎯 RAW MODE: Selecting specific element ${target.tagName.toLowerCase()}`);
    
    const selector = generateOptimalSelector(target, context.doc, { isRepeating: false });
    const matchingElements = context.doc.querySelectorAll(selector);
    
    console.log(`Generated selector: ${selector} (${matchingElements.length} matches)`);
    
    return {
      selector,
      text: target.textContent?.trim().slice(0, 100) || "",
      tagName: target.tagName.toLowerCase(),
      label: `${target.tagName.toLowerCase()}${target.id ? "#" + target.id : ""}${
        target.className ? "." + Array.from(target.classList).slice(0, 2).join(".") : ""
      }`,
      elementCount: matchingElements.length,
      type: "raw",
    };
  }
}

/**
 * Table Mode Handler - Only highlights table elements
 */
export class TableModeHandler implements ModeHandler {
  getModeName(): string {
    return "tables";
  }

  getHighlightColor(): string {
    return "#22c55e"; // Green
  }

  handleHover(target: Element, context: ModeHandlerContext): void {
    console.log(`🔍 TABLE MODE: Checking if ${target.tagName.toLowerCase()} is table element`);
    
    // Only highlight if hovering over table elements - restrict to table tag only
    const isTableElement = target.tagName.toLowerCase() === 'table';
    if (!isTableElement) {
      console.log(`❌ Not a <table> element, ignoring`);
      return;
    }
    
    console.log(`✅ Highlighting table: ${target.tagName.toLowerCase()}`);
    
    const overlay = context.createHighlightOverlay(target);
    overlay.style.border = '3px solid #22c55e';
    overlay.style.background = 'rgba(34, 197, 94, 0.15)';
    context.overlayContainer.appendChild(overlay);
    context.highlightOverlays.push(overlay);
    target.classList.add("temp-multi-hover");
    
    // Create tooltip
    const rect = target.getBoundingClientRect();
    context.infoTooltip = context.createInfoTooltip(target, rect);
    if (context.infoTooltip) {
      context.overlayContainer.appendChild(context.infoTooltip);
    }
  }

  handleClick(target: Element, context: ModeHandlerContext): SelectedElement | null {
    console.log(`🎯 TABLE MODE: Attempting to select table element`);
    
    // Only allow clicking on table elements - restrict to table tag only
    const isTableElement = target.tagName.toLowerCase() === 'table';
    if (!isTableElement) {
      console.log(`❌ Not a <table> element, cannot select`);
      return null;
    }
    
    const selector = generateOptimalSelector(target, context.doc, { isRepeating: false });
    const matchingElements = context.doc.querySelectorAll(selector);
    
    console.log(`Selected table with selector: ${selector} (${matchingElements.length} matches)`);
    
    return {
      selector,
      text: target.textContent?.trim().slice(0, 100) || "",
      tagName: target.tagName.toLowerCase(),
      label: `Table: ${target.tagName.toLowerCase()}`,
      elementCount: matchingElements.length,
      type: "tables",
    };
  }
}

/**
 * Repeating Mode Handler - Highlights containers and fields for structured data
 */
export class RepeatingModeHandler implements ModeHandler {
  getModeName(): string {
    return "repeating";
  }

  getHighlightColor(): string {
    return "#f59e0b"; // Orange for containers, Green for fields
  }

  handleHover(target: Element, context: ModeHandlerContext): void {
    if (!context.containerElement) {
      // Container selection mode
      this.handleContainerHover(target, context);
    } else {
      // Field selection mode
      this.handleFieldHover(target, context);
    }
  }

  private handleContainerHover(target: Element, context: ModeHandlerContext): void {
    console.log(`🔍 REPEATING MODE: Finding containers like ${target.tagName.toLowerCase()}`);
    
    const matches = findElementsWithSameStructure(target, context.doc);
    
    console.log(`🎯 Highlighting ${matches.length} matching containers:`);
    matches.forEach((match, index) => {
      console.log(`   ${index + 1}. ${match.tagName.toLowerCase()} - ${match.textContent?.trim().slice(0, 50)}...`);
      
      const overlay = context.createHighlightOverlay(match);
      overlay.style.border = '3px solid #f59e0b'; // Orange for repeating containers
      overlay.style.background = 'rgba(245, 158, 11, 0.15)';
      context.overlayContainer.appendChild(overlay);
      context.highlightOverlays.push(overlay);
      match.classList.add("temp-multi-hover");
    });
    
    // Create tooltip for the original target
    const rect = target.getBoundingClientRect();
    context.infoTooltip = context.createInfoTooltip(target, rect);
    if (context.infoTooltip) {
      context.overlayContainer.appendChild(context.infoTooltip);
    }
  }

  private handleFieldHover(target: Element, context: ModeHandlerContext): void {
    if (!context.currentContainerSelector) return;
    
    console.log(`🔍 FIELD MODE: Finding fields like ${target.tagName.toLowerCase()}`);
    
    // Find all containers and highlight matching fields in each
    const containers = context.doc.querySelectorAll(context.currentContainerSelector);
    const containingContainer = target.closest(context.currentContainerSelector);
    
    if (containingContainer) {
      const subSelector = computeRelativeSelector(target, containingContainer);
      console.log(`📍 Field sub-selector: ${subSelector}`);
      
      containers.forEach((container) => {
        const fieldsInContainer = container.querySelectorAll(subSelector);
        fieldsInContainer.forEach((field) => {
          const overlay = context.createHighlightOverlay(field);
          overlay.style.border = '3px solid #10b981'; // Green for fields
          overlay.style.background = 'rgba(16, 185, 129, 0.15)';
          context.overlayContainer.appendChild(overlay);
          context.highlightOverlays.push(overlay);
          field.classList.add("temp-field-hover");
        });
      });
      
      // Create tooltip for the original target
      const rect = target.getBoundingClientRect();
      context.infoTooltip = context.createInfoTooltip(target, rect);
      if (context.infoTooltip) {
        context.overlayContainer.appendChild(context.infoTooltip);
      }
    }
  }

  handleClick(target: Element, context: ModeHandlerContext): SelectedElement | null {
    if (!context.containerElement) {
      // Container selection
      return this.handleContainerClick(target, context);
    } else {
      // Field selection
      return this.handleFieldClick(target, context);
    }
  }

  private handleContainerClick(target: Element, context: ModeHandlerContext): SelectedElement {
    console.log(`🎯 REPEATING MODE: Selecting container for ${target.tagName.toLowerCase()}`);
    
    const matches = findElementsWithSameStructure(target, context.doc);
    const containerSelector = generateOptimalSelector(target, context.doc, { 
      isRepeating: true,
      minMatches: 2,
      maxMatches: 50 
    });
    
    console.log(`🎯 Final container selection: ${matches.length} elements with selector: ${containerSelector}`);

    const newContainer: SelectedElement = {
      selector: containerSelector,
      text: target.textContent?.trim().slice(0, 100) || "",
      tagName: target.tagName.toLowerCase(),
      label: `Container: ${target.tagName.toLowerCase()}${
        target.id ? "#" + target.id : ""
      }${
        target.className
          ? "." + Array.from(target.classList).slice(0, 2).join(".")
          : ""
      }`,
      elementCount: matches.length,
      type: "repeating",
      fields: [],
    };

    // Highlight all matching containers permanently
    matches.forEach((el) => {
      el.classList.add("element-selector-container");
    });

    return newContainer;
  }

  private handleFieldClick(target: Element, context: ModeHandlerContext): SelectedElement | null {
    if (!context.containerElement || !context.currentContainerSelector) {
      console.log(`❌ No container selected for field`);
      return null;
    }

    console.log(`🎯 REPEATING MODE: Selecting field ${target.tagName.toLowerCase()}`);
    
    const containingContainer = target.closest(context.currentContainerSelector);
    if (!containingContainer) {
      console.log(`❌ Target is not within a container`);
      return null;
    }

    const subSelector = computeRelativeSelector(target, containingContainer);
    console.log(`📍 Field sub-selector: ${subSelector}`);

    // Count matches across all containers
    const containers = context.doc.querySelectorAll(context.currentContainerSelector);
    let totalMatches = 0;
    containers.forEach((container) => {
      const fieldsInContainer = container.querySelectorAll(subSelector);
      totalMatches += fieldsInContainer.length;
      
      // Highlight fields in all containers
      fieldsInContainer.forEach((field) => {
        field.classList.add("element-selector-field");
      });
    });

    const fieldElement: SelectedElement = {
      selector: subSelector,
      text: target.textContent?.trim().slice(0, 50) || "",
      tagName: target.tagName.toLowerCase(),
      label: `Field: ${target.tagName.toLowerCase()}`,
      elementCount: totalMatches,
      type: "raw",
      name: "", // Will be set by user
    };

    console.log(`✅ Selected field with ${totalMatches} matches across ${containers.length} containers`);
    return fieldElement;
  }
}

/**
 * Factory function to create mode handlers
 */
export const createModeHandler = (mode: SelectionMode): ModeHandler => {
  switch (mode) {
    case "raw":
      return new RawModeHandler();
    case "tables":
      return new TableModeHandler();
    case "repeating":
      return new RepeatingModeHandler();
    default:
      throw new Error(`Unknown mode: ${mode}`);
  }
};