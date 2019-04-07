const express = require("express");
const path = require("path");
const fs = require("fs");
const bodyparser = require("body-parser");
const sharp = require("sharp");
const app = express();

app.param("image", (req, res, next, image) => {
  if (!image.match(/\.(png|jpg)$/i)) {
    return res.status(req.method === "POST" ? 403 : 404).end();
  }

  req.image = image;
  req.localpath = path.join(__dirname, "uploads", image);

  return next();
});

app.param("width", (req, res, next, width) => {
  req.width = parseFloat(width);

  return next();
});

app.param("height", (req, res, next, height) => {
  req.height = parseFloat(height);

  return next();
});

app.param("greyscale", (req, res, next, greyscale) => {
  if (greyscale !== "bw") return next("route");

  req.greyscale = true;
  return next();
});

app.head("/uploads/:image", (req, res) => {
  fs.access(req.localpath, fs.constants.R_OK, err => {
    res.status(err ? 404 : 200).end();
  });
});

app.post(
  "/uploads/:image",
  bodyparser.raw({ limit: "10mb", type: "image/*" }),
  (req, res) => {
    const fd = fs.createWriteStream(req.localpath, {
      flags: "w+",
      encoding: "binary"
    });

    fd.end(req.body);

    fd.on("close", () => {
      res.send({ status: "ok", size: req.body.length });
    });
  }
);

app.get(
  "/uploads/:width(\\d+)x:height(\\d+)-:greyscale-:image",
  download_image
);

app.get("/uploads/:width(\\d+)x:height(\\d+)-:image", download_image);

app.get("/uploads/_x:height(\\d+)-:greyscale-:image", download_image);

app.get("/uploads/_x:height(\\d+)-:image", download_image);

app.get("/uploads/:width(\\d+)x_-:greyscale-:image", download_image);

app.get("/uploads/:width(\\d+)x_-:image", download_image);

app.get("/uploads/:greyscale-:image", download_image);

app.get("/uploads/:image", download_image);

app.listen(3000, () => {
  console.log("ready");
});

function download_image(req, res) {
  fs.access(req.localpath, fs.constants.R_OK, error => {
    if (error) return res.status(404).end();

    const image = sharp(req.localpath);

    if (req.width || req.height) {
      image.resize(
        req.width,
        req.height,
        req.width && req.height ? { fit: "fill" } : undefined
      );
    }

    if (req.greyscale) {
      image.greyscale();
    }

    res.setHeader("Content-Type", `image/${path.extname(req.image).substr(1)}`);

    image.pipe(res);
  });
}
