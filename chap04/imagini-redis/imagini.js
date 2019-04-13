const express = require("express");
const path = require("path");
const bodyparser = require("body-parser");
const sharp = require("sharp");
const redis = require("redis");

const app = express();
const db = redis.createClient();

db.on("connect", () => {
  console.log("db:ready");

  app.param("image", (req, res, next, name) => {
    if (!name.match(/\.(png|jpg)$/i)) {
      return res.status(403).end();
    }

    return db.hgetall(name, (error, image) => {
      if (error || !image) return res.status(404).end();

      req.image = image;
      req.image.name = name;

      next();
    });
  });

  app.head("/uploads/:image", (req, res) => res.status(200).end());

  app.post(
    "/uploads/:name",
    bodyparser.raw({ limit: "10mb", type: "image/*" }),
    (req, res) => {
      db.hmset(
        req.params.name,
        {
          size: req.body.length,
          data: req.body.toString("base64")
        },
        error => {
          if (error) return res.send({ status: "error", code: error.code });

          return res.send({ status: "ok", size: req.body.length });
        }
      );
    }
  );

  app.get("/uploads/:image", (req, res) => {
    const image = sharp(Buffer.from(req.image.data, "base64"));
    const width = parseFloat(req.query.width);
    const height = parseFloat(req.query.height);
    const blur = parseFloat(req.query.blur);
    const sharpen = parseFloat(req.query.sharpen);
    const YES_FLAGS = new Set(["y", "yes", "1", "on"]);
    const greyscale = YES_FLAGS.has(req.query.greyscale);
    const flip = YES_FLAGS.has(req.query.flip);
    const flop = YES_FLAGS.has(req.query.flop);

    if (width > 0 || height > 0) {
      image.resize(
        width || null,
        height || null,
        width > 0 && height > 0 ? { fit: "fill" } : undefined
      );
    }

    if (flip) image.flip();
    if (flop) image.flop();
    if (blur > 0) image.blur(blur);
    if (sharpen > 0) image.sharpen(sharpen);
    if (greyscale) image.greyscale();

    db.hset(req.image.name, "date_used", Date.now());

    res.setHeader(
      "Content-Type",
      `image/${path.extname(req.image.name).substr(1)}`
    );

    image.pipe(res);
  });

  app.delete("/uploads/:image", (req, res) => {
    db.del(req.image.name, error => res.status(error ? 500 : 200).end());
  });

  app.listen(3000, () => {
    console.log("ready");
  });
});
