function compress(list) {
  if (!list || list.length === 0) return null;
  if (list.length === 1) return list[0];

  // All ops MUST share same causal anchor
  const base = list[0].baseVersion;
  for (const op of list) {
    if (op.baseVersion !== base) return null;
  }

  const groups = [];
  let current = [list[0]];

  for (let i = 1; i < list.length; i++) {
    const prev = list[i - 1];
    const curr = list[i];

    if (canMerge(prev, curr)) current.push(curr);
    else {
      groups.push(current);
      current = [curr];
    }
  }
  groups.push(current);

  // If more than one independent group → unsafe to compress
  if (groups.length !== 1) return null;

  return mergeGroup(groups[0]);
}

function canMerge(a, b) {
  if (a.opId === b.opId) return false;
  if (a.baseVersion !== b.baseVersion) return false;
  if (a.clientId !== b.clientId) return false;
  if (a.type !== b.type) return false;

  if (a.type === "insert")
    return b.pos === a.pos + a.text.length || b.pos === a.pos;

  if (a.type === "delete")
    return b.pos === a.pos;

  if (a.type === "replace")
    return b.pos === a.pos + a.text.length || b.pos === a.pos;

  return false;
}

function mergeGroup(group) {
  const f = group[0];
  const merged = {
    opId: f.opId,
    clientId: f.clientId,
    baseVersion: f.baseVersion,
    type: f.type,
    pos: f.pos,
    text: f.text || "",
    length: f.length || 0
  };

  for (let i = 1; i < group.length; i++) {
    const n = group[i];
    if (merged.type === "insert") merged.text += n.text;
    else if (merged.type === "delete") merged.length += n.length;
    else if (merged.type === "replace") {
      merged.text += n.text;
      merged.length += n.length;
    }
  }

  return merged;
}

module.exports = { compress };
