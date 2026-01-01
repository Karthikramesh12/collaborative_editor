import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './DocumentManagerComponent.css';

const API_BASE_URL = import.meta.env.VITE_API_URL;

const DocumentManagerComponent = () => {
  const [documents, setDocuments] = useState([]);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [editors, setEditors] = useState([]);
  const [users, setUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [newDocTitle, setNewDocTitle] = useState('');
  const [inviteData, setInviteData] = useState({ userId: '', role: 'EDITOR' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
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

  const fetchDocuments = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiCall('/doc/');
      setDocuments(data.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const createDocument = async () => {
    if (!newDocTitle.trim()) return;

    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await apiCall('/doc/', 'POST', { title: newDocTitle });
      setSuccess('Document created successfully!');
      setNewDocTitle('');
      fetchDocuments();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteDocument = async (docId) => {
    if (!window.confirm('Are you sure you want to delete this document?')) return;

    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await apiCall(`/doc/${docId}/`, 'DELETE');
      setSuccess('Document deleted successfully!');
      setSelectedDoc(null);
      fetchDocuments();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchEditors = async (docId) => {
    setLoading(true);
    setError('');
    try {
      const data = await apiCall(`/doc/${docId}/editors`);
      setEditors(data.data || []);
      setSelectedDoc(docId);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const searchUsers = async (query) => {
    if (!query.trim()) {
      setUsers([]);
      return;
    }

    try {
      const data = await apiCall(`/user/search?q=${encodeURIComponent(query)}`);
      setUsers(data.data || []);
    } catch (err) {
      setError(err.message);
    }
  };

  const inviteEditor = async () => {
    if (!selectedDoc || !inviteData.userId) return;

    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await apiCall(`/doc/${selectedDoc}/invite`, 'POST', {
        targetUserId: inviteData.userId,
        role: inviteData.role
      });
      setSuccess('Editor invited successfully!');
      setInviteData({ userId: '', role: 'editor' });
      setUsers([]);
      setSearchQuery('');
      fetchEditors(selectedDoc);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const updateEditorRole = async (userId, newRole) => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await apiCall(`/doc/${selectedDoc}/editors/${userId}`, 'PATCH', { role: newRole });
      setSuccess('Editor role updated successfully!');
      fetchEditors(selectedDoc);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const removeEditor = async (userId) => {
    if (!window.confirm('Are you sure you want to remove this editor?')) return;

    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await apiCall(`/doc/${selectedDoc}/editors/${userId}`, 'DELETE');
      setSuccess('Editor removed successfully!');
      fetchEditors(selectedDoc);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery) {
        searchUsers(searchQuery);
      } else {
        setUsers([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleManageDocument = (docId) => {
    navigate(`/editor/${docId}`)
  }

  return (
    <div className="document-manager">
      <div className="container-fluid">
        <div className="row">
          <div className="col-12">
            <h1 className="main-title">Document Manager</h1>
            
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
                <h3>Create Document</h3>
              </div>
              <div className="card-body">
                <div className="mb-3">
                  <label htmlFor="docTitle" className="form-label">Document Title</label>
                  <input
                    type="text"
                    className="form-control"
                    id="docTitle"
                    value={newDocTitle}
                    onChange={(e) => setNewDocTitle(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && createDocument()}
                    placeholder="Enter document title"
                  />
                </div>
                <button 
                  type="button" 
                  className="btn btn-primary w-100" 
                  onClick={createDocument}
                  disabled={loading}
                >
                  {loading ? 'Creating...' : 'Create Document'}
                </button>
              </div>
            </div>
          </div>

          <div className="col-lg-8 col-md-6 mb-4">
            <div className="card custom-card">
              <div className="card-header">
                <h3>My Documents</h3>
              </div>
              <div className="card-body">
                {loading && documents.length === 0 ? (
                  <div className="text-center">
                    <div className="spinner-border text-primary" role="status">
                      <span className="visually-hidden">Loading...</span>
                    </div>
                  </div>
                ) : documents.length === 0 ? (
                  <p className="text-muted">No documents found. Create your first document!</p>
                ) : (
                  <div className="document-list">
                    {documents.map((doc) => (
                      <div key={doc.id} className="document-item">
                        <div className="document-info">
                          <h5>{doc.title}</h5>
                          <small className="text-muted">
                            Created: {new Date(doc.createdAt).toLocaleDateString()}
                          </small>
                        </div>
                        <div className="document-actions">
                          <button
                            className="btn btn-sm btn-outline-primary me-2"
                            onClick={() => handleManageDocument(doc.id)}
                          >
                            Manage document
                          </button>
                          <button
                            className="btn btn-sm btn-outline-primary me-2"
                            onClick={() => fetchEditors(doc.id)}
                          >
                            Manage Editors
                          </button>
                          <button
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => deleteDocument(doc.id)}
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

        {selectedDoc && (
          <div className="row">
            <div className="col-lg-6 mb-4">
              <div className="card custom-card">
                <div className="card-header">
                  <h3>Invite Editor</h3>
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
                      placeholder="Search by name or email"
                    />
                    {users.length > 0 && (
                      <div className="user-search-results">
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
                            <strong>{user.name || 'Unnamed User'}</strong>
                            <br />
                            <small className="text-muted">{user.email}</small>
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
                    >
                      <option value="editor">Editor</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary w-100"
                    onClick={inviteEditor}
                    disabled={loading || !inviteData.userId}
                  >
                    {loading ? 'Inviting...' : 'Invite Editor'}
                  </button>
                </div>
              </div>
            </div>

            <div className="col-lg-6 mb-4">
              <div className="card custom-card">
                <div className="card-header">
                  <h3>Document Editors</h3>
                </div>
                <div className="card-body">
                  {editors.length === 0 ? (
                    <p className="text-muted">No editors found for this document.</p>
                  ) : (
                    <div className="editor-list">
                      {editors.map((editor) => (
                        <div key={editor.userId} className="editor-item">
                          <div className="editor-info">
                            <h6>{editor.userName || 'Unnamed User'}</h6>
                            <small className="text-muted">{editor.userEmail}</small>
                          </div>
                          <div className="editor-controls">
                            <select
                              className="form-select form-select-sm me-2"
                              value={editor.role}
                              onChange={(e) => updateEditorRole(editor.userId, e.target.value)}
                              disabled={editor.role === 'OWNER'}
                            >
                              <option value="OWNER">Owner</option>
<option value="EDITOR">Editor</option>
<option value="VIEWER">Viewer</option>

                            </select>
                            {editor.role !== 'OWNER' && (
                              <button
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => removeEditor(editor.userId)}
                              >
                                Remove
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
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

export default DocumentManagerComponent;