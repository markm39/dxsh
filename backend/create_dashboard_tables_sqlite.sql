-- SQLite migration for dashboard and widget tables

-- Create dashboards table
CREATE TABLE IF NOT EXISTS dashboards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Create index on user_id for performance
CREATE INDEX IF NOT EXISTS idx_dashboard_user ON dashboards(user_id);

-- Create dashboard_widgets table
CREATE TABLE IF NOT EXISTS dashboard_widgets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dashboard_id INTEGER NOT NULL,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    position TEXT NOT NULL DEFAULT '{"x": 0, "y": 0, "w": 6, "h": 4}',
    agent_id INTEGER,
    node_id VARCHAR(255),
    config TEXT DEFAULT '{}',
    refresh_on_workflow_complete BOOLEAN DEFAULT 1,
    refresh_interval INTEGER,
    cached_data TEXT,
    last_updated TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    FOREIGN KEY (dashboard_id) REFERENCES dashboards(id) ON DELETE CASCADE,
    FOREIGN KEY (agent_id) REFERENCES workflow_agents(id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_widget_dashboard ON dashboard_widgets(dashboard_id);
CREATE INDEX IF NOT EXISTS idx_widget_agent_node ON dashboard_widgets(agent_id, node_id);