/**
 * The `router` function creates a Connect middleware stack that only gets
 * executed if the specified route is matched. The router returns a connect
 * server with two added functions:
 *
 *  * mount: Will execute the given middleware if the request url begins
 *    with the given url.
 *
 *  * route: Will execute the given middleware if the request method matches
 *    the given method *and* the url matches exactly.
 *
 * Example usage:
 *
 * var myApp = router();
 *
 * myApp.mount("/foo", function(req, res, next) {
 *     // This middleware is called for any requests with a URL starting with
 *     // `/foo` (e.g., `/foo` or `/foo/bar`) with any method (e.g., GET, POST).
 *     res.end("foo");
 * });
 *
 * myApp.mount("/bar", router()
 *     .route("GET", function(req, res, next) {
 *         // This middleware is called for only GET requests with a matched
 *         // URL. This will be executed for a `GET /bar` request, but not
 *         // `GET /bar/foo`
 *         res.end("GET");
 *     });
 * });
 */

"use strict";

var connect = require("connect"),
	_ = require("underscore");

module.exports = function createRouter() {
	var app = connect();

	Array.prototype.slice.call(arguments).forEach(function(fn) {
		app.use(fn);
	});

	app.mount = function(criteria, app) {
		return this.use(createRoute(criteria)(app));
	};

	app.route = function(criteria, app) {
		var handle = createMiddleware(app);
		return this.use(createRoute(criteria)(function(req, res, next) {
			if (req.url !== "/") {
				return next();
			}

			handle(req, res, next);
		}));
	};

	return app;
};

module.exports.createRoute = createRoute;

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
// function isGet(req) {
//   return req.method === "GET";
// }
//
// function hasCondition(req) {
//   return req.headers["If-Modified-Since"] ||
//     req.headers["If-Unmodified-Since"];
// }
//
// function isFooRoute(req) {
//   if (req.url.slice(0, 4) === "/foo") {
//     // Return new state for the req object
//     return {
//       url: req.url.slice(4),
//       isFooRoute: true,
//     };
//   }
// }
//
// var getKeyRoute = createRoute([isGet, isKeyRoute]);
//
// http.createServer(getKeyRoute(function(req, res) {
//   // ...
// }))
//
// ## Condition Strings
//
// // Mount under the given path
// createRoute("/foo/:id")(function(req, res, next) {
// });
//
// // Match POST requests to the given path
// createRoute("POST /:cardID", isCopy)(function(req, res, next( {
// });
//
// // Match GET requests at any path
// createRoute("GET")(function(req, res, next) {
// });
//
// ## Condition Objects
//
//  * **path**: The request path must match the given path exactly
//  * **mount**: The request path must begin with the given path and will be
//    "mounted" under the given path (`req.url` will be adjusted to reflect
//    this)
//  * **method**: The request method must match the given method

function createRoute(criteria) {
	var match = createMatcher(criteria);

	return function(app) {
		var handle = createMiddleware(app);

		return function(req, res, next) {
			var state = match(req),
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
	};
}

// Creates a function that determines if a request matches the condition
function createMatcher(criteria) {
	var conditions = parseCriteria(criteria);

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

	// Input was not a valid handler
	throw new Error("Not a handler");
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

// Parse input and return an array of condition functions
function parseCriteria(criteria) {
	if (_.isString(criteria)) {
		criteria = parseStringCriteria(criteria);
	}

	return getConditions(criteria);
}

function parseStringCriteria(criteria) {
	var parts = criteria.split(/\s+/, 2);

	// "GET /path/to/something"
	if (parts.length > 1) {
		return {
			method: parts[0],
			path: parts[1],
		};
	}

	// "GET"
	else if (HTTP_METHODS.indexOf(criteria) !== -1) {
		return {
			method: criteria,
		};
	}

	// "/path/to/something"
	return {
		mount: criteria,
	};
}

// Returns an array of condition functions to match the conditions defined
// by the given condition object
function getConditions(obj) {
	var retval = [];

	if (obj.method) {
		retval.push(createMethodCondition(obj.method));
	}

	if (obj.mount) {
		retval.push(createPathCondition(obj.mount));
	}

	if (obj.path) {
		retval.push(createPathCondition(obj.path, true));
	}

	return retval;
}

// Creates a condition function to match the given path
function createPathCondition(path, exact) {
	var match = createPathMatcher(path, !! exact);

	return function(req) {
		// Initialize `req.params`
		if ( ! req.params) {
			req.params = {};
		}

		return match(req);
	};
}

// Creates a function that determines if the given request matches the given
// path. If `exact` is truthy, the request path must match exactly, otherwise
// the request path only needs to begin with the given path.
//
// If the route is matched, new state is returned for the request object,
// adjusting `req.url` and adding path parameters to `req.params`.
//
// Inspired by https://github.com/weavejester/clout
function createPathMatcher(path, exact) {
	var pathRE = createPathRE(path, exact);

	return function(req) {
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

		// Represent empty path with root path
		if ( ! remaining) {
			remaining = "/";
		}

		return {
			url: remaining,
			// @TODO Use object prototype instead of copying previous params
			params: _.extend({}, req.params, params),
		};
	};
}

var PARAM_REGEX = "([^/]+)";

// Creates a regular expression to match the given path and also exposes the
// param keys in the path
function createPathRE(path, exact) {
	var keys = [],
		// Replace params in the path with a regular expression to match
		// the param, saving the key name of the param. For example, the path
		// `"/foo/:id"` will be turned into `"/foo/([^/]+)"` and the key name
		// `"id"` will be saved in keys.
		pattern = path.replace(/:([^/]+)/g, function(_, key) {
			keys.push(key);
			return PARAM_REGEX;
		});

	pattern = "^" + pattern;

	if (exact) {
		pattern = pattern + "$";
	}

	var re = new RegExp("^" + pattern);
	re.keys = keys;
	return re;
}

function createMethodCondition(method) {
	return function(req) {
		return req.method === method;
	};
}
