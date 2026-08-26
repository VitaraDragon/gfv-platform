#!/usr/bin/env node
"use strict";

/** Copia catalogo/policy/dispatch-core ESM in functions/lib per il deploy. */

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "../..");
const dest = path.join(__dirname, "../lib");
fs.mkdirSync(dest, { recursive: true });

function copyRewritten(fromRel, toName) {
  const src = path.join(root, fromRel);
  let text = fs.readFileSync(src, "utf8");
  text = text.replace("from '../config/notification-catalog.js'", "from './notification-catalog.js'");
  text = text.replace("from './notification-policy.js'", "from './notification-policy.js'");
  fs.writeFileSync(path.join(dest, toName), text);
  console.log("synced", toName);
}

copyRewritten("core/config/notification-catalog.js", "notification-catalog.js");
copyRewritten("core/services/notification-policy.js", "notification-policy.js");
copyRewritten("core/services/notification-dispatch-core.js", "notification-dispatch-core.js");
