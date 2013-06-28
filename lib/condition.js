"use strict";

var _ = require("underscore"),
	merge = require("./merge"),
	createPathCondition = require("./path");

module.exports = createCondition;
module.exports.path = createPathCondition;
module.exports.method = createMethodCondition;
module.exports.combine = combineConditions;

// Parse input and return an array of condition functions
function createCondition(condition) {
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

function createMethodCondition(method) {
	return function(req) {
		return req.method === method;
	};
}
