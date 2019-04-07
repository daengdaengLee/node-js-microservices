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

app.get("/uploads/:image", (req, res) => {
  const fd = fs.createReadStream(req.localpath);

  fd.on("error", error => {
    res.status(error.code === "ENOENT" ? 404 : 500).end();
  });

  res.setHeader("Content-Type", `image/${path.extname(req.image).substr(1)}`);

  fd.pipe(res);
});

app.get(/\/thumbnail\.(jpg|png)/, (req, res, next) => {
  const format = req.params[0] === "png" ? "png" : "jpeg";
  const width = parseFloat(req.query.width) || 300;
  const height = parseFloat(req.query.height) || 200;
  const border = parseFloat(req.query.border) || 5;
  const bgcolor = req.query.bgcolor || "#fcfcfc";
  const fgcolor = req.query.fgcolor || "#dddddd";
  const textcolor = req.query.textcolor || "#aaaaaa";
  const textsize = parseFloat(req.query.textsize) || 24;
  const image = sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 0, g: 0, b: 0 }
    }
  });

  const thumbnail = Buffer.from(
    `
<svg width="${width}" height="${height}">
  <rect
    x="0"
    y="0"
    width="${width}"
    height="${height}"
    fill="${fgcolor}"
  />
  <rect
    x="${border}"
    y="${border}"
    width="${width - border * 2}"
    height="${height - border * 2}"
    fill="${bgcolor}"
  />
  <line
    x1="${border * 2}"
    y1="${border * 2}"
    x2="${width - border * 2}"
    y2="${height - border * 2}"
    stroke-width="${border}"
    stroke="${fgcolor}"
  />
  <line
    x1="${width - border * 2}"
    y1="${border * 2}"
    x2="${border * 2}"
    y2="${height - border * 2}"
    stroke-width="${border}"
    stroke="${fgcolor}"
  />
  <rect
    x="${border}"
    y="${(height - textsize) / 2}"
    width="${width - border * 2}"
    height="${textsize}"
    fill="${bgcolor}"
  />
  <text
    x="${width / 2}"
    y="${height / 2}"
    dy="8"
    font-family="Helvetica"
    font-size="${textsize}"
    fill="${textcolor}"
    text-anchor="middle"
  >
    ${width} x ${height}
  </text>
</svg>
`
  );

  image
    .overlayWith(thumbnail)
    [format]() // eslint-disable-line
    .pipe(res);
});

app.listen(3000, () => {
  console.log("ready");
});
