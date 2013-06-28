"use strict";

var http = require("http"),
	test = require("tape"),
	_ = require("underscore"),
	route = require("../");

test("mounted route matches only correct url", function(t) {
	var handle = route("/foo", function(req, res) {
		// This route should never match
		t.assert(false);
	});

	var server = createServer(handle, function(request) {
		var req = request({
			method: "POST",
			path: "/bar/foo",
		});
		req.end();
		req.on("response", function(res) {
			t.equals(res.statusCode, 404);
			res.resume(); // force stream to flow
			res.once("end", end);
		});
	});

	function end() {
		t.end();
		server.close();
	}
});

test("mounted route adjusts url", function(t) {
	var handle = route("/foo", function(req, res) {
		t.equals(req.url, "/bar");
		t.equals(req.originalUrl, "/foo/bar");
		res.end();
	});

	var server = createServer(handle, function(request) {
		var req = request({
			method: "DELETE",
			path: "/foo/bar",
		});
		req.end();
		req.on("response", function(res) {
			t.equals(res.statusCode, 200);
			res.resume(); // force stream to flow
			res.once("end", end);
		});
	});

	function end() {
		t.end();
		server.close();
	}
});

var connect = require("connect");

test("mounted route returns url back", function(t) {
	var app = connect()
		.use(route("/foo", function(req, res, next) {
			t.equals(req.url, "/bar");
			t.equals(req.originalUrl, "/foo/bar");
			next();
		}))
		.use(function(req, res, next) {
			t.equals(req.url, "/foo/bar");
			res.end();
		});

	var server = createServer(app, function(request) {
		var req = request({
			method: "GET",
			path: "/foo/bar",
		});
		req.end();
		req.on("response", function(res) {
			res.resume();
			res.once("end", end);
		});
	});

	function end() {
		t.end();
		server.close();
	}
});

function createServer(handler, callback) {
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
}
