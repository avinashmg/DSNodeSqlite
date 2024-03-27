const sqlite3 = require("sqlite3").verbose();
const aaSqlite3 = require("aa-sqlite3");

let db = aaSqlite3(
  new sqlite3.Database("./db/db.db", (err) => {
    if (err) {
      console.error(err.message);
    }
    console.log("Connected to the db database.");
  })
);

module.exports = db;
