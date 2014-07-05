# http-route

HTTP routing with a nestable functional style.

This module exports a function that wraps a given *http handler*
and returns a new *http handler* that is only executed if the given
*condition* is met.

## Usage

```js
var route = require("http-route");
var compose = require("http-compose");
var createServer = require("http").createServer;

createServer(compose([
  route(isWrite, checkCSRF),
  route("/hello", compose([
    route("GET /:name", sendHello),
    route("GET /", sendDefaultHello),
  ]),
]).listen(8080);

function isWrite(req) {
  return ["PUT", "POST", "DELETE"].indexOf(req.method) !== -1;
}

function checkCSRF(req, res, callback) {
  if (req.headers["x-csrf-token"] !== "magic") {
    res.statusCode = 400;
    res.end("Invalid request");
    return;
  }
  callback();
}

function sendHello(req, res) {
  res.end("hello, " + req.params.name);
}

function sendDefaultHello(req, res) {
  res.end("hello world");
}
```

### Conditions

Conditions are functions that determine if a request
matches the route or not. A condition function can contain any arbitrary
logic, as long as it synchronously returns a truthy or falsey value.

There are also higher-order conditions, such as strings, that get
"compiled" down to a condition function. For example, the string
`"GET /hello"` is equivalent to the following condition function:

```js
function(req) {
  return req.method === "GET" && req.url === "/hello";
}
```

Condition functions can also modify the state of the current request.
For example, condition functions can modify `req.url` so that nested
routes can match only the remaining part of the URL. They can also parse
out parameters from the URL and populate something like `req.params`.

#### Functions

Any arbitrary function with a return value that will determine if the
route matches or not. The function receives the current request
as a parameter.

#### Strings

Strings can contain a method, a url, or both.

##### Methods
`"GET"` will match GET requests.

##### URLs
`"/foo"` will match requests that *begin* with `"/foo"`. URLs can
contain named parameters in the same way as the [express router][] and
will populate `req.params`. The current `req.url` will be modified to
remove the matched part of the URL so that nested routers can match on
the remaining unmatched part of the URL. The original full URL is saved
in `req.originalUrl`.

[express router]: https://github.com/expressjs/urlrouter

##### Both
`"POST /bar"` will match POST requests to the exact url `"/bar"`.

#### Objects

 * **path**: The request path must match the given path exactly
 * **mount**: The request path must begin with the given path and will be
   "mounted" under the given path (`req.url` will be adjusted to reflect
   this)
 * **method**: The request method must match the given method

#### Arrays

An array of conditions will be composed into a single condition
and match only if all conditions match.

### HTTP Handlers

HTTP handlers are functions that handle http requests. These are the
same type of functions passed to
`require("http").createServer`.

### Composing HTTP Handlers

The *http-compose* module (**not yet written**) can be used to compose
multiple http handlers into a single handler. A third callback parameter
will be passed to composed functions to allow passing control to the
next handler in the chain.

## API

### `route(condition, handler)`

Creates an http handler function that will only be called if the given
condition matches.

## Installation

```
npm install http-route
```
