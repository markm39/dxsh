/**
 * CSS Selector generation and DOM traversal utilities
 */

import { CSSGenerationOptions } from './types';

/**
 * Generate a structural path like "body > div > section > main > li"
 */
export const generateStructuralPath = (element: Element): string => {
  const path: string[] = [];
  let current: Element | null = element;
  
  // Go all the way up to html/body for full structural path
  while (current && current.tagName) {
    const tagName = current.tagName.toLowerCase();
    
    // Stop at body (don't include html)
    if (tagName === 'html') {
      break;
    }
    
    path.unshift(tagName);
    current = current.parentElement;
  }
  
  // Return full structural path
  const fullPath = path.join(' > ');
  return fullPath;
};

/**
 * Calculate element depth in DOM tree
 */
export const getElementDepth = (element: Element): number => {
  let depth = 0;
  let current = element.parentElement;
  while (current) {
    depth++;
    current = current.parentElement;
  }
  return depth;
};

/**
 * Find elements with the same structural pattern as the target element
 */
export const findElementsWithSameStructure = (element: Element, doc: Document): Element[] => {
  // Method 1: Try exact structural path
  const structuralPath = generateStructuralPath(element);
  
  try {
    const structuralMatches = Array.from(doc.querySelectorAll(structuralPath));
    if (structuralMatches.length > 1) {
      return structuralMatches;
    }
  } catch (error) {
    // Structural path failed, continue to other methods
  }
  
  // Method 2: Find siblings with same tag
  const parent = element.parentElement;
  if (parent) {
    const siblings = Array.from(parent.children).filter(child => 
      child.tagName === element.tagName
    );
    if (siblings.length > 1) {
      console.log(`📍 Found ${siblings.length} siblings with same tag`);
      return siblings;
    }
  }
  
  // Method 3: Find elements with same class at same depth
  if (element.className) {
    const mainClass = Array.from(element.classList)[0];
    if (mainClass) {
      const elementDepth = getElementDepth(element);
      const classMatches = Array.from(doc.querySelectorAll(`.${mainClass}`))
        .filter(el => getElementDepth(el) === elementDepth);
        
      if (classMatches.length > 1 && classMatches.length < 50) {
        console.log(`📍 Found ${classMatches.length} matches with class .${mainClass} at same depth`);
        return classMatches;
      }
    }
  }
  
  // Method 4: Find same tag at same depth
  const elementDepth = getElementDepth(element);
  const tagMatches = Array.from(doc.querySelectorAll(element.tagName.toLowerCase()))
    .filter(el => getElementDepth(el) === elementDepth);
    
  if (tagMatches.length > 1 && tagMatches.length < 20) {
    console.log(`📍 Found ${tagMatches.length} matches with same tag at depth ${elementDepth}`);
    return tagMatches;
  }
  
  console.log(`❌ No repeating pattern found`);
  return [element]; // Return just the element itself
};

/**
 * Generate optimal CSS selector for an element
 */
