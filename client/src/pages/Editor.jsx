import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';

const WEBSOCKET_URL = import.meta.env.VITE_WS_URL;
console.log(WEBSOCKET_URL);

const CollabEditor = () => {
  const { docId } = useParams();
  const documentId = docId;
  
  // State
  const [content, setContent] = useState('');
  const [status, setStatus] = useState('disconnected');
  const [connectionStats, setConnectionStats] = useState({
    opsSent: 0,
    acksReceived: 0,
    lastAckVersion: 0,
    snapshotVersion: 0,
    pendingOps: 0
  });
  const [logs, setLogs] = useState([]);
  const [pendingRemoteOps, setPendingRemoteOps] = useState([]);
  
  // Refs
  const wsRef = useRef(null);
  const clientIdRef = useRef('');
  const seqRef = useRef(1);
  const nextBaseVersionRef = useRef(0);
  const lastAckVersionRef = useRef(0);
  const snapshotVersionRef = useRef(0);
  const pendingOpsRef = useRef(0);
  const opsSentRef = useRef(0);
  const acksReceivedRef = useRef(0);
  const contentRef = useRef('');
  
  // Initialize clientId - FIXED: generate if not exists
  useEffect(() => {
    let clientId = localStorage.getItem('client_id');
    
    if (!clientId) {
      // Generate a simple clientId (similar to your test but not the exact same)
      clientId = `client_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
      localStorage.setItem('client_id', clientId);
    }
    
    clientIdRef.current = clientId;
    addLog(`Client ID: ${clientId}`);
  }, []);
  
  // Update content ref when content changes
  useEffect(() => {
    contentRef.current = content;
  }, [content]);
  
  const addLog = useCallback((message) => {
    setLogs(prev => [...prev.slice(-50), `[${new Date().toLocaleTimeString()}] ${message}`]);
    console.log(message);
  }, []);
  
  const updateStats = useCallback(() => {
    setConnectionStats({
      opsSent: opsSentRef.current,
      acksReceived: acksReceivedRef.current,
      lastAckVersion: lastAckVersionRef.current,
      snapshotVersion: snapshotVersionRef.current,
      pendingOps: pendingOpsRef.current
    });
  }, []);
  
  // Apply operation to content
  const applyOpToContent = useCallback((currentContent, op) => {
  if (op.type === 'insert') {
    const pos = Math.min(op.pos, currentContent.length);
    const before = currentContent.substring(0, pos);
    const after = currentContent.substring(pos);
    return before + (op.text || '') + after;
  } else if (op.type === 'delete') {
    const pos = Math.min(op.pos, currentContent.length - 1);
    const length = op.length || 1;
    if (pos >= 0 && pos + length <= currentContent.length) {
      const before = currentContent.substring(0, pos);
      const after = currentContent.substring(pos + length);
      return before + after;
    }
  }
  return currentContent;
}, []);
  
  // Apply remote operation
  const applyRemoteOperation = useCallback((remoteOp) => {
    if (remoteOp.clientId === clientIdRef.current) {
      return;
    }
    
    if (remoteOp.baseVersion === nextBaseVersionRef.current) {
      setContent(prev => applyOpToContent(prev, remoteOp));
      nextBaseVersionRef.current++;
      addLog(`✓ Applied remote op from ${remoteOp.clientId?.substring(0, 8)}: ${remoteOp.type} "${remoteOp.text || ''}" at ${remoteOp.pos}`);
      
      applyPendingOps();
    } else {
      addLog(`⏳ Queueing remote op (base: ${remoteOp.baseVersion}, expected: ${nextBaseVersionRef.current})`);
      setPendingRemoteOps(prev => [...prev, remoteOp].sort((a, b) => a.baseVersion - b.baseVersion));
    }
  }, [addLog, applyOpToContent]);
  
  // Apply pending operations
  const applyPendingOps = useCallback(() => {
    setPendingRemoteOps(prev => {
      const newPending = [...prev];
      
      while (newPending.length > 0 && newPending[0].baseVersion === nextBaseVersionRef.current) {
        const op = newPending.shift();
        setContent(prevContent => applyOpToContent(prevContent, op));
        nextBaseVersionRef.current++;
      }
      
      return newPending;
    });
  }, [applyOpToContent]);
  
  // Send operation
  const sendOperation = useCallback((op) => {
  if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
    addLog('Cannot send op: WebSocket not connected');
    return;
  }
  
  // Build operation according to server protocol
  const fullOp = {
    ...op,
    clientId: clientIdRef.current,
    baseVersion: nextBaseVersionRef.current,
    opId: `${clientIdRef.current}:${seqRef.current}`
  };
  
  // Ensure delete operations have length property
  if (op.type === 'delete') {
    // Default to deleting 1 character if length not specified
    fullOp.length = op.length || 1;
  }
  
  addLog(`→ Sending op: ${op.type} "${op.text || ''}" at pos ${op.pos}, base:${nextBaseVersionRef.current}, seq:${seqRef.current}${op.type === 'delete' ? `, length:${fullOp.length}` : ''}`);
  
  wsRef.current.send(JSON.stringify({
    type: 'op',
    op: fullOp
  }));
  
  seqRef.current++;
  nextBaseVersionRef.current++;
  opsSentRef.current++;
  pendingOpsRef.current++;
  updateStats();
}, [addLog, updateStats]);
  
  // Handle text changes
  // Handle text changes
const handleTextChange = useCallback((newContent) => {
  const oldContent = contentRef.current;
  
  if (newContent === oldContent) {
    return;
  }
  
  // Find the first position where strings differ
  let pos = 0;
  const minLength = Math.min(oldContent.length, newContent.length);
  
  while (pos < minLength && oldContent[pos] === newContent[pos]) {
    pos++;
  }
  
  if (newContent.length > oldContent.length) {
    // Insertion
    const insertedText = newContent.substring(pos, pos + (newContent.length - oldContent.length));
    
    sendOperation({
      type: 'insert',
      pos,
      text: insertedText
    });
    
    setContent(newContent);
    
  } else if (newContent.length < oldContent.length) {
    // Deletion - determine if it's backspace or delete key
    const deletedLength = oldContent.length - newContent.length;
    
    // For simplicity, we'll send delete at the found position
    // Most common case: backspace/delete at cursor position
    sendOperation({
      type: 'delete',
      pos: pos, // Position where deletion starts
      length: deletedLength // Number of characters deleted
    });
    
    setContent(newContent);
    
  } else {
    // Same length but different content (replace)
    // Find end of differing section
    let oldEnd = oldContent.length - 1;
    let newEnd = newContent.length - 1;
    
    while (oldEnd >= pos && newEnd >= pos && 
           oldContent[oldEnd] === newContent[newEnd]) {
      oldEnd--;
      newEnd--;
    }
    
    const deleteLength = oldEnd - pos + 1;
    const insertText = newContent.substring(pos, newEnd + 1);
    
    // Send delete first
    sendOperation({
      type: 'delete',
      pos: pos,
      length: deleteLength
    });
    
    // Then send insert if needed
    if (insertText.length > 0) {
      // Small delay to ensure order
      setTimeout(() => {
        sendOperation({
          type: 'insert',
          pos: pos,
          text: insertText
        });
      }, 10);
    }
    
    setContent(newContent);
  }
}, [sendOperation]);
  
  const findFirstDiffPos = (str1, str2) => {
    const len = Math.min(str1.length, str2.length);
    for (let i = 0; i < len; i++) {
      if (str1[i] !== str2[i]) return i;
    }
    return len;
  };
  
  // Connect to WebSocket - UPDATED with exact same logic as test script
  const connect = useCallback(() => {
    if (!documentId) {
      addLog('Error: No documentId');
      return;
    }
    
    setStatus('connecting');
    addLog(`Connecting to document: ${documentId}`);
    
    // Build URL EXACTLY like the test script
    const wsUrl = `${WEBSOCKET_URL}?documentId=${documentId}&userId=${clientIdRef.current}`;
    addLog(`WebSocket URL: ${wsUrl}`);
    
    try {
      // Create WebSocket - NO binaryType, just like test script
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      
      let connectionTimeout;
      let gotClientId = false;
      
      // Set timeout exactly like test script (2000ms)
      connectionTimeout = setTimeout(() => {
        if (!gotClientId) {
          addLog('Connection timeout - no clientId received');
          if (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN) {
            ws.close();
          }
          setStatus('disconnected');
        }
      }, 2000);
      
      ws.onopen = () => {
        addLog('✓ WebSocket connection opened');
        // Don't send anything - server should initiate
      };
      
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          addLog(`Received type: ${msg.type}`);
          
          switch (msg.type) {
            case 'clientId':
              clearTimeout(connectionTimeout);
              gotClientId = true;
              addLog(`✓ Received clientId: ${msg.clientId}`);
              setStatus('connected');
              break;
              
            case 'snapshot':
              clearTimeout(connectionTimeout);
              gotClientId = true;
              
              if (msg.snapshot) {
                snapshotVersionRef.current = msg.snapshot.version;
                const snapshotContent = msg.snapshot.content || '';
                setContent(snapshotContent);
                nextBaseVersionRef.current = msg.snapshot.version;
                
                addLog(`✓ Received snapshot v${msg.snapshot.version}, length: ${snapshotContent.length} chars`);
                
                // Send snapshot acknowledgement EXACTLY like test script
                ws.send(JSON.stringify({ type: 'snapshotAck' }));
                
                setStatus('connected');
              }
              break;
              
            case 'ack':
              acksReceivedRef.current++;
              lastAckVersionRef.current = msg.version || 0;
              pendingOpsRef.current = Math.max(0, pendingOpsRef.current - 1);
              
              addLog(`✓ Ack received: ${msg.opId} → v${msg.version} (total: ${acksReceivedRef.current})`);
              updateStats();
              break;
              
            case 'op':
              if (msg.op && msg.op.clientId !== clientIdRef.current) {
                addLog(`← Remote op from ${msg.op.clientId?.substring(0, 8)}: ${msg.op.type} "${msg.op.text || ''}" at ${msg.op.pos}`);
                applyRemoteOperation(msg.op);
              }
              break;
              
            case 'error':
              addLog(`✗ Server error: ${msg.error}`);
              break;
              
            default:
              addLog(`Unknown message type: ${msg.type}`);
          }
        } catch (error) {
          addLog(`✗ Error parsing message: ${error}`);
          addLog(`Raw data: ${event.data}`);
        }
      };
      
      ws.onerror = (event) => {
        addLog(`✗ WebSocket error occurred`);
        
        // Try to get more error details
        if (event && event.type) {
          addLog(`Error type: ${event.type}`);
        }
        
        setStatus('disconnected');
        clearTimeout(connectionTimeout);
      };
      
      ws.onclose = (event) => {
        addLog(`WebSocket closed. Code: ${event.code}, Reason: ${event.reason || 'No reason'}, Clean: ${event.wasClean}`);
        
        if (event.code === 1006) {
          addLog('⚠ Abnormal closure. Possible causes:');
          addLog('  1. Server not running on localhost:3000');
          addLog('  2. CORS issue with WebSocket');
          addLog('  3. Invalid WebSocket URL');
        }
        
        setStatus('disconnected');
        clearTimeout(connectionTimeout);
      };
      
    } catch (error) {
      addLog(`✗ Error creating WebSocket: ${error.message}`);
      setStatus('disconnected');
    }
    
  }, [documentId, addLog, applyRemoteOperation, updateStats]);
  
  // Disconnect
  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
      setStatus('disconnected');
      addLog('Disconnected manually');
    }
  }, [addLog]);
  
  // Reconnect
  const reconnect = useCallback(() => {
    if (status === 'connected') {
      disconnect();
    }
    
    setTimeout(() => {
      addLog('Reconnecting...');
      setStatus('reconnecting');
      connect();
    }, 1000);
  }, [status, disconnect, connect, addLog]);
  
  // Send test operations
  const sendTestOperations = useCallback(() => {
    addLog('Sending 10 test operations...');
    
    for (let i = 0; i < 10; i++) {
      setTimeout(() => {
        sendOperation({
          type: 'insert',
          pos: contentRef.current.length + i,
          text: 'X'
        });
      }, i * 100);
    }
  }, [sendOperation, addLog]);
  
  // Test connection first
  const testConnection = useCallback(() => {
    addLog('Testing WebSocket connection...');
    
    // First, check if we can create a simple WebSocket
    const testWs = new WebSocket('ws://localhost:3000');
    
    testWs.onopen = () => {
      addLog('✓ Basic WebSocket connection works!');
      testWs.close();
    };
    
    testWs.onerror = (error) => {
      addLog('✗ Cannot connect to WebSocket server at ws://localhost:3000');
      addLog('Make sure the server is running:');
      addLog('  1. Go to your server directory');
      addLog('  2. Run: npm start (or node server.js)');
      addLog('  3. Check if port 3000 is available');
    };
    
    testWs.onclose = () => {
      addLog('Test connection closed');
    };
  }, [addLog]);
  
  // Auto-connect on mount
  useEffect(() => {
    if (documentId && status === 'disconnected') {
      // Test connection first
      testConnection();
      
      // Then try to connect after a short delay
      setTimeout(() => {
        connect();
      }, 500);
    }
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [documentId]);
  
  if (!documentId) {
    return (
      <div className="container mt-4">
        <h1 className="mb-4">Collaborative Editor</h1>
        <div className="alert alert-warning">
          No document ID specified. Please navigate to a document URL.
        </div>
      </div>
    );
  }
  
  const statusBadgeClass = {
    'connected': 'bg-success',
    'connecting': 'bg-warning',
    'reconnecting': 'bg-warning',
    'disconnected': 'bg-danger'
  }[status] || 'bg-secondary';
  
  return (
    <div className="container-fluid mt-3">
      {/* Debug Panel */}
      <div className="alert alert-info mb-3">
        <h5 className="alert-heading">Debug Information</h5>
        <div className="row">
          <div className="col-md-4">
            <strong>Document:</strong> <code>{documentId}</code>
          </div>
          <div className="col-md-4">
            <strong>Client ID:</strong> <code>{clientIdRef.current}</code>
          </div>
          <div className="col-md-4">
            <strong>Status:</strong> 
            <span className={`badge ${statusBadgeClass} ms-2`}>
              {status.toUpperCase()}
            </span>
          </div>
        </div>
        <hr />
        <div className="mt-2">
          <button 
            onClick={testConnection}
            className="btn btn-sm btn-outline-info me-2"
          >
            Test Connection
          </button>
          <button 
            onClick={() => {
              // Force reload client ID
              const newClientId = `client_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
              localStorage.setItem('client_id', newClientId);
              clientIdRef.current = newClientId;
              addLog(`New Client ID: ${newClientId}`);
              reconnect();
            }}
            className="btn btn-sm btn-outline-warning"
          >
            New Client ID
          </button>
        </div>
      </div>
      
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1>Collaborative Editor</h1>
          <p className="text-muted">
            Edit document in real-time with other users
          </p>
        </div>
        
        <div className="btn-group">
          <button
            onClick={connect}
            disabled={status === 'connected' || status === 'connecting'}
            className="btn btn-primary"
          >
            {status === 'connecting' ? 'Connecting...' : 'Connect'}
          </button>
          <button
            onClick={disconnect}
            disabled={status !== 'connected'}
            className="btn btn-danger"
          >
            Disconnect
          </button>
          <button
            onClick={reconnect}
            className="btn btn-warning"
          >
            Reconnect
          </button>
          <button
            onClick={sendTestOperations}
            disabled={status !== 'connected'}
            className="btn btn-success"
          >
            Test Ops
          </button>
        </div>
      </div>
      
      <div className="row">
        {/* Editor */}
        <div className="col-lg-8">
          <div className="mb-3">
            <span className={`badge ${statusBadgeClass} p-2 me-2`}>
              {status === 'connected' ? '✓ CONNECTED' : status.toUpperCase()}
            </span>
            {pendingRemoteOps.length > 0 && (
              <span className="badge bg-warning text-dark">
                Pending: {pendingRemoteOps.length}
              </span>
            )}
          </div>
          
          <div className="card mb-4">
            <div className="card-body p-0">
              <textarea
                value={content}
                onChange={(e) => handleTextChange(e.target.value)}
                disabled={status !== 'connected'}
                className="form-control border-0"
                style={{ 
                  height: '400px', 
                  fontFamily: 'monospace', 
                  fontSize: '16px',
                  resize: 'vertical'
                }}
                placeholder={status !== 'connected' ? "Connect to the server to start editing..." : "Start typing here. Changes will sync with other users..."}
              />
            </div>
          </div>
          
          {/* Stats */}
          <div className="row text-center mb-4">
            <div className="col">
              <div className="card">
                <div className="card-body">
                  <h2 className="card-title">{connectionStats.opsSent}</h2>
                  <p className="card-text text-muted">Ops Sent</p>
                </div>
              </div>
            </div>
            <div className="col">
              <div className="card">
                <div className="card-body">
                  <h2 className="card-title">{connectionStats.acksReceived}</h2>
                  <p className="card-text text-muted">Acks Received</p>
                </div>
              </div>
            </div>
            <div className="col">
              <div className="card">
                <div className="card-body">
                  <h2 className="card-title">v{connectionStats.lastAckVersion}</h2>
                  <p className="card-text text-muted">Last Ack</p>
                </div>
              </div>
            </div>
            <div className="col">
              <div className="card">
                <div className="card-body">
                  <h2 className="card-title">v{connectionStats.snapshotVersion}</h2>
                  <p className="card-text text-muted">Snapshot</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Logs */}
        <div className="col-lg-4">
          <div className="card bg-dark text-light" style={{ height: '500px' }}>
            <div className="card-header bg-secondary d-flex justify-content-between">
              <h5 className="mb-0">Protocol Logs</h5>
              <button
                onClick={() => setLogs([])}
                className="btn btn-sm btn-outline-light"
              >
                Clear
              </button>
            </div>
            <div className="card-body overflow-auto p-2">
              <div style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                {logs.length === 0 ? (
                  <div className="text-muted fst-italic">Waiting for logs...</div>
                ) : (
                  logs.map((log, index) => (
                    <div key={index} className="mb-1">
                      {log.includes('→') ? (
                        <span className="text-info">{log}</span>
                      ) : log.includes('✓') ? (
                        <span className="text-success">{log}</span>
                      ) : log.includes('✗') ? (
                        <span className="text-danger">{log}</span>
                      ) : log.includes('⚠') ? (
                        <span className="text-warning">{log}</span>
                      ) : log.includes('←') ? (
                        <span className="text-primary">{log}</span>
                      ) : (
                        <span className="text-light">{log}</span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="card-footer bg-secondary">
              <small className="text-light">
                Base: {nextBaseVersionRef.current} | Seq: {seqRef.current} | Pending: {pendingOpsRef.current}
              </small>
            </div>
          </div>
        </div>
      </div>
      
      {/* Troubleshooting Tips */}
      <div className="card mt-4">
        <div className="card-header">
          <h5 className="mb-0">Troubleshooting</h5>
        </div>
        <div className="card-body">
          <p>If you're getting WebSocket errors (code 1006):</p>
          <ol>
            <li>Make sure your collaboration server is running: <code>npm start</code> in server directory</li>
            <li>Check if port 3000 is available and not blocked</li>
            <li>Try clicking "Test Connection" button above</li>
            <li>Try "New Client ID" if there are authentication issues</li>
            <li>Check browser console for CORS errors</li>
          </ol>
        </div>
      </div>
    </div>
  );
};

export default CollabEditor;