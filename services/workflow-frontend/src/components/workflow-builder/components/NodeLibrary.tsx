import React from "react";
import { SidebarSection } from "../types";

interface NodeLibraryProps {
  sections: SidebarSection[];
  onDragStart: (event: React.DragEvent, type: string) => void;
}

const NodeLibrary: React.FC<NodeLibraryProps> = ({ sections, onDragStart }) => {
  return (
    <div className="w-64 bg-background border-r border-border-subtle flex flex-col h-full overflow-hidden">
      <div className="p-4 border-b border-border-subtle flex-shrink-0">
        <h3 className="text-lg font-semibold text-text-primary">
          Node Library
        </h3>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 min-h-0">
      
      {sections.map((section) => (
        <div key={section.title} className="mb-6">
          <h4 className="text-sm font-medium text-text-secondary mb-3 uppercase tracking-wide">
            {section.title}
          </h4>
          
          <div className="space-y-2">
            {section.items.map((nodeType) => (
              <div
                key={nodeType.id}
                draggable
                onDragStart={(event) => onDragStart(event, nodeType.type)}
                className="p-3 bg-surface hover:bg-surface-secondary border border-border-subtle rounded-lg cursor-grab active:cursor-grabbing transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    {nodeType.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-text-primary">
                      {nodeType.label}
                    </div>
                    <div className="text-xs text-text-muted line-clamp-2">
                      {nodeType.description}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      
        <div className="text-xs text-text-muted bg-surface p-3 rounded-lg mt-4">
          💡 <strong>Tip:</strong> Drag nodes to the canvas to build your workflow
        </div>
      </div>
    </div>
  );
};

export default NodeLibrary;