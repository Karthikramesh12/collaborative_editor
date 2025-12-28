function compress(list) {
  if (list.length === 1) return list[0];

  // Group by operation type and position continuity
  const groups = [];
  let currentGroup = [list[0]];

  for (let i = 1; i < list.length; i++) {
    const prev = list[i - 1];
    const curr = list[i];
    
    if (canMerge(prev, curr)) {
      currentGroup.push(curr);
    } else {
      groups.push(currentGroup);
      currentGroup = [curr];
    }
  }
  groups.push(currentGroup);

  // Merge each group
  const merged = groups.map(group => mergeGroup(group));
  
  // If all ops merged into one, return it
  if (merged.length === 1) return merged[0];
  
  // For testing/debugging, we might want to see what couldn't be merged
  console.warn("Batch contained non-mergable ops:", merged.length);
  
  // FIX: Handle multiple non-mergable ops properly
  // For now, return the first one and log the rest
  for (let i = 1; i < merged.length; i++) {
    console.warn(`[COMPRESS] Non-mergable op ${i}:`, {
      opId: merged[i].opId?.substring(0, 8),
      type: merged[i].type,
      pos: merged[i].pos,
      text: merged[i].text?.substring(0, 20)
    });
  }
  
  return merged[0]; // Return first merged op
}

function canMerge(a, b) {
  // FIX: If opIds are the same, they're DUPLICATES - don't merge!
  if (a.opId === b.opId) return false;  // Same opId = duplicate!
  
  if (a.clientId !== b.clientId) return false;
  if (a.type !== b.type) return false;

  // INSERT chain: allow same-position spam and cursor-forward typing
  if (a.type === "insert") {
    return (
      b.pos === a.pos + a.text.length ||   // normal typing
      b.pos === a.pos                      // spam / paste / IME streams
    );
  }

  // DELETE chain
  if (a.type === "delete") {
    return b.pos === a.pos;
  }

  // REPLACE chain
  if (a.type === "replace") {
    return b.pos === a.pos + a.text.length || b.pos === a.pos;
  }

  return false;
}

function mergeGroup(group) {
  const first = group[0];

  const merged = {
    opId: first.opId,                    // canonical chain id
    clientId: first.clientId,
    baseVersion: first.baseVersion,      // DO NOT DROP THIS
    baseServerSeq: first.baseServerSeq,  // engine uses this
    type: first.type,
    pos: first.pos,
    text: first.text || "",
    length: first.length || 0
  };

  for (let i = 1; i < group.length; i++) {
    const next = group[i];

    if (merged.type === "insert") {
      merged.text += next.text;
    }
    else if (merged.type === "delete") {
      merged.length += next.length;
    }
    else if (merged.type === "replace") {
      merged.text += next.text;
      merged.length += next.length;
    }
  }

  return merged;
}

function merge(a, b) {
  if (!canMerge(a, b)) return a;
  
  const merged = { ...a };
  
  if (a.type === "insert" && b.type === "insert") {
    merged.text += b.text;
  }
  else if (a.type === "delete" && b.type === "delete") {
    merged.length += b.length;
  }
  else if (a.type === "replace" && b.type === "replace") {
    merged.text += b.text;
    merged.length += b.length;
  }
  
  return merged;
}

module.exports = { compress, canMerge, mergeGroup };