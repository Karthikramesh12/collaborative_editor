const { validate } = require('../engine/operations.js');

function gaurd(op){
    validate(op);

    if (typeof op.opId !== 'string'){
        throw new Error("INVALID_OPID");
    }

    if(typeof op.clientId !== 'string'){
        throw new Error("INVALID_CLIENTID");
    }

    if (op.pos > 500000) {
        throw new Error("OP_POS_TOO_LARGE");
    }

    if (op.text && op.text.length > 10000){
        throw new Error("OP_PAYLOAD_TOO_LARGE");
    }

    return op;
}

module.exports = {
    gaurd,
}