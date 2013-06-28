"use strict";

var connect = require("connect"),
	_ = require("underscore");

module.exports = createPathCondition;
module.exports.createRE = createRE;

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
	var pathRE = createRE(path, options);

	return function(req) {
		// @TODO Maybe remove `connect` dependency
		var reqPath = connect.utils.parseUrl(req).pathname,
			results = pathRE.exec(reqPath),
			isMatch = !! results;

		if ( ! isMatch) {
			return false;
		}

		// Save original url
		if ( ! req.originalUrl) {
			req.originalUrl = req.url;
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
function createRE(path, options) {
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
