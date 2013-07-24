"use strict";

var route = require("http-route"),
	connect = require("connect");

function restRoute(resource) {
	return connect()
		.use(route("POST", resource.create))
		.use(route("/:id", connect()
			.use(route("GET", resource.get))
			.use(route(patchCondition, resource.patch))
			.use(route("PUT", resource.put))
			.use(route("DELETE", resource.del))
		));
}

function patchCondition(req) {
	return req.method === "PATCH" ||
		(req.method === "PUT" && req.query.patch);
}

route("/blog", connect()
	.use(restRoute(blog))
)

resource(function(route) {
	// parse input data into resource object
	// get, put, patch, delete
	// options
});

// Notes on streaming
//  * Do we need intermediate streams before piping back out to res to
//    transform from model->http
//  * Do we pipe req into stream for input (e.g., find criteria) or do we
//    parse that first

collection(resource, function(route) {
	// parse input data into array of resource objects
	// post, get
	// options
	return connect()
		.use(route("POST /", create))
		.use(route("OPTIONS /", options))
		.use(route("/:id", resource))
	// @TODO How do we get ID in resource handling context
});

collection({
	GET: function(req, res, context) {
		createFindStream(User, getFindOptions(req))
			.pipe(res);
	},
	POST: function(req, res, context) {
		res
			.pipe(createParseJSONStream())
			.pipe(createParseUserCollectionStream())
			.pipe(createCreateStream(User, getCreateOptions(req)))
			.pipe(res);
	},
});

resource({
	GET: function(req, res, context) {
		User.findById(context.id)
			.pipe(res);
	},
	PUT: function(req, res, context) {
		req
			.pipe(User.updateById(context.id))
			.pipe(res);
	},
	PATCH: function(req, res, context) {
		req
			.pipe(User.updateById(context.id, { patch: true }))
			.pipe(res);
	},
	DELETE: function(req, res, context) {
		req
			.pipe(User.deleteById(context.id))
			.pipe(res);
	},
})

rest("list");

function routeResource(resource) {
	rest(function(route) {
		route("list", resource.list);
		route("create", resource.create);
		route("get", resource.get);
		route("put", resource.update);
	});
}
