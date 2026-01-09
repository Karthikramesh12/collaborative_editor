import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';

const WEBSOCKET_URL = import.meta.env.VITE_WS_URL;

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
  
  // New dual cursor system
  const [myCursorPos, setMyCursorPos] = useState(0); // Your cursor position
  const [remoteCursors, setRemoteCursors] = useState({}); // Other users' cursors {clientId: {pos, color, name}}
  
  // Refs
  const wsRef = useRef(null);
  const clientIdRef = useRef('');
  const seqRef = useRef(1);
  const versionRef = useRef(0);
  const lastAckVersionRef = useRef(0);
  const snapshotVersionRef = useRef(0);
  const pendingOpsRef = useRef(0);
  const opsSentRef = useRef(0);
  const acksReceivedRef = useRef(0);
  const contentRef = useRef('');
  const textareaRef = useRef(null);
  const sentOpsMapRef = useRef(new Map());
  const lastCursorUpdateRef = useRef(0);
  const isTextareaFocusedRef = useRef(false);

  // Initialize clientId
  useEffect(() => {
    let clientId = localStorage.getItem('client_id');
    
    if (!clientId) {
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

  // Helper to generate consistent color for each user
  const getUserColor = useCallback((clientId) => {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
      '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
      '#F1948A', '#82E0AA', '#85C1E9', '#D7BDE2', '#F8C471'
    ];
    const hash = clientId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  }, []);

  // Apply operation to content
  const applyOpToContent = useCallback((currentContent, op) => {
    console.log('applyOpToContent:', { op, currentContentLength: currentContent.length });
    
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

  // Rebase local cursor based on remote operation
  const rebaseLocalCursor = useCallback((currentPos, op) => {
    if (op.type === 'insert' && op.pos <= currentPos) {
      return currentPos + (op.text?.length || 0);
    }
    
    if (op.type === 'delete' && op.pos < currentPos) {
      const deleteLength = op.length || 1;
      const deleteEnd = op.pos + deleteLength;
      
      if (currentPos <= deleteEnd) {
        return op.pos; // Cursor was inside deleted text
      } else {
        return currentPos - deleteLength;
      }
    }
    
    return currentPos;
  }, []);

  // Send cursor position to server
  const sendCursorPosition = useCallback((position) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }
    
    // Throttle cursor updates (max once every 100ms)
    const now = Date.now();
    if (now - lastCursorUpdateRef.current < 100) {
      return;
    }
    lastCursorUpdateRef.current = now;
    
    setMyCursorPos(position);
    
    wsRef.current.send(JSON.stringify({
      type: 'cursor',
      pos: position,
      clientId: clientIdRef.current,
      documentId: documentId
    }));
    
  }, [documentId]);

  // Apply remote operation
  const applyRemoteOperation = useCallback((remoteOp) => {
    console.log('applyRemoteOperation:', remoteOp);
    
    // Skip our own ops (they're already applied optimistically)
    if (remoteOp.clientId === clientIdRef.current) {
      console.log('Skipping own op');
      return;
    }

    addLog(`← Remote op from ${remoteOp.clientId?.substring(0, 8)}: ${remoteOp.type} "${remoteOp.text || ''}" at ${remoteOp.pos}`);

    // Apply the operation to content
    setContent(prev => {
      const newContent = applyOpToContent(prev, remoteOp);
      return newContent;
    });
    
    // Rebase local cursor if textarea is focused
    if (isTextareaFocusedRef.current && textareaRef.current) {
      const newPos = rebaseLocalCursor(myCursorPos, remoteOp);
      setMyCursorPos(newPos);
      
      // Update textarea cursor position
      if (textareaRef.current === document.activeElement) {
        textareaRef.current.selectionStart = newPos;
        textareaRef.current.selectionEnd = newPos;
      }
    }
    
    // Update version
    versionRef.current = Math.max(versionRef.current, remoteOp.baseVersion + 1);
    
  }, [addLog, applyOpToContent, rebaseLocalCursor, myCursorPos]);

  // Send operation
  const sendOperation = useCallback((op) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      addLog('Cannot send op: WebSocket not connected');
      return;
    }
    
    // Create operation with optimistic versioning
    const opId = `${clientIdRef.current}:${Date.now()}:${seqRef.current}`;
    const fullOp = {
      ...op,
      clientId: clientIdRef.current,
      baseVersion: versionRef.current,
      opId: opId
    };
    
    // Ensure delete operations have length property
    if (op.type === 'delete') {
      fullOp.length = op.length || 1;
    }
    
    addLog(`→ Sending op: ${op.type} "${op.text || ''}" at pos ${op.pos}, base:${versionRef.current}`);
    
    // Apply optimistically
    setContent(prev => applyOpToContent(prev, fullOp));
    
    // Update local cursor position for insert/delete
    if (fullOp.type === 'insert' && fullOp.pos <= myCursorPos) {
      const newPos = myCursorPos + (fullOp.text?.length || 0);
      setMyCursorPos(newPos);
    } else if (fullOp.type === 'delete' && fullOp.pos < myCursorPos) {
      const deleteEnd = fullOp.pos + (fullOp.length || 1);
      let newPos = myCursorPos;
      if (myCursorPos <= deleteEnd) {
        newPos = fullOp.pos;
      } else {
        newPos = myCursorPos - (fullOp.length || 1);
      }
      setMyCursorPos(newPos);
    }
    
    // Store in map for deduplication
    sentOpsMapRef.current.set(opId, fullOp);
    
    // Send to server
    wsRef.current.send(JSON.stringify({
      type: 'op',
      op: fullOp
    }));
    
    seqRef.current++;
    opsSentRef.current++;
    pendingOpsRef.current++;
    updateStats();
    
  }, [addLog, applyOpToContent, myCursorPos, updateStats]);

  // Handle text changes
  const handleTextChange = useCallback((newContent, cursorPosition) => {
    const oldContent = contentRef.current;
    
    if (newContent === oldContent) {
      return;
    }
    
    console.log('Text change:', { oldLength: oldContent.length, newLength: newContent.length });
    
    // Update local cursor
    if (cursorPosition !== undefined) {
      setMyCursorPos(cursorPosition);
      sendCursorPosition(cursorPosition);
    }
    
    // Calculate operation
    if (newContent.length > oldContent.length) {
      // Insertion
      let pos = 0;
      while (pos < oldContent.length && oldContent[pos] === newContent[pos]) {
        pos++;
      }
      
      const insertedText = newContent.substring(pos, pos + (newContent.length - oldContent.length));
      
      console.log('Insertion detected:', { pos, insertedText });
      
      // Send operation
      sendOperation({
        type: 'insert',
        pos: pos,
        text: insertedText
      });
      
    } else if (newContent.length < oldContent.length) {
      // Deletion
      let pos = 0;
      while (pos < newContent.length && oldContent[pos] === newContent[pos]) {
        pos++;
      }
      
      const deletedLength = oldContent.length - newContent.length;
      
      console.log('Deletion detected:', { pos, deletedLength });
      
      // Send operation
      sendOperation({
        type: 'delete',
        pos: pos,
        length: deletedLength
      });
    }
    
  }, [sendOperation, sendCursorPosition]);

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (!documentId) {
      addLog('Error: No documentId');
      return;
    }
    
    setStatus('connecting');
    addLog(`Connecting to document: ${documentId}`);
    
    const wsUrl = `${WEBSOCKET_URL}?documentId=${documentId}&userId=${clientIdRef.current}`;
    addLog(`WebSocket URL: ${wsUrl}`);
    
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      
      let connectionTimeout;
      let gotClientId = false;
      
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
      };
      
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          console.log('Received message:', msg.type, msg);
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
                versionRef.current = msg.snapshot.version;
                sentOpsMapRef.current.clear();
                setRemoteCursors({});
                setMyCursorPos(0);
                
                addLog(`✓ Received snapshot v${msg.snapshot.version}, length: ${snapshotContent.length} chars`);
                
                ws.send(JSON.stringify({ type: 'snapshotAck' }));
                setStatus('connected');
              }
              break;
              
            case 'ack':
              acksReceivedRef.current++;
              lastAckVersionRef.current = msg.version || 0;
              pendingOpsRef.current = Math.max(0, pendingOpsRef.current - 1);
              
              // Remove from sent ops map
              if (msg.op && msg.op.opId) {
                sentOpsMapRef.current.delete(msg.op.opId);
              }
              
              // Update version to match server
              if (msg.version > versionRef.current) {
                versionRef.current = msg.version;
              }
              
              addLog(`✓ Ack received: v${msg.version} (total: ${acksReceivedRef.current})`);
              updateStats();
              break;
              
            case 'op':
              if (msg.op) {
                // Check if this is our own op (deduplication)
                const opId = msg.op.opId;
                if (opId && opId.startsWith(clientIdRef.current)) {
                  console.log('Skipping own broadcasted op:', opId);
                } else {
                  applyRemoteOperation(msg.op);
                }
              }
              
              // Update remote cursors
              if (msg.cursors) {
                const newRemoteCursors = {};
                msg.cursors.forEach(cursor => {
                  if (cursor.clientId !== clientIdRef.current) {
                    newRemoteCursors[cursor.clientId] = {
                      pos: cursor.pos,
                      color: getUserColor(cursor.clientId),
                      clientId: cursor.clientId,
                      name: cursor.clientId.substring(0, 8)
                    };
                  }
                });
                setRemoteCursors(newRemoteCursors);
                console.log('Updated remote cursors:', Object.keys(newRemoteCursors).length);
              }
              break;
              
            case 'cursors':
              // Handle separate cursor updates
              const newRemoteCursors = {};
              msg.cursors.forEach(cursor => {
                if (cursor.clientId !== clientIdRef.current) {
                  newRemoteCursors[cursor.clientId] = {
                    pos: cursor.pos,
                    color: getUserColor(cursor.clientId),
                    clientId: cursor.clientId,
                    name: cursor.clientId.substring(0, 8)
                  };
                }
              });
              setRemoteCursors(newRemoteCursors);
              console.log('Received cursor updates:', Object.keys(newRemoteCursors).length);
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
        setStatus('disconnected');
        clearTimeout(connectionTimeout);
      };
      
      ws.onclose = (event) => {
        addLog(`WebSocket closed. Code: ${event.code}, Reason: ${event.reason || 'No reason'}, Clean: ${event.wasClean}`);
        setStatus('disconnected');
        setRemoteCursors({});
        clearTimeout(connectionTimeout);
      };
      
    } catch (error) {
      addLog(`✗ Error creating WebSocket: ${error.message}`);
      setStatus('disconnected');
    }
    
  }, [documentId, addLog, applyRemoteOperation, updateStats, getUserColor]);

  // Disconnect
  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
      setStatus('disconnected');
      setRemoteCursors({});
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
          pos: contentRef.current.length,
          text: 'X'
        });
      }, i * 100);
    }
  }, [sendOperation, addLog]);

  // Test connection
  const testConnection = useCallback(() => {
    addLog('Testing WebSocket connection...');
    
    const testWs = new WebSocket('ws://localhost:3000');
    
    testWs.onopen = () => {
      addLog('✓ Basic WebSocket connection works!');
      testWs.close();
    };
    
    testWs.onerror = (error) => {
      addLog('✗ Cannot connect to WebSocket server at ws://localhost:3000');
    };
    
    testWs.onclose = () => {
      addLog('Test connection closed');
    };
  }, [addLog]);

  // Auto-connect on mount
  useEffect(() => {
    if (documentId && status === 'disconnected') {
      testConnection();
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

  // Track textarea focus
  useEffect(() => {
    const handleFocus = () => {
      isTextareaFocusedRef.current = true;
    };
    
    const handleBlur = () => {
      isTextareaFocusedRef.current = false;
    };
    
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.addEventListener('focus', handleFocus);
      textarea.addEventListener('blur', handleBlur);
    }
    
    return () => {
      if (textarea) {
        textarea.removeEventListener('focus', handleFocus);
        textarea.removeEventListener('blur', handleBlur);
      }
    };
  }, []);

  // Render your cursor
  const renderMyCursor = () => {
    if (!isTextareaFocusedRef.current) return null;
    
    // Calculate cursor position based on monospace font
    const charsPerLine = 80; // Adjust based on your textarea width
    const charWidth = 8; // Approximate character width
    const lineHeight = 20; // Approximate line height
    
    const line = Math.floor(myCursorPos / charsPerLine);
    const col = myCursorPos % charsPerLine;
    
    return (
      <div 
        className="my-cursor"
        style={{
          position: 'absolute',
          left: `${col * charWidth}px`,
          top: `${line * lineHeight}px`,
          backgroundColor: '#4CAF50',
          width: '2px',
          height: '20px',
          zIndex: 3,
          pointerEvents: 'none',
          animation: 'blink 1s infinite'
        }}
        title="Your cursor"
      />
    );
  };

  // Render remote cursors
  const renderRemoteCursors = () => {
    const remoteCursorArray = Object.values(remoteCursors);
    if (remoteCursorArray.length === 0) return null;
    
    return (
      <div className="remote-cursors" style={{ 
        position: 'absolute', 
        top: 0, 
        left: 0, 
        right: 0, 
        bottom: 0, 
        pointerEvents: 'none' 
      }}>
        {remoteCursorArray.map((cursor) => {
          // Calculate cursor position
          const charsPerLine = 80;
          const charWidth = 8;
          const lineHeight = 20;
          
          const line = Math.floor(cursor.pos / charsPerLine);
          const col = cursor.pos % charsPerLine;
          
          return (
            <div 
              key={cursor.clientId}
              className="remote-cursor"
              style={{
                position: 'absolute',
                left: `${col * charWidth}px`,
                top: `${line * lineHeight}px`,
                backgroundColor: cursor.color,
                width: '2px',
                height: '20px',
                opacity: 0.8,
                zIndex: 2,
                transition: 'left 0.1s ease, top 0.1s ease'
              }}
              title={`User: ${cursor.name}`}
            >
              <div 
                style={{
                  position: 'absolute',
                  top: '-20px',
                  left: '-5px',
                  backgroundColor: cursor.color,
                  color: 'white',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontSize: '10px',
                  whiteSpace: 'nowrap',
                  fontWeight: 'bold'
                }}
              >
                {cursor.name}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Add CSS for blinking cursor
  const cursorStyles = `
    @keyframes blink {
      0%, 50% { opacity: 1; }
      51%, 100% { opacity: 0; }
    }
    
    .my-cursor {
      animation: blink 1s infinite;
    }
    
    .remote-cursor {
      transition: left 0.1s ease, top 0.1s ease;
    }
  `;

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
  
  const remoteCursorCount = Object.keys(remoteCursors).length;
  
  return (
    <div className="container-fluid mt-3">
      <style>{cursorStyles}</style>
      
      {/* Debug Panel */}
      <div className="alert alert-info mb-3">
        <h5 className="alert-heading">Collaborative Editor</h5>
        <div className="row">
          <div className="col-md-3">
            <strong>Document:</strong> <code>{documentId}</code>
          </div>
          <div className="col-md-3">
            <strong>Your ID:</strong> <code>{clientIdRef.current.substring(0, 12)}...</code>
          </div>
          <div className="col-md-3">
            <strong>Status:</strong>
            <span className={`badge ${statusBadgeClass} ms-2`}>
              {status.toUpperCase()}
            </span>
          </div>
          <div className="col-md-3">
            <strong>Remote Users:</strong>
            <span className="badge bg-info ms-2">
              {remoteCursorCount}
            </span>
          </div>
        </div>
        <div className="mt-2">
          <small className="text-muted">
            Your cursor: {myCursorPos} | Version: {versionRef.current}
          </small>
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
            {remoteCursorCount > 0 && (
              <span className="badge bg-info">
                {remoteCursorCount} remote user{remoteCursorCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          
          <div className="card mb-4" style={{ position: 'relative' }}>
            <div className="card-body p-0" style={{ position: 'relative', minHeight: '400px' }}>
              {renderMyCursor()}
              {renderRemoteCursors()}
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => {
                  const cursorPos = e.target.selectionStart;
                  handleTextChange(e.target.value, cursorPos);
                }}
                onSelect={(e) => {
                  const cursorPos = e.target.selectionStart;
                  setMyCursorPos(cursorPos);
                  sendCursorPosition(cursorPos);
                }}
                onClick={(e) => {
                  const cursorPos = e.target.selectionStart;
                  setMyCursorPos(cursorPos);
                  sendCursorPosition(cursorPos);
                }}
                onKeyUp={(e) => {
                  const cursorPos = e.target.selectionStart;
                  if (cursorPos !== myCursorPos) {
                    setMyCursorPos(cursorPos);
                    sendCursorPosition(cursorPos);
                  }
                }}
                disabled={status !== 'connected'}
                className="form-control border-0"
                style={{ 
                  height: '400px', 
                  fontFamily: 'monospace', 
                  fontSize: '16px',
                  resize: 'vertical',
                  position: 'relative',
                  zIndex: 1,
                  backgroundColor: '#f8f9fa',
                  color: '#212529'
                }}
                placeholder={status !== 'connected' ? "Connect to the server to start editing..." : "Start typing here. Changes will sync with other users..."}
              />
            </div>
            <div className="card-footer">
              <small className="text-muted">
                Length: {content.length} characters | Version: {versionRef.current} | Your cursor: {myCursorPos}
              </small>
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
          </div>
        </div>
        
        {/* Logs */}
        <div className="col-lg-4">
          <div className="card bg-dark text-light" style={{ height: '500px' }}>
            <div className="card-header bg-secondary d-flex justify-content-between">
              <h5 className="mb-0">Logs</h5>
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
            <div className="card-footer bg-secondary d-flex justify-content-between">
              <small className="text-light">
                Pending ops: {pendingOpsRef.current}
              </small>
              <div className="btn-group">
                <button
                  onClick={connect}
                  disabled={status === 'connected' || status === 'connecting'}
                  className="btn btn-sm btn-primary"
                >
                  Connect
                </button>
                <button
                  onClick={disconnect}
                  disabled={status !== 'connected'}
                  className="btn btn-sm btn-danger"
                >
                  Disconnect
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CollabEditor;