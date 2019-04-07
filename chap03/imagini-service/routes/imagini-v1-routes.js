/**
 * @name imagini-v1-api
 * @description This module packages the Imagini API.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const bodyparser = require("body-parser");
const hydraExpress = require("hydra-express");
const ServerResponse = require("fwsp-server-response");

const hydra = hydraExpress.getHydra();
const express = hydraExpress.getExpress();

let serverResponse = new ServerResponse();

express.response.sendError = function(err) {
  serverResponse.sendServerError(this, { result: { error: err } });
};
express.response.sendOk = function(result) {
  serverResponse.sendOk(this, { result });
};

let api = express.Router();

api.param("image", (req, res, next, image) => {
  if (!image.match(/\.(png|jpg)$/i))
    return res.sendError("invalid image type/extension");

  req.image = image;
  req.localpath = path.join(__dirname, "../uploads", req.image);

  next();
});

api.head("/:image", (req, res) => {
  fs.access(req.localpath, fs.constants.R_OK, error => {
    if (error) return res.sendError("image not found");

    res.sendOk();
  });
});

api.post(
  "/:image",
  bodyparser.raw({ limit: "10mb", type: "image/*" }),
  (req, res) => {
    const fd = fs.createWriteStream(req.localpath, {
      flags: "w+",
      encoding: "binary"
    });

    fd.end(req.body);

    fd.on("close", () => res.sendOk({ size: req.body.length }));
  }
);

api.get("/:image", (req, res) => {
  fs.access(req.localpath, fs.constants.R_OK, error => {
    if (error) return res.sendError("image not found");

    const image = sharp(req.localpath);
    const width = parseFloat(req.query.width);
    const height = parseFloat(req.query.height);
    const blur = parseFloat(req.query.blur);
    const sharpen = parseFloat(req.query.sharpen);
    const greyscale = ["y", "yes", "1", "on"].includes(req.query.greyscale);
    const flip = ["y", "yes", "1", "on"].includes(req.query.flip);
    const flop = ["y", "yes", "1", "on"].includes(req.query.flop);

    if (width > 0 || height > 0)
      image.resize(
        width || null,
        height || null,
        width > 0 && height > 0 ? { fit: "fill" } : undefined
      );

    if (flip) image.flip();
    if (flop) image.flop();
    if (blur > 0) image.blur(blur);
    if (sharpen > 0) image.sharpen(sharpen);
    if (greyscale) image.greyscale();

    res.setHeader("Content-Type", `image/${path.extname(req.image).substr(1)}`);

    image.pipe(res);
  });
});

module.exports = api;
