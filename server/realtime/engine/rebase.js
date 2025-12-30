function rebase(incoming, appliedOps) {
  let op = { ...incoming };

  for (const prev of appliedOps) {
    op = transform(op, prev);
  }

  return { ...incoming, ...op };   // preserve all metadata
}


function transform(op, prev){
    // INSERT vs INSERT
    if (prev.type === 'insert' && op.type === 'insert'){
        if (prev.pos < op.pos || (prev.pos === op.pos && prev.opId < op.opId)){
            op.pos += prev.text.length;
        }
        return op;
    }
    // INSERT vs DELETE
    if (prev.type === 'delete' && op.type === 'insert'){
        if (prev.pos < op.pos){
            op.pos -= Math.min(prev.length, op.pos - prev.pos);
        }
        return op;
    }
    // DELETE vs INSERT
  if (prev.type === 'insert' && op.type === 'delete') {
    if (prev.pos <= op.pos) {
      op.pos += prev.text.length;
    } else if (prev.pos < op.pos + op.length) {
      op.length += prev.text.length;
    }
    return op;
  }

  // DELETE vs DELETE
  if (prev.type === 'delete' && op.type === 'delete') {
    if (prev.pos >= op.pos + op.length) return op;

    if (prev.pos + prev.length <= op.pos) {
      op.pos -= prev.length;
      return op;
    }

    const overlapStart = Math.max(op.pos, prev.pos);
    const overlapEnd = Math.min(op.pos + op.length, prev.pos + prev.length);
    const overlap = overlapEnd - overlapStart;

    op.length -= overlap;
    if (prev.pos < op.pos) op.pos -= Math.min(prev.length, op.pos - prev.pos);

    return op;
  }

  // REPLACE = DELETE + INSERT
  if (op.type === 'replace') {
    const del = transform({ ...op, type: 'delete' }, prev);
    const ins = transform(
      { ...op, type: 'insert', pos: del.pos, text: op.text },
      prev
    );
    return { ...op, pos: ins.pos, length: del.length };
  }

  return op;

}

module.exports = { rebase };