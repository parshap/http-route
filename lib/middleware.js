"use strict";

// Creates a middleware function that will execute the given request handler
module.exports = function createMiddleware(handler) {
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
};
