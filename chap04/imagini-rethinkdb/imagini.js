const express = require('express');
const path = require('path');
const bodyparser = require('body-parser');
const sharp = require('sharp');
const rethinkdb = require('rethinkdb');

const settings = require('./settings');

const app = express();

rethinkdb.connect(settings.db, (error, db) => {
  if (error) throw error;

  console.log('db:ready');

  rethinkdb.tableList().run(db, (error, tables) => {
    if (error) throw error;

    if (!tables.includes('images')) {
      rethinkdb.tableCreate('images').run(db);
    }
  });

  app.param('image', (req, res, next, image) => {
    if (!image.match(/\.(png|jpg)$/i)) {
      return res.status(403).end();
    }

    return rethinkdb
      .table('images')
      .filter({ name: image })
      .limit(1)
      .run(db, (error, images) => {
        if (error) return res.status(404).end();

        return images.toArray((error, images) => {
          if (error) return res.status(500).end();
          if (!images.length) return res.status(404).end();

          req.image = images[0];

          return next();
        });
      });
  });

  app.head('/uploads/:image', (req, res) => res.status(200).end());

  app.post('/uploads/:name', bodyparser.raw({ limit: '10mb', type: 'image/*' }), (req, res) => {
    rethinkdb
      .table('images')
      .insert({
        name: req.params.name,
        size: req.body.length,
        data: req.body,
      })
      .run(db, (error) => {
        if (error) return res.send({ status: 'error', code: error.code });

        return res.send({ status: 'ok', size: req.body.length });
      });
  });

  app.get('/uploads/:image', (req, res) => {
    const image = sharp(req.image.data);
    const width = parseFloat(req.query.width);
    const height = parseFloat(req.query.height);
    const blur = parseFloat(req.query.blur);
    const sharpen = parseFloat(req.query.sharpen);
    const YES_FLAGS = new Set(['y', 'yes', '1', 'on']);
    const greyscale = YES_FLAGS.has(req.query.greyscale);
    const flip = YES_FLAGS.has(req.query.flip);
    const flop = YES_FLAGS.has(req.query.flop);

    if (width > 0 || height > 0) {
      image.resize(
        width || null,
        height || null,
        width > 0 && height > 0 ? { fit: 'fill' } : undefined,
      );
    }

    if (flip) image.flip();
    if (flop) image.flop();
    if (blur > 0) image.blur(blur);
    if (sharpen > 0) image.sharpen(sharpen);
    if (greyscale) image.greyscale();

    rethinkdb
      .table('images')
      .get(req.image.id)
      .update({ date_used: Date.now() })
      .run(db);

    res.setHeader('Content-Type', `image/${path.extname(req.image.name).substr(1)}`);

    image.pipe(res);
  });

  app.delete('/uploads/:image', (req, res) => {
    rethinkdb
      .table('images')
      .get(req.image.id)
      .delete()
      .run(db, error => res.status(error ? 500 : 200).end());
  });

  app.get('/stats', (req, res) => {
    const uptime = process.uptime();

    rethinkdb
      .table('images')
      .count()
      .run(db, (error, total) => {
        if (error) return res.status(500).end();

        return rethinkdb
          .table('images')
          .sum('size')
          .run(db, (error, size) => {
            if (error) return res.status(500).end();

            return res.send({
              total,
              size,
              uptime,
            });
          });
      });
  });

  app.listen(3000, () => {
    console.log('ready');
  });
});
