/**
 * Text Widget Component
 * 
 * Displays text content with support for markdown rendering
 */

import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { DashboardWidget, TextWidgetConfig } from '@shared/types';
import { useWidgetData } from '../../hooks/useWidgetData';

interface TextWidgetProps {
  dashboardId: string;
  widget: DashboardWidget;
  isEditMode?: boolean;
}

const TextWidget: React.FC<TextWidgetProps> = ({
  dashboardId,
  widget,
  isEditMode = false,
}) => {
  const config = widget.config as TextWidgetConfig;
  const { data, isLoading, error, isError, lastUpdated } = useWidgetData(dashboardId, widget);

  // Get the text content from data or fallback to config content
  const getTextContent = (): string => {
    if (data) {
      // If data is a string, use it directly
      if (typeof data === 'string') {
        return data;
      }
      
      // If data is an object, try to extract text from common fields
      if (typeof data === 'object' && data !== null) {
        // Try common text fields
        const textFields = ['text', 'content', 'message', 'output', 'result', 'value'];
        for (const field of textFields) {
          if (data[field] && typeof data[field] === 'string') {
            return data[field];
          }
        }
        
        // If no text field found, stringify the object
        return JSON.stringify(data, null, 2);
      }
    }
    
    // Fallback to config content
    return config.content || 'No content available';
  };

  const textContent = getTextContent();

  // Apply template variables if they exist
  const processedContent = React.useMemo(() => {
    let content = textContent;
    
    if (config.templateVariables) {
      Object.entries(config.templateVariables).forEach(([key, value]) => {
        content = content.replace(new RegExp(`{{${key}}}`, 'g'), value);
      });
    }
    
    return content;
  }, [textContent, config.templateVariables]);

  // Loading state
  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-sm text-text-secondary">Loading content...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (isError && error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center text-red-400">
          <p className="font-medium mb-1">Content Error</p>
          <p className="text-sm">{error.message}</p>
        </div>
      </div>
    );
  }

  const textStyle = {
    fontSize: config.fontSize ? `${config.fontSize}px` : undefined,
    fontWeight: config.fontWeight || 'normal',
    textAlign: config.textAlign || 'left',
    color: config.color || undefined,
    backgroundColor: config.backgroundColor || undefined,
  };

  return (
    <div className="h-full flex flex-col">
      {/* Content */}
      <div className="flex-1 overflow-auto p-4" style={textStyle}>
        {config.format === 'markdown' ? (
          <ReactMarkdown
            className="prose prose-sm max-w-none dark:prose-invert prose-headings:text-center prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg prose-h1:font-bold prose-h2:font-semibold prose-h3:font-medium prose-p:leading-relaxed prose-li:my-1"
            components={{
              // Custom heading components for better styling
              h1: ({ children }) => (
                <h1 className="text-2xl font-bold text-center mb-6 pb-2 border-b border-border-subtle">
                  {children}
                </h1>
              ),
              h2: ({ children }) => (
                <h2 className="text-xl font-semibold text-center mb-4 text-primary">
                  {children}
                </h2>
              ),
              h3: ({ children }) => (
                <h3 className="text-lg font-medium text-center mb-3">
                  {children}
                </h3>
              ),
              // Enhanced paragraphs
              p: ({ children }) => (
                <p className="mb-4 leading-relaxed text-text-primary">
                  {children}
                </p>
              ),
              // Better lists
              ul: ({ children }) => (
                <ul className="mb-4 space-y-2 ml-6">
                  {children}
                </ul>
              ),
              ol: ({ children }) => (
                <ol className="mb-4 space-y-2 ml-6">
                  {children}
                </ol>
              ),
              li: ({ children }) => (
                <li className="flex items-start">
                  <span className="text-primary mr-2">•</span>
                  <span>{children}</span>
                </li>
              ),
              // Enhanced blockquotes
              blockquote: ({ children }) => (
                <blockquote className="border-l-4 border-primary bg-surface-secondary/30 pl-4 py-2 mb-4 italic">
                  {children}
                </blockquote>
              ),
              // Enhanced tables
              table: ({ children }) => (
                <div className="overflow-x-auto mb-4">
                  <table className="min-w-full border border-border-subtle rounded-lg">
                    {children}
                  </table>
                </div>
              ),
              th: ({ children }) => (
                <th className="px-4 py-2 bg-surface-secondary text-left font-semibold border-b border-border-subtle">
                  {children}
                </th>
              ),
              td: ({ children }) => (
                <td className="px-4 py-2 border-b border-border-subtle">
                  {children}
                </td>
              ),
              // Enhanced code blocks
              code({ node, inline, className, children, ...props }) {
                const match = /language-(\w+)/.exec(className || '');
                return !inline && match ? (
                  <SyntaxHighlighter
                    style={oneDark}
                    language={match[1]}
                    PreTag="div"
                    className="rounded-lg mb-4"
                    {...props}
                  >
                    {String(children).replace(/\n$/, '')}
                  </SyntaxHighlighter>
                ) : (
                  <code className="bg-surface-secondary px-1 py-0.5 rounded text-sm font-mono" {...props}>
                    {children}
                  </code>
                );
              },
              // Enhanced horizontal rules
              hr: () => (
                <hr className="my-8 border-border-subtle" />
              ),
              // Enhanced links
              a: ({ href, children }) => (
                <a 
                  href={href} 
                  className="text-primary hover:text-primary-hover underline decoration-primary/30 hover:decoration-primary transition-colors"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {children}
                </a>
              ),
            }}
          >
            {processedContent}
          </ReactMarkdown>
        ) : config.format === 'html' ? (
          <div 
            dangerouslySetInnerHTML={{ __html: processedContent }}
            className="prose prose-sm max-w-none dark:prose-invert"
          />
        ) : (
          <pre className="whitespace-pre-wrap font-sans">{processedContent}</pre>
        )}
      </div>

      {/* Footer with last updated info and word count - conditional based on showFooter setting */}
      {!isEditMode && widget.showFooter !== false && (
        <div className="px-4 py-2 border-t border-border-subtle">
          <div className="flex justify-between items-center text-2xs text-text-secondary">
            <div>
              {lastUpdated && (
                <span>Updated {lastUpdated.toLocaleTimeString()}</span>
              )}
            </div>
            <div>
              {processedContent.split(/\s+/).filter(word => word.length > 0).length} words
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TextWidget;