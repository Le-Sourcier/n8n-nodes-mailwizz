const { src, dest } = require("gulp");

function copySvg() {
  return src("./src/nodes/Mailwizz/mailwizz.svg")
    .pipe(dest("./dist/nodes/Mailwizz/"));
}

exports.default = copySvg;