export const generateOptimalSelector = (
  element: Element,
  doc: Document,
  options: CSSGenerationOptions = {}
): string => {
  const { isRepeating = false, maxMatches = 5, minMatches = 1 } = options;
  const tagName = element.tagName.toLowerCase();
  
  // For repeating mode, we want selectors that match multiple similar elements
  if (isRepeating) {
    console.log(`Generating repeating selector for ${tagName}`);
    
    // Try structural path first
    const structuralPath = generateStructuralPath(element);
    try {
      const matches = doc.querySelectorAll(structuralPath);
      if (matches.length >= minMatches && matches.length <= maxMatches * 10) {
        console.log(`Using structural path: ${structuralPath} (${matches.length} matches)`);
        return structuralPath;
      }
    } catch (e) {
      console.log(`Structural path failed: ${e}`);
    }
    
    // Try class-based selectors
    if (element.className) {
      const classList = Array.from(element.classList).filter(
        cls => !cls.startsWith('element-selector-') && !cls.startsWith('temp-')
      );
      
      if (classList.length > 0) {
        // Try most specific class first
        const classSelector = `${tagName}.${classList[0]}`;
        const matches = doc.querySelectorAll(classSelector);
        if (matches.length >= 2 && matches.length <= 50) {
          console.log(`Using class selector: ${classSelector} (${matches.length} matches)`);
          return classSelector;
        }
      }
    }
    
    // Try tag-based selection
    const tagMatches = doc.querySelectorAll(tagName);
    if (tagMatches.length >= 2 && tagMatches.length <= 100) {
      console.log(`Using tag selector: ${tagName} (${tagMatches.length} matches)`);
      return tagName;
    }
    
    // Fallback for repeating mode
    return tagName;
  }
  
  // For specific mode, prefer unique selectors
  const selectors: string[] = [];

  // Try ID first (most specific)
  if (element.id) {
    const idSelector = `#${element.id}`;
    if (doc.querySelectorAll(idSelector).length === 1) {
      return idSelector;
    }
  }

  // Try class combinations
  if (element.className) {
    const classes = Array.from(element.classList)
      .filter(cls => !cls.startsWith('element-selector-'))
      .slice(0, 3);
    
    if (classes.length > 0) {
      const classSelector = `${tagName}.${classes.join('.')}`;
      if (doc.querySelectorAll(classSelector).length <= maxMatches) {
        selectors.push(classSelector);
      }
    }
  }

  // Try attribute selectors
  const attributes = ['data-id', 'data-testid', 'role', 'type'];
  for (const attr of attributes) {
    const value = element.getAttribute(attr);
    if (value) {
      const attrSelector = `${tagName}[${attr}="${value}"]`;
      if (doc.querySelectorAll(attrSelector).length <= 3) {
        selectors.push(attrSelector);
      }
    }
  }

  // Try nth-child with parent context
  const parent = element.parentElement;
  if (parent) {
    const siblings = Array.from(parent.children).filter(child => 
      child.tagName === element.tagName
    );
    const index = siblings.indexOf(element) + 1;
    
    let parentSelector = parent.tagName.toLowerCase();
    if (parent.id) {
      parentSelector = `#${parent.id}`;
    } else if (parent.className) {
      const parentClasses = Array.from(parent.classList).slice(0, 2);
      if (parentClasses.length > 0) {
        parentSelector = `${parent.tagName.toLowerCase()}.${parentClasses.join('.')}`;
      }
    }

    const nthSelector = `${parentSelector} > ${tagName}:nth-child(${index})`;
    selectors.push(nthSelector);
  }

  // Return the first working selector
  for (const selector of selectors) {
    try {
      if (doc.querySelectorAll(selector).length >= 1) {
        return selector;
      }
    } catch (e) {
      continue;
    }
  }

  // Fallback
  return tagName;
};

/**
 * Compute relative selector from child element to parent container
 */
export const computeRelativeSelector = (childElement: Element, container: Element): string => {
  console.log(`Computing relative selector from ${childElement.tagName} to ${container.tagName}`);
  
  const path: string[] = [];
  let current = childElement;
  
  // Walk up from child to container
  while (current && current !== container) {
    const parent = current.parentElement;
    if (!parent) break;
    
    // Find position among siblings of same type
    const siblings = Array.from(parent.children).filter(child => 
      child.tagName === current.tagName
    );
    const index = siblings.indexOf(current);
    
    if (siblings.length === 1) {
      // Only child of this type
      path.unshift(current.tagName.toLowerCase());
    } else {
      // Multiple siblings, use nth-child
      path.unshift(`${current.tagName.toLowerCase()}:nth-child(${index + 1})`);
    }
    
    current = parent;
    
    // Stop if we've reached the container
    if (current === container) {
      break;
    }
  }
  
  const relativeSelector = path.join(' > ');
  console.log(`Relative selector: ${relativeSelector}`);
  return relativeSelector;
};

/**
 * Test if a CSS selector is valid and how many elements it matches
 */
export const testSelector = (selector: string, doc: Document): { valid: boolean; count: number; error?: string } => {
  try {
    const matches = doc.querySelectorAll(selector);
    return { valid: true, count: matches.length };
  } catch (error) {
    return { valid: false, count: 0, error: String(error) };
  }
};