/*
 * Shared helpers: response format, error handling, query-string parsing
 * and input validation.
 */
var mongoose = require('mongoose');

// An error we raise on purpose, carrying the HTTP status and a client-safe message.
function ApiError(status, message, data) {
    this.status = status;
    this.message = message;
    this.data = data === undefined ? null : data;
}

function send(res, status, message, data) {
    return res.status(status).json({ message: message, data: data === undefined ? null : data });
}

// Convert any thrown error into a response that does not leak Mongoose/MongoDB internals.
function handleError(res, err) {
    if (err instanceof ApiError) {
        return send(res, err.status, err.message, err.data);
    }
    if (err && (err.name === 'CastError' || err.name === 'StrictModeError')) {
        return send(res, 400, 'Bad request: a value has an invalid format', null);
    }
    if (err && err.code === 11000) {
        return send(res, 400, 'A user with this email already exists', null);
    }
    if (err && err.name === 'MongoServerError') {
        // The database rejected the query itself (e.g. a malformed where/sort/select).
        return send(res, 400, 'Bad request: the query could not be processed', null);
    }
    console.error(err);
    return send(res, 500, 'Internal server error, please try again later', null);
}

// Wrap an async route handler so that every error goes through handleError.
function wrap(fn) {
    return function (req, res) {
        Promise.resolve(fn(req, res)).catch(function (err) { handleError(res, err); });
    };
}

function isValidId(id) {
    return typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id) && mongoose.isValidObjectId(id);
}

// Parse a JSON-encoded query-string parameter that must be an object.
function parseJsonObject(value, paramName) {
    if (value === undefined) return undefined;
    var parsed;
    try {
        parsed = JSON.parse(value);
    } catch (e) {
        throw new ApiError(400, 'Invalid JSON in the "' + paramName + '" parameter');
    }
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new ApiError(400, 'The "' + paramName + '" parameter must be a JSON object');
    }
    return parsed;
}

// Parse a non-negative integer query-string parameter.
function parseNonNegInt(value, paramName) {
    if (value === undefined) return undefined;
    var str = String(value).trim();
    if (!/^\d+$/.test(str)) {
        throw new ApiError(400, 'The "' + paramName + '" parameter must be a non-negative integer');
    }
    return parseInt(str, 10);
}

function parseCount(value) {
    if (value === undefined) return false;
    var str = String(value).trim().toLowerCase();
    if (str === 'true') return true;
    if (str === 'false' || str === '') return false;
    throw new ApiError(400, 'The "count" parameter must be true or false');
}

// Accept either "select" or the older "filter" name for the projection.
function getSelect(query) {
    return parseJsonObject(query.select !== undefined ? query.select : query.filter, 'select');
}

/*
 * GET on a collection: where, sort, select, skip, limit, count, all applied
 * through Mongoose query methods.
 */
async function listCollection(Model, query, defaultLimit) {
    var where = parseJsonObject(query.where, 'where') || {};
    var sort = parseJsonObject(query.sort, 'sort');
    var select = getSelect(query);
    var skip = parseNonNegInt(query.skip, 'skip');
    var limit = parseNonNegInt(query.limit, 'limit');
    var count = parseCount(query.count);

    if (count) {
        var options = {};
        if (skip !== undefined) options.skip = skip;
        if (limit !== undefined && limit > 0) options.limit = limit;
        return await Model.countDocuments(where, options);
    }

    var q = Model.find(where);
    if (sort) q = q.sort(sort);
    if (select) q = q.select(select);
    if (skip !== undefined) q = q.skip(skip);
    if (limit === undefined) limit = defaultLimit;
    if (limit !== undefined && limit > 0) q = q.limit(limit);
    return await q.lean().exec();
}

// GET /:id with optional select. Any id that is not an existing document is a 404.
async function findOneById(Model, id, query, label) {
    var select = getSelect(query);
    if (!isValidId(id)) throw new ApiError(404, label + ' not found');
    var q = Model.findById(id);
    if (select) q = q.select(select);
    var doc = await q.lean().exec();
    if (!doc) throw new ApiError(404, label + ' not found');
    return doc;
}

// ----- field validation helpers -----

function requireString(body, field, label) {
    var v = body[field];
    if (v === undefined || v === null) throw new ApiError(400, label + ' is required');
    if (typeof v !== 'string') throw new ApiError(400, label + ' must be a string');
    if (v.trim() === '') throw new ApiError(400, label + ' is required');
    return v.trim();
}

function optionalString(body, field, label, defaultValue) {
    var v = body[field];
    if (v === undefined || v === null) return defaultValue;
    if (typeof v !== 'string') throw new ApiError(400, label + ' must be a string');
    return v;
}

function parseBoolean(value, label) {
    if (value === undefined || value === null || value === '') return false;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
        var s = value.trim().toLowerCase();
        if (s === 'true') return true;
        if (s === 'false') return false;
    }
    throw new ApiError(400, label + ' must be true or false');
}

function parseDate(value, label) {
    if (value === undefined || value === null || value === '') {
        throw new ApiError(400, label + ' is required');
    }
    var d;
    if (typeof value === 'number') {
        d = new Date(value);
    } else if (typeof value === 'string') {
        d = /^-?\d+$/.test(value.trim()) ? new Date(Number(value.trim())) : new Date(value);
    } else {
        throw new ApiError(400, label + ' must be a valid date');
    }
    if (isNaN(d.getTime())) throw new ApiError(400, label + ' must be a valid date');
    return d;
}

module.exports = {
    ApiError: ApiError,
    send: send,
    handleError: handleError,
    wrap: wrap,
    isValidId: isValidId,
    listCollection: listCollection,
    findOneById: findOneById,
    requireString: requireString,
    optionalString: optionalString,
    parseBoolean: parseBoolean,
    parseDate: parseDate
};
