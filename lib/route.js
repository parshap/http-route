"use strict";

var connect = require("connect"),
	_ = require("underscore");

module.exports = createRoute;

// # Route
//
// A route is composed of one or more conditions. The route is matched if all
// conditions are met.
//
// Conditions are defined as functions that take a request object and determine
// whether or not the condition is met. Condition functions can also return new
// state for the request object.
//
// ## Condition Functions
//
// ```
// function isGet(req) {
//   return req.method === "GET";
// }
//
// function isConditional(req) {
//   return req.headers["If-Modified-Since"] ||
//     req.headers["If-Unmodified-Since"];
// }
//
// function isFooRoute(req) {
//   if (req.url.slice(0, 4) === "/foo") {
//     // Return new state for the req object
//     return {
//       url: req.url.slice("/foo".length),
//       isFooRoute: true,
//     };
//   }
// }
//
// // Multiple conditions are combined into a single functions with
// `combineConditions`.
//
// var condition = combineConditions(isConditional, isGet, isFooRoute);
//
// http.createServer(createRoute(condition, function(req, res) {
//   // ...
// }));
// ```
//
// ## Condition Strings
//
// ```
// // Mount under the given path
// createRoute("/foo/:id", function(req, res, next) {
// });
//
// // Match POST requests to the given path
// createRoute("POST /:cardID", isCopy, function(req, res, next( {
// });
//
// // Match GET requests at any path
// createRoute("GET", function(req, res, next) {
// });
// ```
//
// ## Condition Objects
//
//  * **path**: The request path must match the given path exactly
//  * **mount**: The request path must begin with the given path and will be
//    "mounted" under the given path (`req.url` will be adjusted to reflect
//    this)
//  * **method**: The request method must match the given method

function createRoute(condition, app) {
	// Normalize condition strings and objects into a condition function
	var conditionFn = parseCondition(condition),
		handle = createMiddleware(app);

	return function(req, res, next) {
		var state = conditionFn(req),
			isMatch = !! state;

		if ( ! isMatch) {
			return next();
		}

		// Update req state, first saving the current state
		var stateKeys = Object.keys(state),
			prevState = extractProperties(req, stateKeys);
		_.extend(req, state);

		// Call the handler and then return the previous req state
		handle(req, res, function(err) {
			// @TODO Some properties that were previously non-existent
			// will now exist and have the value `undefined`
			_.extend(req, prevState);
			next(err);
		});
	};
}

// Combines multiple condition functions into a single one
function combineConditions(conditions) {
	return function(req) {
		var states = conditions.map(function(condition) {
				return condition(req);
			}),
			isMatch = states.every(Boolean);

		return isMatch ? mergeObjects(states) : false;
	};
}

// Returns a new object that contains merged properties of the given array of
// objects
function mergeObjects(objects) {
	return objects.reduce(function(merged, obj) {
		return _.extend(merged, obj);
	}, {});
}

// Returns a new object containing values of the given keys from the given
// object
function extractProperties(object, keys) {
	return keys.reduce(function(props, name) {
		props[name] = object[name];
		return props;
	}, {});
}

// Creates a middleware function that will execute the given request handler
function createMiddleware(handler) {
	if ( ! handler) {
		throw new Error("No handler given");
	}

	// Already a raw middleware function
	if (typeof handler === "function") {
		return handler;
	}

	// Connect server
	else if (typeof handler.handle === "function") {
		return function(req, res, next) {
			handler.handle(req, res, next);
		};
	}

	// http.Server
	else if (handler instanceof require("http").Server) {
		return handler.listeners('request')[0];
	}

	console.log(handler);

	// Input was not a valid handler
	throw new Error("Not a handler");
}

// Parse input and return an array of condition functions
function parseCondition(condition) {
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
}

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
