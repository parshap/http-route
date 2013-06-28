"use strict";

var _ = require("underscore"),
	createCondition = require("./lib/condition"),
	createMiddleware = require("./lib/middleware"),
	send404 = require("./lib/404"),
	extract = require("./lib/extract");

module.exports = function createRoute(condition, app) {
	// Normalize condition strings and objects into a condition function
	var conditionFn = createCondition(condition),
		handle = createMiddleware(app);

	return function(req, res, next) {
		var state = conditionFn(req),
			isMatch = !! state;

		next = next || send404.bind(null, req, res);

		if ( ! isMatch) {
			return next();
		}

		// Update req state, first saving the current state
		var stateKeys = Object.keys(state),
			prevState = extract(req, stateKeys);
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
