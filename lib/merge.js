"use strict";

var _ = require("underscore");

// Returns a new object that contains merged properties of the given objects
module.exports = function mergeObjects(objects) {
	return _.extend.bind(null, {}).apply(null, objects);
};
