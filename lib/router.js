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
		var handle = createHandler(app);
		return this.use(createRoute(criteria)(function(req, res, next) {
			if (req.url !== "/") {
				return next();
			}

			handle(req, res, next);
		}));
	};

	return app;
};

// # Route
// A route is composed of one or more route condition functions. A route
// condition function determines if the current request matches the route.
//
// Condition functions can return new state for the `req` object.
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
// function isKeyRoute(req) {
//   if (req.url.slice(0, 4) === "/key") {
//     return {
//       url: req.url.slice(4),
//       params: {
//         key: true,
//       },
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
// createRoute("GET /")(function(req, res, next) {
// });
//
// createRoute("POST /", isCopy)(function(req, res, next( {
// });
//
// createRoute("GET /")(function(req, res, next) {
// });

function createRoute(criteria) {
	var match = createMatcher(criteria);

	return function(app) {
		var handle = createHandler(app);

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
				_.extend(req, prevState);
				next(err);
			});
		};
	};
}

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

function mergeObjects(objects) {
	return objects.reduce(function(merged, obj) {
		return _.extend(merged, obj);
	}, {});
}

function extractProperties(object, keys) {
	return keys.reduce(function(props, name) {
		if (object.hasOwnProperty(name)) {
			props[name] = object[name];
		}
		return props;
	}, {});
}

// Returns a request handler function
function createHandler(fn) {
	// Already a raw middleware function
	if (typeof fn === "function") {
		return fn;
	}

	// Connect server
	else if (typeof fn.handle === "function") {
		return function(req, res, next) {
			fn.handle(req, res, next);
		};
	}

	// http.Server
	else if (fn instanceof require("http").Server) {
		return fn.listeners('request')[0];
	}
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
		path: criteria,
	};
}

function getConditions(criteria) {
	var retval = [];

	if (criteria.path) {
		retval.push(createPathCondition(criteria.path));
	}

	if (criteria.method) {
		retval.push(createMethodCondition(criteria.method));
	}

	return retval;
}

var PARAM_REGEX = "([^/]+)";

function createPathCondition(path) {
	// Inspired by https://github.com/weavejester/clout
	var paramKeys = [],
		restr = path.replace(/:([^/]+)/g, function(_, key) {
			paramKeys.push(key);
			return PARAM_REGEX;
		}),
		re = new RegExp("^" + restr);

	return function(req) {
		if ( ! req.params) {
			req.params = {};
		}

		var reqPath = connect.utils.parseUrl(req).pathname,
			results = re.exec(reqPath),
			isMatch = !! results;

		if ( ! isMatch) {
			return false;
		}

		var
			// Get any remaining url path
			remaining = reqPath.slice(results[0].length),
			// Get values of matched params
			paramValues = results.slice(1),
			params = getParams(paramValues, paramKeys);

		return {
			url: remaining,
			// @TODO Use object prototype instead of copying previous params
			params: _.extend({}, req.params, params),
		};
	};
}

// Generate params object using matched params values and keys
function getParams(values, keys) {
	return values.reduce(function(params, value, i) {
		params[keys[i]] = value;
		return params;
	}, {});
}

function createMethodCondition(method) {
	return function(req) {
		return req.method === method;
	};
}
