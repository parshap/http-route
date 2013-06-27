"use strict";

var test = require("tape"),
	http = require("http"),
	route = require("./"),
	concat = require("concat-stream");

var HTTP_METHODS = [
	"HEAD",
	"GET",
	"POST",
	"PUT",
	"DELETE",
	"OPTIONS",
	"TRACE",
];

HTTP_METHODS.forEach(function(expectedMethod) {
	test("Server matching " + expectedMethod, function(t) {
		var server = createMethodServer(expectedMethod),
			pendingRequests = 0;

		HTTP_METHODS.forEach(function(method) {
			test(method + " request to " + expectedMethod + " server", function(t) {
				pendingRequests += 1;
				http.request({
						host: "localhost",
						port: server.address().port,
						method: method,
						path: "/",
					})
					.on("response", function(res) {
						var isExpectedMethod = method === expectedMethod,
							isHead = method === "HEAD",
							expectedStatus = isExpectedMethod ? 200 : 404,
							expectedBody = isHead ? undefined :
								(isExpectedMethod ? method : "Not Found");
						t.equal(res.statusCode, expectedStatus);
						res.setEncoding("utf8");
						res.pipe(concat(function(body) {
							if (method !== "HEAD") {
								t.equal(body, expectedBody);
							}
							t.end();
							pendingRequests -= 1;
							if (pendingRequests === 0) {
								server.close();
							}
						}));
					})
					.on("error", function(err) {
						t.ifError(err);
					})
					.end();
			});
		});

		server.listen(0, function() {
			t.end();
		});

		t.on("end", function() {
		});
	});
});

function createMethodServer(method) {
	return http.createServer(route(method, function(req, res) {
		var body;
		if (req.method !== "HEAD") {
			body = req.method;
		}
		res.end(body);
	}));
}
