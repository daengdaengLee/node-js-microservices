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

app.get("/uploads/:image", download_image);

app.listen(3000, () => {
  console.log("ready");
});

function download_image(req, res) {
  fs.access(req.localpath, fs.constants.R_OK, error => {
    if (error) return res.status(404).end();

    const image = sharp(req.localpath);
    const width = parseFloat(req.query.width);
    const height = parseFloat(req.query.height);
    const greyscale = ["y", "yes", "1", "on"].includes(req.query.greyscale);

    if (width > 0 || height > 0) {
      image.resize(
        width || null,
        height || null,
        width > 0 && height > 0 ? { fit: "fill" } : undefined
      );
    }

    if (greyscale) {
      image.greyscale();
    }

    res.setHeader("Content-Type", `image/${path.extname(req.image).substr(1)}`);

    image.pipe(res);
  });
}
