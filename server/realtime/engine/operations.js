const OP_TYPE = {
    INSERT: 'insert',
    DELETE: 'delete',
    REPLACE: 'replace'
};

function validate(op) {
    if (!op.opId) throw new Error("missing opId");
    if (typeof op.baseVersion !== "number") throw new Error("missing baseVersion");
    if (!Object.values(OP_TYPE).includes(op.type)) throw new Error("invalid type");
    if (typeof op.pos !== 'number' || op.pos < 0) throw new Error("invalid pos");

    if (op.type === OP_TYPE.INSERT && typeof op.text !== 'string') {
        throw new Error("insert requires text");
    }

    if (op.type === OP_TYPE.DELETE && typeof op.length !== 'number') {
        throw new Error("delete requires length");
    }

    if (op.type === OP_TYPE.REPLACE) {
        if (typeof op.text !== 'string' || typeof op.length !== 'number') {
            throw new Error("replace requires text and length");
        }
    }
}

function apply(str, op) {
    switch (op.type) {
        case OP_TYPE.INSERT:
            return str.slice(0, op.pos) + op.text + str.slice(op.pos);

        case OP_TYPE.DELETE:
            return str.slice(0, op.pos) + str.slice(op.pos + op.length);

        case OP_TYPE.REPLACE:
            return str.slice(0, op.pos) + op.text + str.slice(op.pos + op.length);
    }
}

module.exports = { OP_TYPE, validate, apply };
