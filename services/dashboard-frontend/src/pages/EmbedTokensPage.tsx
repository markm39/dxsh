import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Copy, 
  ExternalLink, 
  Trash2, 
  Settings, 
  Key, 
  Calendar,
  Eye,
  EyeOff,
  Globe,
  Shield,
  Activity,
  ArrowLeft,
  Home
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import { useAuthHeaders } from '../providers/AuthProvider';

interface EmbedToken {
  id: number;
  token: string;
  name: string;
  description: string;
  dashboard_id?: number;
  widget_id?: number;
  expires_at?: string;
  allowed_domains: string[];
  allowed_ips: string[];
  usage_count: number;
  max_usage?: number;
  last_used_at?: string;
  created_at: string;
  is_valid: boolean;
  is_expired: boolean;
  is_usage_exceeded: boolean;
}

interface Dashboard {
  id: number;
  name: string;
}

interface Widget {
  id: number;
  title: string;
  dashboard_id: number;
}

const EmbedTokensPage: React.FC = () => {
  const navigate = useNavigate();
  const authHeaders = useAuthHeaders();
  const [tokens, setTokens] = useState<EmbedToken[]>([]);
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [visibleTokens, setVisibleTokens] = useState<Set<number>>(new Set());

  // Create token form state
  const [createForm, setCreateForm] = useState({
    name: '',
    description: '',
    type: 'dashboard' as 'dashboard' | 'widget',
    dashboard_id: '',
    widget_id: '',
    expires_in_days: '',
    allowed_domains: '',
    allowed_ips: '',
    max_usage: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load dashboards first (this works)
      try {
        const dashboardsResponse = await apiService.get('/dashboards', authHeaders);
        if (dashboardsResponse.data) {
          setDashboards(dashboardsResponse.data);
          
          // Load all widgets for all dashboards
          const allWidgets: Widget[] = [];
          for (const dashboard of dashboardsResponse.data) {
            if (dashboard.widgets && dashboard.widgets.length > 0) {
              for (const widget of dashboard.widgets) {
                allWidgets.push({
                  id: widget.id,
                  title: widget.title,
                  dashboard_id: dashboard.id
                });
              }
            }
          }
          setWidgets(allWidgets);
        }
      } catch (error) {
        console.error('Error loading dashboards:', error);
      }

      // Load embed tokens (may fail due to endpoint issue)
      try {
        const tokensResponse = await apiService.get('/embed-tokens', authHeaders);
        if (tokensResponse.data) {
          setTokens(tokensResponse.data);
        }
      } catch (error) {
        console.error('Error loading embed tokens (endpoint may not be available yet):', error);
        setTokens([]); // Set empty array so UI still works
      }
      
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const createToken = async () => {
    try {
      const tokenData = {
        name: createForm.name,
        description: createForm.description,
        expires_in_days: createForm.expires_in_days ? parseInt(createForm.expires_in_days) : null,
        allowed_domains: createForm.allowed_domains ? createForm.allowed_domains.split(',').map(d => d.trim()) : [],
        allowed_ips: createForm.allowed_ips ? createForm.allowed_ips.split(',').map(ip => ip.trim()) : [],
        max_usage: createForm.max_usage ? parseInt(createForm.max_usage) : null
      };

      const endpoint = createForm.type === 'dashboard' 
        ? `/dashboards/${createForm.dashboard_id}/embed-tokens`
        : `/widgets/${createForm.widget_id}/embed-tokens`;

      const response = await apiService.post(endpoint, tokenData, authHeaders);
      
      if (response.success) {
        setShowCreateModal(false);
        setCreateForm({
          name: '',
          description: '',
          type: 'dashboard',
          dashboard_id: '',
          widget_id: '',
          expires_in_days: '',
          allowed_domains: '',
          allowed_ips: '',
          max_usage: ''
        });
        loadData();
      }
    } catch (error) {
      console.error('Error creating embed token:', error);
    }
  };

  const deleteToken = async (tokenId: number) => {
    if (!confirm('Are you sure you want to delete this embed token? This will break any existing embeds using this token.')) {
      return;
    }

    try {
      await apiService.delete(`/embed-tokens/${tokenId}`, authHeaders);
      loadData();
    } catch (error) {
      console.error('Error deleting embed token:', error);
    }
  };

  const copyToken = (token: string) => {
    navigator.clipboard.writeText(token);
    // Could add a toast notification here
  };

  const copyEmbedCode = (token: EmbedToken) => {
    const apiUrl = import.meta.env['VITE_API_BASE_URL'] || `${window.location.protocol}//${window.location.hostname}:8001`;
    const embedType = token.dashboard_id ? 'dashboard' : 'widget';
    const resourceId = token.dashboard_id || token.widget_id;
    const height = token.dashboard_id ? '500' : '300'; // Different heights for dashboard vs widget
    
    const embedCode = `<iframe 
  src="${apiUrl}/api/v1/embed/${embedType}/${resourceId}?token=${token.token}&theme=light&refresh=30" 
  width="100%" 
  height="${height}"
  frameborder="0"
  title="${token.name}">
</iframe>`;

    navigator.clipboard.writeText(embedCode);
  };

  const toggleTokenVisibility = (tokenId: number) => {
    const newVisible = new Set(visibleTokens);
    if (newVisible.has(tokenId)) {
      newVisible.delete(tokenId);
    } else {
      newVisible.add(tokenId);
    }
    setVisibleTokens(newVisible);
  };

  const getResourceInfo = (token: EmbedToken) => {
    if (token.dashboard_id) {
      const dashboard = dashboards.find(d => d.id === token.dashboard_id);
      return {
        type: 'Dashboard',
        name: dashboard ? dashboard.name : 'Unknown Dashboard',
        id: token.dashboard_id,
        displayText: dashboard ? `Dashboard: ${dashboard.name}` : 'Dashboard'
      };
    } else if (token.widget_id) {
      const widget = widgets.find(w => w.id === token.widget_id);
      return {
        type: 'Widget',
        name: widget ? widget.title : 'Unknown Widget',
        id: token.widget_id,
        displayText: widget ? `Widget: ${widget.title}` : 'Widget'
      };
    }
    return {
      type: 'Unknown',
      name: 'Unknown',
      id: null,
      displayText: 'Unknown'
    };
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-text-muted">Loading embed tokens...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto">
        {/* Navigation Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 px-3 py-2 text-text-secondary hover:text-text-primary hover:bg-surface border border-border-subtle rounded-lg transition-colors"
            title="Go back"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 px-3 py-2 text-text-secondary hover:text-text-primary hover:bg-surface border border-border-subtle rounded-lg transition-colors"
            title="Go home"
          >
            <Home className="w-4 h-4" />
            Home
          </button>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-text-primary">Embed Tokens</h1>
            <p className="text-text-muted mt-2">
              Create secure tokens to embed dashboards and widgets on external websites
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Token
          </button>
        </div>

        {/* Tokens List */}
        <div className="space-y-4">
          {tokens.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-border-subtle rounded-lg">
              <Key className="w-12 h-12 text-text-muted mx-auto mb-4" />
              <h3 className="text-lg font-medium text-text-primary mb-2">No embed tokens yet</h3>
              <p className="text-text-muted mb-4">
                Create your first embed token to start sharing dashboards and widgets
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg transition-colors"
              >
                Create Token
              </button>
            </div>
          ) : (
            tokens.map(token => {
              const resourceInfo = getResourceInfo(token);
              return (
                <div key={token.id} className="bg-surface border border-border-subtle rounded-lg p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-medium text-text-primary mb-1">{token.name}</h3>
                      <div className="flex items-center gap-4 text-sm mb-2">
                        <span className="text-text-muted">{resourceInfo.displayText}</span>
                        <span className="px-2 py-1 bg-primary/10 text-primary text-xs font-mono rounded">
                          ID: {resourceInfo.id}
                        </span>
                      </div>
                      {token.description && (
                        <p className="text-text-secondary text-sm">{token.description}</p>
                      )}
                    </div>
                  
                  <div className="flex items-center gap-2">
                    {!token.is_valid && (
                      <span className="px-2 py-1 bg-red-500/10 text-red-400 text-xs rounded">
                        {token.is_expired ? 'Expired' : 'Usage Exceeded'}
                      </span>
                    )}
                    <button
                      onClick={() => copyEmbedCode(token)}
                      className="p-2 hover:bg-surface-secondary rounded text-text-muted hover:text-text-primary"
                      title="Copy embed code"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteToken(token.id)}
                      className="p-2 hover:bg-red-500/20 rounded text-red-400"
                      title="Delete token"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Token */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-text-primary mb-2">Token</label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 px-3 py-2 bg-background border border-border-subtle rounded text-sm font-mono">
                      {visibleTokens.has(token.id) 
                        ? token.token 
                        : '•'.repeat(token.token.length)
                      }
                    </code>
                    <button
                      onClick={() => toggleTokenVisibility(token.id)}
                      className="p-2 hover:bg-surface-secondary rounded text-text-muted hover:text-text-primary"
                    >
                      {visibleTokens.has(token.id) ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => copyToken(token.token)}
                      className="p-2 hover:bg-surface-secondary rounded text-text-muted hover:text-text-primary"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Embed Information */}
                <div className="mb-4 p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg">
                  <h4 className="text-sm font-medium text-text-primary mb-2">📋 Embed Information</h4>
                  <div className="text-xs text-text-muted mb-1">Embed URL:</div>
                  <code className="block text-xs bg-background px-2 py-1 rounded border text-blue-600 break-all">
                    {import.meta.env['VITE_API_BASE_URL'] || `${window.location.protocol}//${window.location.hostname}:8001`}/api/v1/embed/{token.dashboard_id ? 'dashboard' : 'widget'}/{resourceInfo.id}?token={token.token}
                  </code>
                  <div className="text-xs text-text-muted mt-2">
                    Use this {resourceInfo.type} ID ({resourceInfo.id}) and token for embedding
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="flex items-center gap-1 text-text-muted mb-1">
                      <Activity className="w-3 h-3" />
                      Usage
                    </div>
                    <div className="text-text-primary">
                      {token.usage_count}{token.max_usage ? ` / ${token.max_usage}` : ''}
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex items-center gap-1 text-text-muted mb-1">
                      <Calendar className="w-3 h-3" />
                      Expires
                    </div>
                    <div className="text-text-primary">
                      {token.expires_at ? formatDate(token.expires_at) : 'Never'}
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex items-center gap-1 text-text-muted mb-1">
                      <Globe className="w-3 h-3" />
                      Domains
                    </div>
                    <div className="text-text-primary">
                      {token.allowed_domains.length || 'All'}
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex items-center gap-1 text-text-muted mb-1">
                      <Shield className="w-3 h-3" />
                      Last Used
                    </div>
                    <div className="text-text-primary">
                      {token.last_used_at ? formatDate(token.last_used_at) : 'Never'}
                    </div>
                  </div>
                </div>
              </div>
              );
            })
          )}
        </div>

        {/* Create Token Modal */}
        {showCreateModal && (
          <div 
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowCreateModal(false)}
          >
            <div 
              className="bg-background rounded-2xl shadow-2xl border border-border-subtle max-w-md w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 border-b border-border-subtle">
                <h2 className="text-lg font-bold text-text-primary">Create Embed Token</h2>
                <p className="text-text-muted text-xs mt-1">
                  Generate a secure token for embedding dashboards or widgets
                </p>
              </div>
              
              <div className="p-4 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-text-primary mb-1">
                    Name *
                  </label>
                  <input
                    type="text"
                    value={createForm.name}
                    onChange={(e) => setCreateForm({...createForm, name: e.target.value})}
                    placeholder="e.g., Marketing Dashboard Token"
                    className="w-full px-2 py-1.5 text-sm bg-background border border-border-subtle rounded focus:border-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-text-primary mb-1">
                    Description
                  </label>
                  <textarea
                    value={createForm.description}
                    onChange={(e) => setCreateForm({...createForm, description: e.target.value})}
                    placeholder="Optional description"
                    rows={1}
                    className="w-full px-2 py-1.5 text-sm bg-background border border-border-subtle rounded focus:border-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Embed Type
                  </label>
                  <select
                    value={createForm.type}
                    onChange={(e) => setCreateForm({...createForm, type: e.target.value as 'dashboard' | 'widget'})}
                    className="w-full px-3 py-2 bg-background border border-border-subtle rounded-lg focus:border-primary focus:outline-none"
                  >
                    <option value="dashboard">Dashboard</option>
                    <option value="widget">Widget</option>
                  </select>
                </div>

                {createForm.type === 'dashboard' ? (
                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-2">
                      Dashboard *
                    </label>
                    <select
                      value={createForm.dashboard_id}
                      onChange={(e) => setCreateForm({...createForm, dashboard_id: e.target.value})}
                      className="w-full px-3 py-2 bg-background border border-border-subtle rounded-lg focus:border-primary focus:outline-none"
                    >
                      <option value="">Select a dashboard</option>
                      {dashboards.map(dashboard => (
                        <option key={dashboard.id} value={dashboard.id}>
                          {dashboard.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-2">
                      Widget *
                    </label>
                    <select
                      value={createForm.widget_id}
                      onChange={(e) => setCreateForm({...createForm, widget_id: e.target.value})}
                      className="w-full px-3 py-2 bg-background border border-border-subtle rounded-lg focus:border-primary focus:outline-none"
                    >
                      <option value="">Select a widget</option>
                      {widgets.map(widget => (
                        <option key={widget.id} value={widget.id}>
                          {widget.title}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Expires In (Days)
                  </label>
                  <input
                    type="number"
                    value={createForm.expires_in_days}
                    onChange={(e) => setCreateForm({...createForm, expires_in_days: e.target.value})}
                    placeholder="Leave empty for no expiration"
                    className="w-full px-3 py-2 bg-background border border-border-subtle rounded-lg focus:border-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Allowed Domains
                  </label>
                  <input
                    type="text"
                    value={createForm.allowed_domains}
                    onChange={(e) => setCreateForm({...createForm, allowed_domains: e.target.value})}
                    placeholder="example.com, *.mysite.com (comma separated)"
                    className="w-full px-3 py-2 bg-background border border-border-subtle rounded-lg focus:border-primary focus:outline-none"
                  />
                  <p className="text-xs text-text-muted mt-1">
                    Leave empty to allow all domains. Use * for wildcards.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Max Usage
                  </label>
                  <input
                    type="number"
                    value={createForm.max_usage}
                    onChange={(e) => setCreateForm({...createForm, max_usage: e.target.value})}
                    placeholder="Leave empty for unlimited"
                    className="w-full px-3 py-2 bg-background border border-border-subtle rounded-lg focus:border-primary focus:outline-none"
                  />
                </div>
              </div>

              <div className="p-6 border-t border-border-subtle flex justify-end gap-3">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-text-muted hover:text-text-primary transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={createToken}
                  disabled={!createForm.name || 
                    (createForm.type === 'dashboard' ? !createForm.dashboard_id : !createForm.widget_id)}
                  className="px-4 py-2 bg-primary hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                >
                  Create Token
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmbedTokensPage;