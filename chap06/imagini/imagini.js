const express = require("express");
const path = require("path");
const bodyparser = require("body-parser");
const sharp = require("sharp");
const mysql = require("mysql");

const settings = require("./settings");

const app = express();
const db = mysql.createConnection(settings.db);

app.db = db;

db.connect(error => {
  if (error) throw error;

  console.log("db:ready");

  db.query(`
    CREATE TABLE IF NOT EXISTS images
    (
      id INT(11) UNSIGNED NOT NULL AUTO_INCREMENT,
      date_created TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      date_used TIMESTAMP NULL DEFAULT NULL,
      name VARCHAR(300) NOT NULL,
      size INT(11) UNSIGNED NOT NULL,
      data LONGBLOB NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY name (name)
    )
    ENGINE=InnoDB DEFAULT CHARSET=utf8
  `);

  setInterval(() => {
    db.query(`
      DELETE FROM images
      WHERE (date_created < UTC_TIMESTAMP - INTERVAL 1 WEEK AND date_used IS NULL)
      OR (date_used < UTC_TIMESTAMP - INTERVAL 1 MONTH)
    `);
  }, 3600 * 1000);

  app.param("image", (req, res, next, image) => {
    if (!image.match(/\.(png|jpg)$/i)) {
      return res.status(403).end();
    }

    db.query(
      "SELECT * FROM images WHERE name = ?",
      [image],
      (error, images) => {
        if (error || !images.length) return res.status(404).end();

        req.image = images[0];

        return next();
      }
    );
  });

  app.head("/uploads/:image", (req, res) => {
    return res.status(200).end();
  });

  app.post(
    "/uploads/:name",
    bodyparser.raw({ limit: "10mb", type: "image/*" }),
    (req, res) => {
      db.query(
        "INSERT INTO images SET ?",
        {
          name: req.params.name,
          size: req.body.length,
          data: req.body
        },
        error => {
          if (error) return res.send({ status: "error", code: error.code });

          res.send({ status: "ok", size: req.body.length });
        }
      );
    }
  );

  app.get("/uploads/:image", (req, res) => {
    if (Object.keys(req.query).length === 0) {
      db.query(
        `
        UPDATE images
        SET date_used = UTC_TIMESTAMP
        WHERE id = ? 
      `,
        [req.image.id]
      );
      res.setHeader(
        "Content-Type",
        `image/${path.extname(req.image.name).substr(1)}`
      );
      return res.end(req.image.data);
    }

    const image = sharp(req.image.data);
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

    db.query(
      `
      UPDATE images
      SET date_used = UTC_TIMESTAMP
      WHERE id = ?
    `,
      [req.image.id]
    );

    res.setHeader(
      "Content-Type",
      `image/${path.extname(req.image.name).substr(1)}`
    );

    image.pipe(res);
  });

  app.delete("/uploads/:image", (req, res) => {
    db.query("DELETE FROM images WHERE id = ?", [req.image.id], error => {
      return res.status(error ? 500 : 200).end();
    });
  });

  app.get("/stats", (req, res) => {
    db.query(
      `
      SELECT COUNT(*) total
      , SUM(size) size
      , MAX(date_created) last_created
      FROM images
    `,
      (error, rows) => {
        if (error) return res.status(500).end();

        rows[0].uptime = process.uptime();

        return res.send(rows[0]);
      }
    );
  });

  app.listen(3000, () => {
    console.log("ready");
  });

  process.on("SIGTERM", () => {
    db.end(() => process.exit(0));
  });
});

module.exports = app;
