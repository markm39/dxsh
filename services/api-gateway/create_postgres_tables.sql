-- Create workflow engine tables for PostgreSQL
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS workflow_agents (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    agent_type VARCHAR(50) NOT NULL DEFAULT 'WORKFLOW',
    status VARCHAR(50) NOT NULL DEFAULT 'INACTIVE',
    workflow_data JSONB,
    auto_execute BOOLEAN DEFAULT FALSE,
    execution_interval INTEGER,
    max_executions INTEGER,
    trigger_type VARCHAR(50) DEFAULT 'MANUAL',
    trigger_config JSONB,
    actions JSONB,
    notification_channels JSONB,
    notification_config JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS agent_workflows (
    id SERIAL PRIMARY KEY,
    agent_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    nodes JSONB NOT NULL,
    edges JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (agent_id) REFERENCES workflow_agents (id),
    FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE TABLE IF NOT EXISTS monitoring_jobs (
    id SERIAL PRIMARY KEY,
    agent_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    url VARCHAR(2048) NOT NULL,
    selectors JSONB NOT NULL,
    frequency INTEGER DEFAULT 3600,
    change_threshold FLOAT DEFAULT 0.1,
    is_active BOOLEAN DEFAULT TRUE,
    last_check TIMESTAMP,
    last_content_hash VARCHAR(64),
    consecutive_failures INTEGER DEFAULT 0,
    total_checks INTEGER DEFAULT 0,
    total_changes_detected INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (agent_id) REFERENCES workflow_agents (id),
    FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE TABLE IF NOT EXISTS workflow_executions (
    id SERIAL PRIMARY KEY,
    agent_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    status VARCHAR(20) DEFAULT 'pending',
    error_message TEXT,
    workflow_nodes JSONB NOT NULL,
    workflow_edges JSONB NOT NULL,
    FOREIGN KEY (agent_id) REFERENCES workflow_agents (id),
    FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE TABLE IF NOT EXISTS change_records (
    id SERIAL PRIMARY KEY,
    monitoring_job_id INTEGER NOT NULL,
    selector VARCHAR(500),
    label VARCHAR(255),
    old_value TEXT,
    new_value TEXT,
    change_type VARCHAR(50),
    detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notification_sent BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (monitoring_job_id) REFERENCES monitoring_jobs (id)
);

CREATE TABLE IF NOT EXISTS node_executions (
    id SERIAL PRIMARY KEY,
    execution_id INTEGER NOT NULL,
    node_id VARCHAR(255) NOT NULL,
    node_type VARCHAR(50) NOT NULL,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    status VARCHAR(20) DEFAULT 'pending',
    error_message TEXT,
    input_config JSONB,
    output_data JSONB,
    node_specific_data JSONB,
    FOREIGN KEY (execution_id) REFERENCES workflow_executions (id)
);

CREATE TABLE IF NOT EXISTS workflow_nodes (
    id VARCHAR(255) PRIMARY KEY,
    workflow_id INTEGER NOT NULL,
    node_type VARCHAR(50) NOT NULL,
    position_x FLOAT NOT NULL,
    position_y FLOAT NOT NULL,
    data JSONB NOT NULL,
    configured BOOLEAN DEFAULT FALSE,
    monitoring_job_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (monitoring_job_id) REFERENCES monitoring_jobs (id),
    FOREIGN KEY (workflow_id) REFERENCES agent_workflows (id)
);

CREATE TABLE IF NOT EXISTS ml_models (
    id SERIAL PRIMARY KEY,
    node_execution_id INTEGER NOT NULL,
    model_type VARCHAR(50) NOT NULL,
    model_name VARCHAR(200),
    feature_names JSONB NOT NULL,
    target_name VARCHAR(100) NOT NULL,
    n_features INTEGER NOT NULL,
    n_samples INTEGER NOT NULL,
    train_size INTEGER NOT NULL,
    test_size INTEGER NOT NULL,
    model_config JSONB,
    training_metrics JSONB NOT NULL,
    model_metadata JSONB,
    model_file_path VARCHAR(500) NOT NULL,
    model_file_size INTEGER,
    preprocessing_notes TEXT,
    user_instructions TEXT,
    tokens_used INTEGER,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (node_execution_id) REFERENCES node_executions (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ml_model_predictions (
    id SERIAL PRIMARY KEY,
    model_id INTEGER NOT NULL,
    input_data JSONB NOT NULL,
    predictions JSONB NOT NULL,
    prediction_metadata JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (model_id) REFERENCES ml_models (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ml_training_data (
    id SERIAL PRIMARY KEY,
    model_id INTEGER NOT NULL,
    features_data JSONB NOT NULL,
    targets_data JSONB NOT NULL,
    visualization_data JSONB,
    data_split VARCHAR(20) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
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
INSERT INTO alembic_version (version_num) VALUES ('2542aaa2426b') ON CONFLICT DO NOTHING;

-- Insert default admin user
INSERT INTO users (email, password_hash, is_active) 
VALUES ('admin@dxsh.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/2beBUEwKZLdYPPKmS', TRUE)
ON CONFLICT (email) DO NOTHING;