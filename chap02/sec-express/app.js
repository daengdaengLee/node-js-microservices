const express = require("express");
const body = require("body-parser");
const route = express.Router();
const app = express();
const stack = [];

app.use(body.text({ type: "*/*" }));

route.post("/", (req, res, next) => {
  stack.push(req.body);

  next();
});

route.delete("/", (req, res, next) => {
  stack.pop();

  next();
});

route.get("/:index", (req, res) => {
  if (req.params.index >= 0 && req.params.index < stack.length) {
    res.send("" + stack[req.params.index]);
    return;
  }

  res.status(404).end();
});

route.use((req, res) => {
  res.send(stack);
});

app.use("/stack", route);
app.listen(3000);
