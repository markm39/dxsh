-- Create workflow engine tables
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS workflow_agents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    agent_type VARCHAR(50) NOT NULL DEFAULT 'WORKFLOW',
    status VARCHAR(50) NOT NULL DEFAULT 'INACTIVE',
    workflow_data JSON,
    auto_execute BOOLEAN DEFAULT FALSE,
    execution_interval INTEGER,
    max_executions INTEGER,
    trigger_type VARCHAR(50) DEFAULT 'MANUAL',
    trigger_config JSON,
    actions JSON,
    notification_channels JSON,
    notification_config JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS agent_workflows (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    nodes JSON NOT NULL,
    edges JSON NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (agent_id) REFERENCES workflow_agents (id),
    FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE TABLE IF NOT EXISTS monitoring_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    url VARCHAR(2048) NOT NULL,
    selectors JSON NOT NULL,
    frequency INTEGER DEFAULT 3600,
    change_threshold FLOAT DEFAULT 0.1,
    is_active BOOLEAN DEFAULT TRUE,
    last_check DATETIME,
    last_content_hash VARCHAR(64),
    consecutive_failures INTEGER DEFAULT 0,
    total_checks INTEGER DEFAULT 0,
    total_changes_detected INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (agent_id) REFERENCES workflow_agents (id),
    FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE TABLE IF NOT EXISTS workflow_executions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    status VARCHAR(20) DEFAULT 'pending',
    error_message TEXT,
    workflow_nodes JSON NOT NULL,
    workflow_edges JSON NOT NULL,
    FOREIGN KEY (agent_id) REFERENCES workflow_agents (id),
    FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE TABLE IF NOT EXISTS change_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    monitoring_job_id INTEGER NOT NULL,
    selector VARCHAR(500),
    label VARCHAR(255),
    old_value TEXT,
    new_value TEXT,
    change_type VARCHAR(50),
    detected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    notification_sent BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (monitoring_job_id) REFERENCES monitoring_jobs (id)
);

CREATE TABLE IF NOT EXISTS node_executions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    execution_id INTEGER NOT NULL,
    node_id VARCHAR(255) NOT NULL,
    node_type VARCHAR(50) NOT NULL,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    status VARCHAR(20) DEFAULT 'pending',
    error_message TEXT,
    input_config JSON,
    output_data JSON,
    node_specific_data JSON,
    FOREIGN KEY (execution_id) REFERENCES workflow_executions (id)
);

CREATE TABLE IF NOT EXISTS workflow_nodes (
    id VARCHAR(255) PRIMARY KEY,
    workflow_id INTEGER NOT NULL,
    node_type VARCHAR(50) NOT NULL,
    position_x FLOAT NOT NULL,
    position_y FLOAT NOT NULL,
    data JSON NOT NULL,
    configured BOOLEAN DEFAULT FALSE,
    monitoring_job_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (monitoring_job_id) REFERENCES monitoring_jobs (id),
    FOREIGN KEY (workflow_id) REFERENCES agent_workflows (id)
);

CREATE TABLE IF NOT EXISTS ml_models (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    node_execution_id INTEGER NOT NULL,
    model_type VARCHAR(50) NOT NULL,
    model_name VARCHAR(200),
    feature_names JSON NOT NULL,
    target_name VARCHAR(100) NOT NULL,
    n_features INTEGER NOT NULL,
    n_samples INTEGER NOT NULL,
    train_size INTEGER NOT NULL,
    test_size INTEGER NOT NULL,
    model_config JSON,
    training_metrics JSON NOT NULL,
    model_metadata JSON,
    model_file_path VARCHAR(500) NOT NULL,
    model_file_size INTEGER,
    preprocessing_notes TEXT,
    user_instructions TEXT,
    tokens_used INTEGER,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (node_execution_id) REFERENCES node_executions (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ml_model_predictions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    model_id INTEGER NOT NULL,
    input_data JSON NOT NULL,
    predictions JSON NOT NULL,
    prediction_metadata JSON,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (model_id) REFERENCES ml_models (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ml_training_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    model_id INTEGER NOT NULL,
    features_data JSON NOT NULL,
    targets_data JSON NOT NULL,
    visualization_data JSON,
    data_split VARCHAR(20) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (model_id) REFERENCES ml_models (id) ON DELETE CASCADE
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_ml_models_created_at ON ml_models(created_at);
CREATE INDEX IF NOT EXISTS idx_ml_models_model_type ON ml_models(model_type);
CREATE INDEX IF NOT EXISTS idx_ml_model_predictions_created_at ON ml_model_predictions(created_at);
CREATE INDEX IF NOT EXISTS idx_ml_training_data_data_split ON ml_training_data(data_split);

-- Create alembic version table to track migrations
CREATE TABLE IF NOT EXISTS alembic_version (
    version_num VARCHAR(32) NOT NULL PRIMARY KEY
);

-- Mark this migration as complete
INSERT INTO alembic_version (version_num) VALUES ('2542aaa2426b');