"use strict";

var connect = require("connect"),
	_ = require("underscore"),
	merge = require("./merge");

// Parse input and return an array of condition functions
module.exports = function createCondition(condition) {
	var type = getConditionType(condition).name,
		parse = CONDITION_PARSERS[type];

	if (type === "function") {
		// Already a function, don't need to parse
		return condition;
	}

	if ( ! type || ! parse) {
		throw new Error("Invalid condition input");
	}

	return parse(condition);
};

function getConditionType(condition) {
	return _.find(CONDITION_TYPES, function(type) {
		if (type.checker(condition)) {
			return type.name;
		}
	});
}

var CONDITION_TYPES = [
	{
		name: "function",
		checker: _.isFunction,
	}, {
		name: "string",
		checker: _.isString,
	},
	{
		name: "object",
		checker: _.isObject,
	},
];

var CONDITION_PARSERS = {
	"string": parseConditionString,
	"object": parseConditionObject,
};

function parseConditionString(condition) {
	return parseConditionObject(parseConditionStringIntoObject(condition));
}

function parseConditionStringIntoObject(condition) {
	if ( ! condition.length) {
		throw new Error("Condition string must not be empty");
	}

	var firstPart = condition.split(/ /, 1)[0],
		hasParts = condition.length > firstPart.length,
		rest = condition.slice(firstPart.length + 1);

	// "GET /path/to/something"
	if (hasParts) {
		return {
			method: firstPart,
			path: rest,
		};
	}

	// "GET"
	else if (HTTP_METHODS.indexOf(firstPart) !== -1) {
		return {
			method: firstPart,
		};
	}

	// "/path/to/something"
	return {
		mount: firstPart,
	};
}

var HTTP_METHODS = [
	"HEAD",
	"GET",
	"POST",
	"PUT",
	"DELETE",
	"OPTIONS",
	"TRACE",
	"CONNECT",
];

// Returns an array of condition functions to match the conditions defined
// by the given condition object
function parseConditionObject(obj) {
	var conditions = [];

	if (obj.method) {
		conditions.push(createMethodCondition(obj.method));
	}

	if (obj.mount) {
		conditions.push(createPathCondition(obj.mount));
	}

	if (obj.path) {
		conditions.push(createPathCondition(obj.path, { exact: true }));
	}

	return combineConditions(conditions);
}

// Combines multiple condition functions into a single one
function combineConditions(conditions) {
	return function(req) {
		var states = conditions.map(function(condition) {
				return condition(req);
			}),
			isMatch = states.every(Boolean);

		// Merge states into a single object
		return isMatch ? merge(states) : false;
	};
}

// Creates a condition function that determines if a request matches the given
// path. If `options.exact` is truthy, the request path must match exactly,
// otherwise the request path only needs to begin with the given path.
//
// If the route is matched, new state is returned for the request object to
// adjust `req.url` and add any path parameters to `req.params`.
//
// Inspired by https://github.com/weavejester/clout
function createPathCondition(path, options) {
	path = normalizePath(path);
	options = options || {};
	var pathRE = createPathRE(path, options);

	return function(req) {
		// Initialize `req.params`
		if ( ! req.params) {
			req.params = {};
		}

		// @TODO Maybe remove `connect` dependency
		var reqPath = connect.utils.parseUrl(req).pathname,
			results = pathRE.exec(reqPath),
			isMatch = !! results;

		if ( ! isMatch) {
			return false;
		}

		var
			// Get the matched part of the path
			matched = results[0],
			// Get any remaining url path
			remaining = reqPath.slice(matched.length),
			// Get values of matched params
			paramValues = results.slice(1),
			// Create params object from the keys and values arrays
			params = _.object(pathRE.keys, paramValues);

		return {
			url: normalizePath(remaining),
			// @TODO #perf Maybe use object prototype instead of copying
			params: _.extend({}, req.params, params),
		};
	};
}

// Creates a regular expression to match the given path and also exposes the
// param keys in the path
function createPathRE(path, options) {
	var keys = [],
		// Replace params in the path with a regular expression to match
		// the param, saving the key name of the param. For example, the path
		// `"/foo/:id"` will be turned into `"/foo/([^/]+)"` and the key name
		// `"id"` will be saved in keys.
		pattern = path.replace(/:([^/]+)/g, function(_, key) {
			keys.push(key);
			return PARAM_REGEX;
		});

	// Must match path from beginning
	pattern = "^" + pattern;

	if (options.exact) {
		// Must match to end
		pattern = pattern + "$";
	}

	var re = new RegExp("^" + pattern);
	re.keys = keys;
	return re;
}

var PARAM_REGEX = "([^/]+)";

// Normalizes empty paths to be the "root path" (`"/"`)
function normalizePath(path) {
	if (path[0] !== "/") {
		path = "/" + path;
	}
	return path;
}

function createMethodCondition(method) {
	return function(req) {
		return req.method === method;
	};
}
