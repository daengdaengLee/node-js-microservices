const seneca = require("seneca");
const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

const service = seneca();

service.add("role:upload,image:*,data:*", (msg, next) => {
  const filename = path.join(__dirname, "uploads", msg.image);
  const data = Buffer.from(msg.data, "base64");

  fs.writeFile(filename, data, error => {
    if (error) return next(error);

    next(null, { size: data.length });
  });
});

service.add("role:check,image:*", (msg, next) => {
  const filename = path.join(__dirname, "uploads", msg.image);

  fs.access(filename, fs.constants.R_OK, error => {
    next(null, { exists: !error });
  });
});

service.add("role:download,image:*", (msg, next) => {
  const filename = path.join(__dirname, "uploads", msg.image);

  fs.access(filename, fs.constants.R_OK, error => {
    if (error) return next(error);

    const image = sharp(filename);
    const width = parseFloat(msg.width);
    const height = parseFloat(msg.height);
    const blur = parseFloat(msg.blur);
    const sharpen = parseFloat(msg.sharpen);
    const greyscale = !!msg.greyscale;
    const flip = !!msg.flip;
    const flop = !!msg.flop;

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

    image.toBuffer().then(data => {
      next(null, { data: data.toString("base64") });
    });
  });
});

service.listen(3000);
