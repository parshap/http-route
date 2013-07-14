"use strict";

// Request handler that responds with a 404 Not Found
module.exports = function send404(req, res) {
	res.statusCode = 404;
	res.setHeader("Content-Type", "text/plain");
	res.end(req.method === "HEAD" ? null : "Not Found");
};
