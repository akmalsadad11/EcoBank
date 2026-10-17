const { ZodError } = require('zod');

class ApiError extends Error {
    constructor(status, message, details) {
        super(message);
        this.status = status;
        this.details = details;
    }
}

const ok = (res, data, status = 200, extra = {}) => res.status(status).json({ ok: true, data, ...extra });

// Validasi dengan zod, lempar 422 berisi daftar field yang salah
function parse(schema, input) {
    const r = schema.safeParse(input);
    if (r.success) return r.data;
    const detail = r.error.issues.map((i) => ({ field: i.path.join('.'), pesan: i.message }));
    throw new ApiError(422, detail[0] ? detail[0].pesan : 'Data tidak valid.', detail);
}

function pagination(query, defaultLimit = 20) {
    const page = Math.max(parseInt(query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(query.limit, 10) || defaultLimit, 1), 100);
    return { page, limit, offset: (page - 1) * limit };
}

const toId = (v) => {
    const n = parseInt(v, 10);
    if (!Number.isInteger(n) || n <= 0) throw new ApiError(400, 'ID tidak valid.');
    return n;
};

module.exports = { ApiError, ok, parse, pagination, toId, ZodError };
