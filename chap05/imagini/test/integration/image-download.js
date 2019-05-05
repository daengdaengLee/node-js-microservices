const chai = require("chai");
const http = require("chai-http");

const tools = require("../tools");

chai.use(http);

describe("Download image", () => {
  beforeEach(done => {
    chai
      .request(tools.service)
      .delete("/uploads/test_image_download.png")
      .end(() => {
        chai
          .request(tools.service)
          .post("/uploads/test_image_download.png")
          .set("Content-Type", "image/png")
          .send(tools.sample)
          .end((err, res) => {
            chai.expect(res).to.have.status(200);
            chai.expect(res.body).to.have.status("ok");

            return done();
          });
      });
  });

  it("should return the original image size if no parameters given", done => {
    chai
      .request(tools.service)
      .get("/uploads/test_image_download.png")
      .end((err, res) => {
        chai.expect(res).to.have.status(200);
        chai.expect(res.body).to.have.length(tools.sample.length);

        return done();
      });
  });
});
