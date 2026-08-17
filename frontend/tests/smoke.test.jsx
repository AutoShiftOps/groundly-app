// Sanity check for tests/run.mjs itself -- if this fails, the bundler/
// runner plumbing is broken, not the app.
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { check, finish } from "./lib/ssr-assert.mjs";

const html = renderToStaticMarkup(React.createElement("div", null, "hello"));
check("renderToStaticMarkup works and JSX/bundling plumbing is sound", html === "<div>hello</div>");

finish("smoke test");
