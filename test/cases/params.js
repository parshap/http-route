"use strict";

var test = require("tape"),
	route = require("../../"),
	createServer = require("../server");

test("path params get parsed", function(t) {
	var handle = route("/users/:id/:key/:id", function(req, res) {
		t.equals(req.params.id, "2");
		t.equals(req.params.key, "address");
		res.end();
	});

	var server = createServer(handle, function(request) {
		var req = request({
			method: "GET",
			path: "/users/1/address/2",
		});
		req.end();
		req.on("response", function(res) {
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

test("nested params", function(t) {
	var handle = connect()
		.use(top)
		.use(route("/users/:id", connect()
			.use(nested1)
			.use(route("GET /:key/:id", nested2))
			.use(nested1)
		))
		.use(top);

	function top(req, res, next) {
		t.equals(req.params, undefined);
		next();
	}

	function nested1(req, res, next) {
		t.equals(Object.keys(req.params).length, 1);
		t.equals(req.params.id, "1");
		next();
	}

	function nested2(req, res, next) {
		t.equals(Object.keys(req.params).length, 2);
		t.equals(req.params.key, "address");
		t.equals(req.params.id, "2");
		next();
	}

	var server = createServer(handle, function(request) {
		var req = request({
			method: "GET",
			path: "/users/1/address/2",
		});
		req.end();
		req.on("response", function(res) {
			res.resume(); // force stream to flow
			res.once("end", end);
		});
	});

	function end() {
		t.end();
		server.close();
	}
});
