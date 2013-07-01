var route = require("http-route");

route("GET", get);
route("POST", create);
route(patchCondition, patch);
route("PUT", put);
route("DELETE", del);

function patchCondition(req) {
	return req.method === "PATCH" ||
		(req.method === "PUT" && req.query.patch);
}
