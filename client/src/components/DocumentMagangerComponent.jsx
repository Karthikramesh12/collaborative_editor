import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './DocumentManagerComponent.css';

const API_BASE_URL = import.meta.env.VITE_API_URL;

const WorkspaceManagerComponent = () => {
  const [workspaces, setWorkspaces] = useState([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState(null);
  const [workspaceName, setWorkspaceName] = useState('');
  const [users, setUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [inviteData, setInviteData] = useState({ userId: '', role: 'EDITOR' });
  const [showMemberManagement, setShowMemberManagement] = useState(false);
  const [members, setMembers] = useState([]);
  const navigate = useNavigate();

  const apiCall = async (endpoint, method = 'GET', body = null) => {
    try {
      const authToken = localStorage.getItem('auth_token');
      
      const options = {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        }
      };
      
      if (body) {
        options.body = JSON.stringify(body);
      }

      const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Request failed');
      }

      return data;
    } catch (err) {
      throw err;
    }
  };

  const fetchWorkspaces = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiCall('/workspace/');
      setWorkspaces(data.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const createWorkspace = async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const response = await apiCall('/workspace/', 'POST');
      setSuccess('Workspace created successfully!');
      fetchWorkspaces();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteWorkspace = async (workspaceId) => {
    if (!window.confirm('Are you sure you want to delete this workspace?')) return;

    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await apiCall(`/workspace/${workspaceId}`, 'DELETE');
      setSuccess('Workspace deleted successfully!');
      if (selectedWorkspace === workspaceId) {
        closeMemberManagement();
      }
      fetchWorkspaces();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchWorkspaceWithMembers = async (workspaceId) => {
    try {
      const workspaceData = await apiCall(`/workspace/${workspaceId}`);
      return workspaceData.data;
    } catch (err) {
      console.error('Error fetching workspace:', err);
      return null;
    }
  };

  const searchUsers = async (query) => {
    if (!query.trim()) {
      setUsers([]);
      return;
    }

    try {
      const data = await apiCall(`/workspace/search?q=${encodeURIComponent(query)}`);
      setUsers(Array.isArray(data.data) ? data.data : []);
    } catch (err) {
      setError(err.message);
    }
  };

  const inviteMember = async () => {
    if (!selectedWorkspace || !inviteData.userId) return;

    setLoading(true);
    setError('');
    setSuccess('');
    try {
      // Add member via API
      await apiCall(`/workspace/${selectedWorkspace}/members`, 'POST', {
        userId: inviteData.userId,
        role: inviteData.role
      });
      
      // Refresh the workspace data
      const workspace = await fetchWorkspaceWithMembers(selectedWorkspace);
      if (workspace) {
        updateMembersFromWorkspace(workspace);
      }
      
      setSuccess('Member added successfully!');
      setInviteData({ userId: '', role: 'EDITOR' });
      setUsers([]);
      setSearchQuery('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const removeMember = async (userId) => {
    if (!window.confirm('Are you sure you want to remove this member?')) return;

    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await apiCall(`/workspace/${selectedWorkspace}/remove`, 'DELETE', {
        id: selectedWorkspace,
        userId: userId
      });
      
      // Refresh the workspace data
      const workspace = await fetchWorkspaceWithMembers(selectedWorkspace);
      if (workspace) {
        updateMembersFromWorkspace(workspace);
      }
      
      setSuccess('Member removed successfully!');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const openWorkspace = async (workspaceId) => {
    setLoading(true);
    setError('');
    try {
      const data = await apiCall(`/workspace/${workspaceId}/open`);
      if (data.data && data.data.url) {
        window.open(data.data.url, '_blank');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const updateMembersFromWorkspace = (workspace) => {
    // Based on your API response, the owner info might not be in the members array
    // So we'll just display what's in the members array
    const existingMembers = Array.isArray(workspace.members) ? workspace.members : [];
    console.log('Members to display:', existingMembers);
    setMembers(existingMembers);
  };

  const handleManageMembers = async (workspaceId, workspaceTitle) => {
    setLoading(true);
    setError('');
    
    // Find the workspace from your existing workspaces state
    const workspace = workspaces.find(ws => ws.id === workspaceId);
    
    if (workspace) {
      // SET THE STATE FIRST to show UI
      setSelectedWorkspace(workspaceId);
      setWorkspaceName(workspaceTitle || `Workspace ${workspaceId.slice(0, 8)}...`);
      setShowMemberManagement(true);
      setSearchQuery('');
      setUsers([]);
      setInviteData({ userId: '', role: 'EDITOR' });
      
      // Display members from the workspace object
      console.log('Workspace data:', workspace);
      console.log('Workspace members:', workspace.members);
      
      const existingMembers = Array.isArray(workspace.members) ? workspace.members : [];
      console.log('Members to display:', existingMembers);
      setMembers(existingMembers);
    } else {
      setError('Workspace not found');
    }
    
    setLoading(false);
  };

  const closeMemberManagement = () => {
    setShowMemberManagement(false);
    setSelectedWorkspace(null);
    setWorkspaceName('');
    setUsers([]);
    setSearchQuery('');
    setInviteData({ userId: '', role: 'EDITOR' });
    setMembers([]);
  };

  const refreshMembers = async () => {
    if (!selectedWorkspace) return;
    
    setLoading(true);
    setError('');
    try {
      const workspace = await fetchWorkspaceWithMembers(selectedWorkspace);
      if (workspace) {
        updateMembersFromWorkspace(workspace);
        setSuccess('Members list refreshed!');
      }
    } catch (err) {
      setError('Failed to refresh members: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkspaces();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery && searchQuery.trim()) {
        searchUsers(searchQuery);
      } else {
        setUsers([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Safely render members
  const renderMembers = () => {
    console.log('Current members state:', members);
    
    if (!Array.isArray(members)) {
      return (
        <div className="text-center py-4">
          <p className="text-danger">Error: Members data is invalid</p>
          <button 
            className="btn btn-sm btn-outline-primary"
            onClick={refreshMembers}
          >
            Try Again
          </button>
        </div>
      );
    }

    if (members.length === 0) {
      return (
        <div className="text-center py-4">
          <p className="text-muted mb-2">No members in this workspace</p>
          <small className="text-muted">Use the form on the left to add members</small>
        </div>
      );
    }

    return (
      <div className="members-list">
        {members.map((member, index) => {
          // Access member properties from your API response structure
          const userId = member.userId || `member-${index}`;
          const role = member.role || '';
          const userName = member.user?.name || 'Unnamed User';
          const userEmail = member.user?.email || '';
          const avatarUrl = member.user?.avatarUrl;
          
          return (
            <div key={member.id || userId} className="member-item d-flex justify-content-between align-items-center p-3 border-bottom">
              <div className="d-flex align-items-center">
                {avatarUrl ? (
                  <img 
                    src={avatarUrl} 
                    alt={userName} 
                    className="avatar-small rounded-circle me-3"
                    style={{width: '40px', height: '40px', objectFit: 'cover'}}
                  />
                ) : (
                  <div className="avatar-placeholder rounded-circle me-3 d-flex align-items-center justify-content-center bg-secondary text-white"
                       style={{width: '40px', height: '40px'}}>
                    {userName.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <div className="d-flex align-items-center">
                    <h6 className="mb-0">{userName}</h6>
                    {role && (
                      <span className={`badge ${role === 'EDITOR' ? 'bg-primary' : 'bg-secondary'} ms-2`}>
                        {role}
                      </span>
                    )}
                  </div>
                  <small className="text-muted">{userEmail}</small>
                </div>
              </div>
              <div>
                {role && role !== 'OWNER' && userId && (
                  <button
                    className="btn btn-sm btn-outline-danger"
                    onClick={() => removeMember(userId)}
                    disabled={loading}
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };
  return (
    <div className="document-manager">
      <div className="container-fluid">
        <div className="row">
          <div className="col-12">
            <h1 className="main-title">Workspace Manager</h1>
            
            {error && (
              <div className="alert alert-danger alert-dismissible fade show" role="alert">
                {error}
                <button type="button" className="btn-close" onClick={() => setError('')}></button>
              </div>
            )}
            
            {success && (
              <div className="alert alert-success alert-dismissible fade show" role="alert">
                {success}
                <button type="button" className="btn-close" onClick={() => setSuccess('')}></button>
              </div>
            )}
          </div>
        </div>

        <div className="row">
          <div className="col-lg-4 col-md-6 mb-4">
            <div className="card custom-card">
              <div className="card-header">
                <h3>Create Workspace</h3>
              </div>
              <div className="card-body">
                <div className="mb-3">
                  <p className="text-muted">
                    Create a new workspace to collaborate with others.
                  </p>
                </div>
                <button 
                  type="button" 
                  className="btn btn-primary w-100" 
                  onClick={createWorkspace}
                  disabled={loading}
                >
                  {loading ? 'Creating...' : 'Create New Workspace'}
                </button>
              </div>
            </div>
          </div>

          <div className="col-lg-8 col-md-6 mb-4">
            <div className="card custom-card">
              <div className="card-header d-flex justify-content-between align-items-center">
                <h3 className="mb-0">My Workspaces</h3>
                {showMemberManagement && (
                  <button 
                    className="btn btn-sm btn-outline-secondary"
                    onClick={closeMemberManagement}
                  >
                    Close
                  </button>
                )}
              </div>
              <div className="card-body">
                {loading && workspaces.length === 0 ? (
                  <div className="text-center">
                    <div className="spinner-border text-primary" role="status">
                      <span className="visually-hidden">Loading...</span>
                    </div>
                  </div>
                ) : workspaces.length === 0 ? (
                  <p className="text-muted">No workspaces found. Create your first workspace!</p>
                ) : (
                  <div className="document-list">
                    {workspaces.map((ws) => (
                      <div key={ws.id} className="document-item">
                        <div className="document-info">
                          <h5>{ws.name || `Workspace ${ws.id.slice(0, 8)}...`}</h5>
                          <small className="text-muted">
                            Created: {new Date(ws.createdAt).toLocaleDateString()}
                          </small>
                          <div className="mt-1">
                            <small className="text-muted">
                              Members: {Array.isArray(ws.members) ? ws.members.length : 0}
                            </small>
                          </div>
                        </div>
                        <div className="document-actions">
                          <button
                            className="btn btn-sm btn-outline-primary me-2"
                            onClick={() => openWorkspace(ws.id)}
                            disabled={loading}
                          >
                            Open
                          </button>
                          <button
                            className="btn btn-sm btn-outline-primary me-2"
                            onClick={() => handleManageMembers(ws.id, ws.name)}
                            disabled={loading}
                          >
                            Manage Members
                          </button>
                          <button
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => deleteWorkspace(ws.id)}
                            disabled={loading}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Member Management Section */}
        {showMemberManagement && (
          <div className="row mt-4">
            <div className="col-12">
              <div className="card custom-card mb-4">
                <div className="card-header">
                  <h3 className="mb-0">
                    Manage Members for: <span className="text-primary">{workspaceName}</span>
                  </h3>
                </div>
              </div>
            </div>
            
            {/* Add Member Section */}
            <div className="col-lg-6 mb-4">
              <div className="card custom-card">
                <div className="card-header">
                  <h3>Add New Member</h3>
                </div>
                <div className="card-body">
                  <div className="mb-3">
                    <label htmlFor="userSearch" className="form-label">Search Users</label>
                    <input
                      type="text"
                      className="form-control"
                      id="userSearch"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Type to search users by name or email"
                      disabled={loading}
                    />
                    {users.length > 0 && (
                      <div className="user-search-results mt-2">
                        {users.map((user) => (
                          <div
                            key={user.id}
                            className="user-search-item"
                            onClick={() => {
                              setInviteData({ ...inviteData, userId: user.id });
                              setSearchQuery(user.name || user.email);
                              setUsers([]);
                            }}
                          >
                            <div className="d-flex align-items-center">
                              {user.avatarUrl && (
                                <img 
                                  src={user.avatarUrl} 
                                  alt={user.name} 
                                  className="avatar-small me-2"
                                />
                              )}
                              <div>
                                <strong>{user.name || 'Unnamed User'}</strong>
                                <br />
                                <small className="text-muted">{user.email}</small>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="mb-3">
                    <label htmlFor="role" className="form-label">Role</label>
                    <select
                      className="form-select"
                      id="role"
                      value={inviteData.role}
                      onChange={(e) => setInviteData({ ...inviteData, role: e.target.value })}
                      disabled={loading}
                    >
                      <option value="EDITOR">Editor</option>
                      <option value="VIEWER">Viewer</option>
                    </select>
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary w-100"
                    onClick={inviteMember}
                    disabled={loading || !inviteData.userId}
                  >
                    {loading ? 'Adding...' : 'Add Member'}
                  </button>
                  
                  {inviteData.userId && (
                    <div className="alert alert-info mt-3 mb-0">
                      <strong>Ready to add:</strong> {searchQuery} as {inviteData.role}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Members List Section */}
            <div className="col-lg-6 mb-4">
              <div className="card custom-card">
                <div className="card-header d-flex justify-content-between align-items-center">
                  <h3 className="mb-0">Current Members</h3>
                  <div>
                    <span className="badge bg-secondary me-2">
                      {Array.isArray(members) ? members.length : 0} member(s)
                    </span>
                    <button 
                      className="btn btn-sm btn-outline-primary"
                      onClick={refreshMembers}
                      disabled={loading}
                    >
                      Refresh
                    </button>
                  </div>
                </div>
                <div className="card-body">
                  {loading && (!Array.isArray(members) || members.length === 0) ? (
                    <div className="text-center py-4">
                      <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Loading...</span>
                      </div>
                      <p className="mt-2 text-muted">Loading members...</p>
                    </div>
                  ) : (
                    renderMembers()
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkspaceManagerComponent;