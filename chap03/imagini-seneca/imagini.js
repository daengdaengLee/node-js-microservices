const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

module.exports = function(settings = { path: "uploads" }) {
  const localpath = image => path.join(settings.path, image);

  const access = (filename, next) =>
    fs.access(filename, fs.constants.R_OK, error => next(!error, filename));

  this.add("role:check,image:*", (msg, next) => {
    access(localpath(msg.image), exists => next(null, { exists }));
  });

  this.add("role:upload,image:*,data:*", (msg, next) => {
    const data = Buffer.from(msg.data, "base64");

    fs.writeFile(localpath(msg.image), data, error =>
      next(error, { size: data.length })
    );
  });

  this.add("role:download,image:*", (msg, next) => {
    access(localpath(msg.image), (exists, filename) => {
      if (!exists) return next(new Error("image not found"));

      const image = sharp(filename);
      const width = Math.max(parseFloat(msg.width), 0) || null;
      const height = Math.max(parseFloat(msg.height), 0) || null;

      if (width || height)
        image.resize(
          width,
          height,
          width && height ? { fit: "fill" } : undefined
        );
      if (msg.flip) image.flip();
      if (msg.flop) image.flop();
      if (msg.blur > 0) image.blur(msg.blur);
      if (msg.sharpen > 0) image.sharpen(msg.sharpen);
      if (msg.greyscale) image.greyscale();

      image.toBuffer().then(data => {
        next(null, { data: data.toString("base64") });
      });
    });
  });
};
