"use strict";

var connect = require("connect");

function matchURL(path, url) {
	var keys = [],
		params = {},
		remaining = "",
		restr = path.replace(/:([^/]+)/g, function(_, key) {
			keys.push(key);
			return "([^/]+)";
		}),
		re = new RegExp("^" + restr, "i"),
		results = re.exec(url);

	// No match
	if ( ! results) {
		return false;
	}

	// Get any remaining url path
	remaining = url.slice(results[0].length);

	// Don't match a partial url path
	if (remaining.length && remaining[0] !== "/") {
		return false;
	}

	// Get any parameters
	results.slice(1).forEach(function(value, i) {
		params[keys[i]] = value;
	});

	return {
		params: params,
		remaining: remaining,
	};
}

function Route(path) {
	this.path = path;
}

Route.prototype.match = function(req) {
	var pathname = connect.utils.parseUrl(req).pathname;

	return matchURL(this.path, pathname);
}

function run(fn, req, res, next) {
	var http = require("http");

	if (typeof fn.handle === "function") {
		var server = fn;
		fn = function(req, res, next) {
			server.handle(req, res, next);
		};
	}

	else if (fn instanceof http.Server) {
		fn = fn.listeners('request')[0];
	}

	fn(req, res, next);
}

module.exports = function createRouter() {
	var app = connect();

	Array.prototype.slice.call(arguments).forEach(function(fn) {
		app.use(fn);
	});

	app.mount = function(path, fn) {
		var route = new Route(path);

		this.use(function(req, res, next) {
			var results = route.match(req),
				originalUrl = req.url;

			// Not a match for this route path
			if ( ! results) {
				return next();
			}

			// Save req.originalUrl if it doesn't already have one
			if ( ! req.originalUrl) {
				req.originalUrl = originalUrl;
			}

			// Initialize req.params
			if ( ! req.params) {
				req.params = {};
			}

			Object.keys(results.params).forEach(function(paramKey) {
				req.params[paramKey] = results.params[paramKey];
			});

			// Pass along any remaining portion of the url
			req.url = results.remaining;

			// Make sure the url is at least a "/"
			if ( ! req.url) {
				req.url = "/";
			}

			// Run the fn
			return run(fn, req, res, function() {
				req.url = originalUrl;
				next.apply(this, arguments);
			});
		});

		return this;
	};

	app.route = function(method, fn) {
		this.use(function(req, res, next) {
			if (req.url !== "/" || req.method !== method) {
				return next();
			}

			run(fn, req, res, next);
		});

		return this;
	};

	return app;
};

module.exports.contentNegotiator = function(formats) {
	var keys = Object.keys(formats);

	return function(req, res, next) {
		var accept = req.headers["accept"],
			acceptedFormat;

		keys.some(function(key) {
			if (accept.indexOf(key) > -1) {
				acceptedFormat = formats[key];
			}
		});

		if ( ! acceptedFormat && keys.length && accept.indexOf("*") > -1) {
			acceptedFormat = formats[keys[0]];
		}

		if (acceptedFormat) {
			return acceptedFormat(req, res, next);
		}
		else {
			return next();
		}
	}
};

module.exports.run = run;
