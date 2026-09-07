#!/usr/bin/env node
"use strict";

var audio = require("../js/novel-audio.js");
var fails = 0;

function assert(cond, msg) {
  if (!cond) {
    fails += 1;
    console.error("FAIL " + msg);
  } else {
    console.log("ok   " + msg);
  }
}

var q = audio.parseQueue(
  '[{"n":1,"title":"A","url":"/novel/x/01/","src":"/audio/x/01.mp3"},{"n":2,"title":"B","url":"/novel/x/02/","src":"/audio/x/02.mp3"}]'
);
assert(q.length === 2, "parseQueue length");
assert(audio.findIndex(q, 2) === 1, "findIndex 2");
assert(audio.findIndex(q, 9) === -1, "findIndex miss");
assert(audio.nextIndex(0, 2, true) === 1, "next from first");
assert(audio.nextIndex(1, 2, true) === -1, "next at end stops");
assert(audio.nextIndex(0, 2, false) === -1, "autonext off does not advance");
assert(audio.prevIndex(1) === 0, "prev from second");
assert(audio.prevIndex(0) === -1, "prev at start stops");
assert(audio.pathOf("/novel/x/02/", "https://hoang.tech") === "/novel/x/02", "path strip slash");
assert(audio.parseQueue("nope").length === 0, "bad json is empty");
assert(audio.parseQueue("").length === 0, "empty raw is empty");

if (fails) {
  console.error(fails + " failed");
  process.exit(1);
}
console.log("all passed");
