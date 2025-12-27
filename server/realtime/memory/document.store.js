const DocumentState = require('../engine/document.state.js');
const documentStore = new Map();

function createDocument(documentId, initialState = "") {
  if (!documentStore.has(documentId)) {
    documentStore.set(documentId, new DocumentState(documentId, initialState));
  }
  return documentStore.get(documentId);
}

function getDocument(documentId) {
  return documentStore.get(documentId) || null;
}

function hasDocument(documentId) {
  return documentStore.has(documentId);
}

function deleteDocument(documentId) {
  return documentStore.delete(documentId);
}

module.exports = { createDocument, getDocument, hasDocument, deleteDocument };
