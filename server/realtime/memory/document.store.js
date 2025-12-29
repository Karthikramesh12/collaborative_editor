const prisma = require('../../config/prisma.js');
const DocumentState = require('../engine/document.state.js');

const documentStore = new Map();
const IDLE_TTL = 1000 * 60 * 10; // 10 min

async function loadFromDB(documentId) {
  const doc = await prisma.document.findUnique({
    where: { id: documentId }
  });

  if (!doc) return null;

  return new DocumentState(documentId, doc.content || "");
}

async function getDocument(documentId) {
  let doc = documentStore.get(documentId);
  if (doc) {
    doc.lastTouched = Date.now();
    return doc;
  }

  doc = await loadFromDB(documentId);
  if (!doc) return null;

  documentStore.set(documentId, doc);
  return doc;
}

async function createDocument(documentId, initial = "") {
  let doc = documentStore.get(documentId);
  if (doc) return doc;

  const dbDoc = await prisma.document.create({
    data: { id: documentId, content: initial }
  });

  doc = new DocumentState(documentId, dbDoc.content);
  documentStore.set(documentId, doc);
  return doc;
}

function hasDocument(documentId) {
  return documentStore.has(documentId);
}

async function persistDocument(documentId) {
  const doc = documentStore.get(documentId);
  if (!doc) return;

  await prisma.document.update({
    where: { id: documentId },
    data: { content: doc.content }
  });
}

setInterval(async () => {
  for (const [id, doc] of documentStore.entries()) {
    if (Date.now() - doc.lastTouched > IDLE_TTL) {
      await persistDocument(id);
      documentStore.delete(id);
    }
  }
}, 60_000);

module.exports = {
  getDocument,
  createDocument,
  hasDocument,
  persistDocument
};
