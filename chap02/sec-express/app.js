const express = require("express");
const app = express();
const stack = [];

app.post("/stack", (req, res, next) => {
  let buffer = "";

  req.on("data", data => {
    buffer += data;
  });
  req.on("end", () => {
    stack.push(buffer);
    next();
  });
});

app.delete("/stack", (req, res, next) => {
  stack.pop();
  next();
});

app.get("/stack/:index", (req, res) => {
  if (req.params.index >= 0 && req.params.index < stack.length) {
    res.send("" + stack[req.params.index]);
    return;
  }

  res.status(404).end();
});

app.use("/stack", (req, res) => {
  res.send(stack);
});

app.listen(3000);
