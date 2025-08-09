import React from "react";
import { Globe, Hash, Brain, BarChart3, TrendingUp, Settings, Activity, Database, Globe2, TreePine, FileText } from "lucide-react";
import { NodeType, SidebarSection, DashboardTab } from "./types";

export const NODE_TYPES: NodeType[] = [
  {
    id: "web-source",
    type: "webSource",
    label: "Web Source",
    icon: React.createElement(Globe, { className: "w-4 h-4 text-blue-600" }),
    description: "Monitor web pages for changes",
  },
  {
    id: "data-structuring",
    type: "dataStructuring",
    label: "Data Structuring",
    icon: React.createElement(Hash, { className: "w-4 h-4 text-gray-600" }),
    description: "Extract structured data with regex",
  },
  {
    id: "ai-processor",
    type: "aiProcessor",
    label: "AI Processor",
    icon: React.createElement(Brain, { className: "w-4 h-4 text-purple-600" }),
    description: "Process data with AI prompts",
  },
  {
    id: "chart-generator",
    type: "chartGenerator",
    label: "Chart Generator",
    icon: React.createElement(BarChart3, { className: "w-4 h-4 text-green-600" }),
    description: "Generate structured chart data",
  },
  {
    id: "linear-regression",
    type: "linearRegression",
    label: "Linear Regression",
    icon: React.createElement(TrendingUp, { className: "w-4 h-4 text-orange-600" }),
    description: "Train linear regression models",
  },
  {
    id: "random-forest",
    type: "randomForest",
    label: "Random Forest",
    icon: React.createElement(TreePine, { className: "w-4 h-4 text-green-600" }),
    description: "Train ensemble decision tree models",
  },
  {
    id: "postgres",
    type: "postgres",
    label: "PostgreSQL",
    icon: React.createElement(Database, { className: "w-4 h-4 text-purple-600" }),
    description: "Connect to PostgreSQL database",
  },
  {
    id: "http-request",
    type: "httpRequest",
    label: "HTTP Request",
    icon: React.createElement(Globe2, { className: "w-4 h-4 text-indigo-600" }),
    description: "Make API calls with authentication",
  },
  {
    id: "file-node",
    type: "fileNode",
    label: "File Node",
    icon: React.createElement(FileText, { className: "w-4 h-4 text-orange-600" }),
    description: "Load from or save to files (JSON, CSV, Excel, TXT, DOC)",
  },
];

export const SIDEBAR_SECTIONS: SidebarSection[] = [
  {
    title: "Data Sources",
    items: NODE_TYPES.filter(node => 
      ["webSource", "httpRequest", "dataStructuring"].includes(node.type)
    ),
  },
  {
    title: "AI Processing",
    items: NODE_TYPES.filter(node => 
      ["aiProcessor", "linearRegression", "randomForest"].includes(node.type)
    ),
  },
  {
    title: "Storage",
    items: NODE_TYPES.filter(node => 
      ["postgres", "fileNode"].includes(node.type)
    ),
  },
  {
    title: "Visualization",
    items: NODE_TYPES.filter(node => 
      ["chartGenerator"].includes(node.type)
    ),
  },
];

export const DASHBOARD_TABS: DashboardTab[] = [
  {
    id: "workflow",
    label: "Workflow",
    icon: React.createElement(Settings, { className: "w-4 h-4" }),
  },
  {
    id: "dashboard",
    label: "Dashboard",
    icon: React.createElement(Activity, { className: "w-4 h-4" }),
  },
];