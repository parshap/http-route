"use strict";

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

var _ = require("underscore"),
	createCondition = require("./condition"),
	createMiddleware = require("./middleware"),
	send404 = require("./404"),
	extract = require("./extract");

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
