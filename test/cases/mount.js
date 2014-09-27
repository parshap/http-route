"use strict";

var test = require("tape"),
	_ = require("underscore"),
	route = require("../../"),
	createServer = require("../server");

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
		t.equals(req.baseUrl, "/foo");
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

test("double mounted route adjusts url", function(t) {
	var handle = route("/foo", route("/bar", function(req, res) {
		t.equals(req.url, "/");
		t.equals(req.originalUrl, "/foo/bar");
		t.equals(req.baseUrl, "/foo/bar");
		res.end();
	}));

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
			t.equals(req.baseUrl, "/foo");
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
