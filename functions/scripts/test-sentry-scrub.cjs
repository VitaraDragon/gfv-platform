#!/usr/bin/env node
"use strict";

const assert = require("assert");
const { scrubEvent } = require("../instrument");

const FAKE_JWT = "eyJhbGciOiJub25lIn0.eyJzdWIiOiJ0ZXN0In0.signature";
const FAKE_EMAIL = "mario.rossi@example.com";

const event = {
  request: {
    url: "https://api.example.com/v1/utenti?email=a@b.it&password=x",
    query_string: "email=a@b.it&password=x",
    cookies: "session=abc",
    data: "{\"password\":\"x\"}",
    headers: {
      Authorization: "Bearer secret",
      cookie: "session=abc",
      "Content-Type": "application/json",
      "User-Agent": "scrub-test",
      "x-cloud-trace-context": "trace/1;o=1",
      "x-firebase-appcheck": "appcheck-token",
      "x-forwarded-for": "203.0.113.8",
    },
  },
  user: {
    id: "uid-agricoltore-1",
    email: "a@b.it",
    ip_address: "203.0.113.8",
    username: "mario",
  },
  extra: {
    payload: {
      idToken: "non-deve-uscire",
      note: "visibile",
    },
  },
  contexts: {
    profilo: {
      telefono: "+3900000000",
      zona: "nord",
    },
  },
  tags: {
    api_key: "non-deve-uscire",
    modulo: "conto-terzi",
  },
  message:
    "Errore per " + FAKE_EMAIL + " jwt " + FAKE_JWT + " su https://example.com/cb?token=abc",
  transaction: "POST https://example.com/save?email=a@b.it",
  exception: {
    values: [
      {
        type: "Error",
        value: "fallito " + FAKE_EMAIL + " " + FAKE_JWT,
      },
    ],
  },
};

const out = scrubEvent(event);

assert.strictEqual(out.request.url, "https://api.example.com/v1/utenti");
assert.strictEqual(Object.prototype.hasOwnProperty.call(out.request, "query_string"), false);
assert.strictEqual(Object.prototype.hasOwnProperty.call(out.request, "cookies"), false);
assert.strictEqual(Object.prototype.hasOwnProperty.call(out.request, "data"), false);
assert.strictEqual(out.request.headers.Authorization, undefined);
assert.strictEqual(out.request.headers.cookie, undefined);
assert.strictEqual(out.request.headers["x-firebase-appcheck"], undefined);
assert.strictEqual(out.request.headers["x-forwarded-for"], undefined);
assert.strictEqual(out.request.headers["Content-Type"], "application/json");
assert.strictEqual(out.request.headers["User-Agent"], "scrub-test");
assert.strictEqual(out.request.headers["x-cloud-trace-context"], "trace/1;o=1");

assert.strictEqual(out.user.id, "uid-agricoltore-1");
assert.strictEqual(out.user.email, undefined);
assert.strictEqual(out.user.ip_address, undefined);
assert.strictEqual(out.user.username, undefined);

assert.strictEqual(out.extra.payload.idToken, "[Filtered]");
assert.strictEqual(out.extra.payload.note, "visibile");
assert.strictEqual(out.contexts.profilo.telefono, "[Filtered]");
assert.strictEqual(out.contexts.profilo.zona, "nord");
assert.strictEqual(out.tags.api_key, "[Filtered]");
assert.strictEqual(out.tags.modulo, "conto-terzi");

assert.strictEqual(out.message.includes(FAKE_EMAIL), false);
assert.strictEqual(out.message.includes(FAKE_JWT), false);
assert.strictEqual(out.message.includes("?token="), false);
assert.strictEqual(out.message.includes("[email]"), true);
assert.strictEqual(out.message.includes("[Filtered]"), true);
assert.strictEqual(out.message.includes("https://example.com/cb"), true);

assert.strictEqual(out.transaction.includes("?"), false);
assert.strictEqual(out.transaction.includes("[email]"), false);
assert.strictEqual(out.exception.values[0].value.includes(FAKE_EMAIL), false);
assert.strictEqual(out.exception.values[0].value.includes(FAKE_JWT), false);
assert.strictEqual(out.exception.values[0].value.includes("[email]"), true);
assert.strictEqual(out.exception.values[0].value.includes("[Filtered]"), true);

const keys = scrubEvent({
  message: "chiave sk_test_fakeKey123 e AIzaSyFakeKeyForTestOnly123456",
});
assert.strictEqual(keys.message.includes("sk_test_"), false);
assert.strictEqual(keys.message.includes("AIza"), false);
assert.strictEqual(keys.message.includes("[Filtered]"), true);

const malformed = scrubEvent({ request: null, user: null, message: "ancora integro" });
assert.strictEqual(malformed.request, null);
assert.strictEqual(malformed.user, null);
assert.strictEqual(malformed.message, "ancora integro");

assert.strictEqual(scrubEvent(null), null);

console.log("OK");
