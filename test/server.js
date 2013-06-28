"use strict";

var http = require("http"),
	_ = require("underscore");

module.exports = function createServer(handler, callback) {
	var server = http.createServer(handler);
	server.listen(0, function() {
		callback(function(opts, cb) {
			return http.request(_.extend(opts, {
				address: "localhost",
				port: server.address().port,
			}), cb);
		});
	});
	return server;
};
