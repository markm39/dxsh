/**
 * Iframe management, CORS proxy setup, and iframe communication utilities
 */

import { IframeMessage, ProxyTestResult, SelectionMode } from './types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

/**
 * Test if headless browser can load the URL for visual selection
 * Falls back to CORS proxy if headless browser fails
 */
export const testProxyAccess = async (
  url: string,
  authHeaders: Record<string, string>
): Promise<ProxyTestResult> => {
  console.log(`Testing page access for visual selection: ${url}`);
  
  // First try the new headless browser endpoint
  try {
    const token = authHeaders.Authorization?.replace('Bearer ', '') || 'test';
    const headlessUrl = `${API_BASE_URL}/api/v1/scrape/iframe?url=${encodeURIComponent(url)}&token=${encodeURIComponent(token)}`;
    console.log(" Trying headless browser approach...");

    const response = await fetch(headlessUrl, {
      method: "GET",
    });

    if (response.ok) {
      console.log(" Headless browser access successful");
      return {
        success: true,
        proxyUrl: headlessUrl,
        method: 'headless_browser'
      };
    } else {
      console.log(` Headless browser failed: ${response.status} ${response.statusText}`);
      console.log(" Falling back to CORS proxy...");
    }
  } catch (error) {
    console.log(` Headless browser error: ${error}`);
    console.log(" Falling back to CORS proxy...");
  }

  // Fallback to CORS proxy for compatibility
  try {
    const token = authHeaders.Authorization?.replace('Bearer ', '') || 'test';
    const proxyUrl = `${API_BASE_URL}/api/v1/proxy?url=${encodeURIComponent(
      url
    )}&token=${encodeURIComponent(token)}`;

    console.log(" Trying CORS proxy fallback...");
    const response = await fetch(proxyUrl, {
      method: "GET",
      headers: authHeaders,
    });

    if (response.ok) {
      console.log(" CORS proxy access successful");
      return {
        success: true,
        proxyUrl,
        method: 'cors_proxy'
      };
    } else {
      console.log(` CORS proxy failed: ${response.status} ${response.statusText}`);
      return {
        success: false,
        error: `Both headless browser and CORS proxy failed. Last error: ${response.status} ${response.statusText}`,
        alternatives: ["manual_selector"],
      };
    }
  } catch (error) {
    console.log(` CORS proxy error: ${error}`);
    return {
      success: false,
      error: `Both headless browser and CORS proxy failed. Last error: ${String(error)}`,
      alternatives: ["manual_selector"],
    };
  }
};

/**
 * Generate the URL for iframe loading (headless browser or CORS proxy)
 */
export const generateProxyUrl = (url: string, token: string, method: 'headless_browser' | 'cors_proxy' = 'headless_browser'): string => {
  if (method === 'headless_browser') {
    // Use the new iframe endpoint that accepts token as URL parameter
    return `${API_BASE_URL}/api/v1/scrape/iframe?url=${encodeURIComponent(url)}&token=${encodeURIComponent(token)}`;
  } else {
    return `${API_BASE_URL}/api/v1/proxy?url=${encodeURIComponent(url)}&token=${encodeURIComponent(token)}`;
  }
};

/**
 * Setup iframe with element selection capabilities
 */
