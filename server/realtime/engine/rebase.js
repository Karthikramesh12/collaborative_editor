function rebase(incoming, appliedOps) {
  console.log('\n=== REBASE START ===');
  console.log('Incoming op:', incoming);
  console.log('Applied ops to transform against:', appliedOps);
  
  let op = { ...incoming };

  for (const prev of appliedOps) {
    console.log(`\nTransforming against prev op:`, prev);
    const beforeTransform = { ...op };
    op = transform(op, prev);
    console.log(`Transformation: ${beforeTransform.type}@${beforeTransform.pos} → ${op.type}@${op.pos}`);
  }

  console.log('Final rebased op:', op);
  console.log('=== REBASE END ===\n');
  
  return op;  // Return TRANSFORMED op
}


function transform(op, prev){
  console.log(`transform: ${op.type}@${op.pos} vs ${prev.type}@${prev.pos}`);
  
  // INSERT vs INSERT
  if (prev.type === 'insert' && op.type === 'insert'){
      if (prev.pos < op.pos || (prev.pos === op.pos && prev.opId < op.opId)){
          op.pos += prev.text.length;
          console.log(`  INSERT-INSERT: pos ${op.pos - prev.text.length} → ${op.pos}`);
      }
      return op;
  }
  
  // INSERT vs DELETE
  if (prev.type === 'delete' && op.type === 'insert'){
      if (prev.pos < op.pos){
          const adjustment = Math.min(prev.length, op.pos - prev.pos);
          op.pos -= adjustment;
          console.log(`  INSERT-DELETE: pos ${op.pos + adjustment} → ${op.pos} (adjustment: ${adjustment})`);
      } else if (prev.pos === op.pos) {
          console.log(`  INSERT-DELETE: same position, no change`);
      }
      return op;
  }
  
  // DELETE vs INSERT
  if (prev.type === 'insert' && op.type === 'delete') {
    if (prev.pos <= op.pos) {
      op.pos += prev.text.length;
      console.log(`  DELETE-INSERT: pos ${op.pos - prev.text.length} → ${op.pos}`);
    } else if (prev.pos < op.pos + op.length) {
      op.length += prev.text.length;
      console.log(`  DELETE-INSERT: length ${op.length - prev.text.length} → ${op.length}`);
    }
    return op;
  }

  // DELETE vs DELETE
  if (prev.type === 'delete' && op.type === 'delete') {
    if (prev.pos >= op.pos + op.length) return op;

    if (prev.pos + prev.length <= op.pos) {
      op.pos -= prev.length;
      console.log(`  DELETE-DELETE: pos ${op.pos + prev.length} → ${op.pos}`);
      return op;
    }

    const overlapStart = Math.max(op.pos, prev.pos);
    const overlapEnd = Math.min(op.pos + op.length, prev.pos + prev.length);
    const overlap = overlapEnd - overlapStart;

    op.length -= overlap;
    if (prev.pos < op.pos) {
      const posAdjustment = Math.min(prev.length, op.pos - prev.pos);
      op.pos -= posAdjustment;
      console.log(`  DELETE-DELETE: pos ${op.pos + posAdjustment} → ${op.pos}, length ${op.length + overlap} → ${op.length}`);
    }

    return op;
  }

  // REPLACE = DELETE + INSERT
  if (op.type === 'replace') {
    console.log(`  REPLACE transformation`);
    const del = transform({ ...op, type: 'delete' }, prev);
    const ins = transform(
      { ...op, type: 'insert', pos: del.pos, text: op.text },
      prev
    );
    const result = { ...op, pos: ins.pos, length: del.length };
    console.log(`  REPLACE result: pos ${op.pos} → ${result.pos}, length ${op.length} → ${result.length}`);
    return result;
  }

  console.log(`  No transformation applied`);
  return op;
}

module.exports = { rebase };