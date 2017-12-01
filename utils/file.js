const fs = require("fs")
const rimraf = require("rimraf")
const crypto = require("crypto")

// fs related code, used in some placess across the app

module.exports.hashFile = path => {
  return new Promise((resolve, reject) => {
    var shasum = crypto.createHash("sha256")
    var s = fs.ReadStream(path)
    s.on("data", d => { shasum.update(d) })
    s.on("end", () => {
      resolve(shasum.digest("hex"))
    })
  })
}

// requires FlieAPI and a compatible browser
module.exports.readBlob = file => {
  return new Promise((resolve, reject) => {
    var bb = new Blob(file)
    var f = new FileReader()
    f.onload = e => {
      resolve(e.target.result)
    }
    f.readAsText(bb)
  })
}

module.exports.readSync = path => {
  return fs.readFileSync(path)
}

module.exports.rmrf = folder => {
  rimraf(folder, () => {
    
  })
}