export const setupIframeElementSelection = (
  iframe: HTMLIFrameElement,
  onElementsSelected: (elements: any[]) => void
): void => {
  console.log("Setting up iframe element selection system");

  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!iframeDoc) {
    console.error("Could not access iframe document");
    return;
  }

  // Inject CSS styles for highlighting
  const style = iframeDoc.createElement("style");
  style.textContent = `
    /* Base highlighting styles */
    .element-selector-active {
      position: relative !important;
    }
    
    .element-selector-active * {
      cursor: crosshair !important;
    }
    
    /* Specific element highlighting (blue) */
    .element-selector-hover {
      outline: 3px solid #00d4ff !important;
      outline-offset: 2px !important;
      background-color: rgba(0, 212, 255, 0.1) !important;
      position: relative !important;
    }
    
    /* Table highlighting (green) */
    .element-selector-table {
      outline: 3px solid #22c55e !important;
      outline-offset: 2px !important;
      background-color: rgba(34, 197, 94, 0.15) !important;
      position: relative !important;
    }
    
    /* Repeating container highlighting (orange) */
    .element-selector-container {
      outline: 4px solid #f59e0b !important;
      outline-offset: 3px !important;
      background-color: rgba(245, 158, 11, 0.2) !important;
      position: relative !important;
      box-shadow: 0 0 0 1px #f59e0b inset !important;
    }
    
    .element-selector-container::before {
      content: " Container - Click elements inside me";
      position: absolute !important;
      top: -35px !important;
      left: 0 !important;
      background: #f59e0b !important;
      color: white !important;
      padding: 4px 8px !important;
      font-size: 13px !important;
      font-weight: bold !important;
      border-radius: 4px !important;
      z-index: 10000 !important;
      white-space: nowrap !important;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3) !important;
    }
    
    /* Field highlighting within containers (green) */
    .element-selector-field {
      outline: 2px solid #10b981 !important;
      outline-offset: 1px !important;
      background-color: rgba(16, 185, 129, 0.15) !important;
      position: relative !important;
    }
    
    .element-selector-field::before {
      content: " Field";
      position: absolute !important;
      top: -20px !important;
      left: 0 !important;
      background: #10b981 !important;
      color: white !important;
      padding: 2px 6px !important;
      font-size: 10px !important;
      border-radius: 3px !important;
      z-index: 10001 !important;
      white-space: nowrap !important;
    }
    
    /* Temporary hover highlighting classes */
    .temp-multi-hover {
      outline: 3px solid #f59e0b !important;
      background-color: rgba(245, 158, 11, 0.1) !important;
    }
    
    .temp-field-hover {
      outline: 3px solid #10b981 !important;
      background-color: rgba(16, 185, 129, 0.1) !important;
    }
    
    /* Overlay container for positioned highlights */
    .element-selector-overlay-container {
      position: absolute !important;
      top: 0 !important;
      left: 0 !important;
      pointer-events: none !important;
      z-index: 9999 !important;
    }
    
    .element-selector-overlay {
      position: absolute !important;
      pointer-events: none !important;
      z-index: 9999 !important;
    }
    
    .element-selector-tooltip {
      position: absolute !important;
      background: rgba(0, 0, 0, 0.8) !important;
      color: white !important;
      padding: 4px 8px !important;
      border-radius: 4px !important;
      font-size: 12px !important;
      font-family: monospace !important;
      white-space: nowrap !important;
      z-index: 10000 !important;
      pointer-events: none !important;
    }
  `;
  iframeDoc.head.appendChild(style);

  // Create overlay container for positioned highlights
  let overlayContainer = iframeDoc.querySelector(".element-selector-overlay-container") as HTMLElement;
  if (!overlayContainer) {
    overlayContainer = iframeDoc.createElement("div");
    overlayContainer.className = "element-selector-overlay-container";
    iframeDoc.body.appendChild(overlayContainer);
  }

  console.log("Iframe element selection system set up successfully");
};

/**
 * Send message to iframe
 */
export const sendMessageToIframe = (
  iframe: HTMLIFrameElement,
  message: IframeMessage
): void => {
  try {
    if (iframe.contentWindow) {
      iframe.contentWindow.postMessage(message, "*");
      console.log(`Sent message to iframe:`, message);
    }
  } catch (error) {
    console.error("Failed to send message to iframe:", error);
  }
};

/**
 * Setup message listener for iframe communication
 */
export const setupIframeMessageListener = (
  onMessage: (message: IframeMessage) => void
): (() => void) => {
  const handleMessage = (event: MessageEvent) => {
    // Only process messages from our iframe
    if (event.data && typeof event.data === 'object' && event.data.type) {
      console.log("Received message from iframe:", event.data);
      onMessage(event.data);
    }
  };

  window.addEventListener("message", handleMessage);
  
  // Return cleanup function
  return () => {
    window.removeEventListener("message", handleMessage);
  };
};

/**
 * Enable selection mode in iframe
 */
export const enableIframeSelection = (
  iframe: HTMLIFrameElement,
  mode: SelectionMode
): void => {
  sendMessageToIframe(iframe, {
    type: "ENABLE_SELECTOR_MODE",
    selectionMode: mode,
    enabled: true,
  });
};

/**
 * Disable selection mode in iframe
 */
export const disableIframeSelection = (iframe: HTMLIFrameElement): void => {
  sendMessageToIframe(iframe, {
    type: "DISABLE_SELECTOR_MODE",
    enabled: false,
  });
};

/**
 * Set container selector in iframe (for repeating mode)
 */
export const setIframeContainerSelector = (
  iframe: HTMLIFrameElement,
  selector: string | null
): void => {
  sendMessageToIframe(iframe, {
    type: "SET_CONTAINER_SELECTOR",
    selector,
  });
};