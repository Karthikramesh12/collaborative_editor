function rebaseCursor(pos, op){
    if (op.type === "insert" && op.pos <= pos){
        return pos + op.text.length;
    }

    if (op.type === "delete" && op.pos < pos){
        return Math.max(op.pos, pos - op.length);
    }

    if (op.type === "replace"){
        return rebaseCursor(rebaseCursor(pos, {type:"delete", pos:op.pos, length: op.length}), {type: "insert", pos: op.pos, text:op.text});
    }
    return pos;
}

module.exports = { rebaseCursor };