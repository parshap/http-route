"use strict";

// Returns a new object containing values of the given keys from the given
// object, including missing properties
module.exports = function extractProperties(object, keys) {
	return keys.reduce(function(props, name) {
		props[name] = object[name];
		return props;
	}, {});
};
