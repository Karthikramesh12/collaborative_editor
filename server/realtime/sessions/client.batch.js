const Batches = new Map();
const Timers = new Map();
const BATCH_WINDOW_MS = 20;

// Store documentId per client (we'll need to set this when client connects)
const ClientDocuments = new Map(); // clientId -> documentId

function push(clientId, op, flushFn) {
    if (!Batches.has(clientId)) {
        Batches.set(clientId, []);
    }
    
    // ====== GLOBAL DOCUMENT DEDUPLICATION ======
    // Get the documentId for this client
    const documentId = ClientDocuments.get(clientId);
    
    if (documentId) {
        // Get the document from store
        const store = require('../memory/document.store.js');
        const doc = store.getDocument(documentId);
        
        if (doc && doc.dedup && doc.dedup.hasSeen(op.opId)) {
            console.log(`[BATCH-DEDUP] Global duplicate: ${op.opId.substring(0, 8)} for client ${clientId.substring(0, 8)}`);
            // We should still ack the client, but we don't have access to ws here
            // The controller will need to handle this case
            return; // Drop the operation
        }
    } else {
        console.warn(`[BATCH] No documentId for client ${clientId.substring(0, 8)}, skipping global dedup`);
    }
    // ===========================================
    
    const batch = Batches.get(clientId);
    batch.push(op);
    
    // Check if we should flush immediately (e.g., for non-sequential ops)
    if (batch.length > 0) {
        const lastOp = batch[batch.length - 2]; // previous op
        if (lastOp && !canBatchTogether(lastOp, op)) {
            flush(clientId, flushFn);
            return;
        }
    }

    if (!Timers.has(clientId)) {
        Timers.set(clientId, setTimeout(() => {
            flush(clientId, flushFn);
        }, BATCH_WINDOW_MS));
    }
}

function flush(clientId, flushFn) {
    const timer = Timers.get(clientId);
    if (timer) {
        clearTimeout(timer);
        Timers.delete(clientId);
    }

    const list = Batches.get(clientId);
    Batches.delete(clientId);

    if (!list || list.length === 0) {
        return;
    }

    // Call the flush function with the batched operations
    flushFn(list);
}

function clear(clientId) {
    Batches.delete(clientId);
    ClientDocuments.delete(clientId); // Clear document mapping too
    
    const timer = Timers.get(clientId);
    if (timer) {
        clearTimeout(timer);
    }
    Timers.delete(clientId);
}

// NEW FUNCTION: Set documentId for a client (call this when client connects)
function setDocument(clientId, documentId) {
    ClientDocuments.set(clientId, documentId);
    console.log(`[BATCH] Client ${clientId.substring(0, 8)} -> Document ${documentId}`);
}

// Helper to determine if ops can be batched
function canBatchTogether(a, b) {
    if (a.clientId !== b.clientId) return false;
    if (a.baseServerSeq !== b.baseServerSeq) return false;
    
    // Only batch inserts at adjacent positions
    if (a.type === "insert" && b.type === "insert") {
        return b.pos === a.pos + a.text.length;
    }
    
    // Only batch deletes at same position
    if (a.type === "delete" && b.type === "delete") {
        return b.pos === a.pos;
    }
    
    return false;
}

// Keep the same exports, but add setDocument
module.exports = { push, clear, setDocument };