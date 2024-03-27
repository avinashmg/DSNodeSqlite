const express = require("express");
const app = express();
const port = 5173;
const cors = require("cors");
const db = require("./db");
const fs = require("fs");
const multer = require("multer");
const path = require("path");
const { log } = require("console");
const axios = require("axios").default;
const short = require("short-uuid");

//SCHEMA FOR THE SQLITE DATABASE
createTables = async () => {
  await db.exec(
    `CREATE TABLE IF NOT EXISTS posts(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shortid TEXT,
      post_type TEXT,
      post_text TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
  );

  await db.exec(
    `CREATE TABLE IF NOT EXISTS likes(
    post_id TEXT
    )`
  );
  await db.exec(
    `CREATE TABLE IF NOT EXISTS signals(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT,
    origin TEXT,
    value TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`
  );
};
createTables();

// Create a disk storage with custom file name
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "file/");
  },
  filename: function (req, file, callback) {
    callback(null, file.originalname);
  },
});

const upload = multer({ storage: storage });

app.use(cors());
app.use(express.json());

app.use("/file", express.static("file"));

const address_from_username = async (username) => {
  if (username.indexOf(".")) {
    return `dv.${username}`;
  }
};

const send_to_followers = async (from, value) => {
  const address = await address_from_username(from);
  var options = {
    method: "POST",
    url: `https://${address}/signal/`,
    headers: { Accept: "*/*", "Content-Type": "application/json" },
    data: { type: "new post", value: value, from: from },
  };

  axios
    .request(options)
    .then(function (response) {})
    .catch(function (error) {
      // console.error(error);
    });
};

app.get("/", async (req, res) => {
  let data = await fs.promises.readFile(`profile.json`, "utf8");
  data = JSON.parse(data);
  res.json(data);
});

app.post("/sign_in", async (req, res) => {
  let data = await fs.promises.readFile(`profile.json`, "utf8");
  data = JSON.parse(data);
  if (data.password == req.body.password) {
    res.json({ token: "token" });
  } else {
    res.status(400).send();
  }
});

app.post("/sign_up", async (req, res) => {
  let data = await fs.promises.readFile(`profile.json`, "utf8");
  data = JSON.parse(data);
  if (data.code == req.body.code) {
    const date = new Date();
    const months = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    const days = [
      "1st",
      "2nd",
      "3rd",
      "4th",
      "5th",
      "6th",
      "7th",
      "8th",
      "9th",
      "10th",
      "11th",
      "12th",
      "13th",
      "14th",
      "15th",
      "16th",
      "17th",
      "18th",
      "19th",
      "20th",
      "21st",
      "22nd",
      "23rd",
      "24th",
      "25th",
      "26th",
      "27th",
      "28th",
      "29th",
      "30th",
      "31st",
    ];
    profile = {
      profile: {
        address: req.body.address,
        bio: "Hey, I am now on Deltaverse",
        cover_image: "",
        fullname: req.body.fullname,
        joined: `${days[date.getDate() - 1]} ${
          months[date.getMonth()]
        } ${date.getFullYear()}`,
        location: "Somewhere in the internet",
        name: req.body.fullname,
        profile_image: `/male-placeholder.png`,
        username: req.body.username,
      },
      version: 0,
      auth: "password",
      password: req.body.password,
    };
    fs.promises.writeFile(`profile.json`, JSON.stringify(profile));
    res.json({ token: "token" });
  } else {
    res.status(400).send();
  }
});

app.post("/file_upload", upload.array("files"), async (req, res) => {
  res.status(200).send();
});

app.put("/profile", async (req, res) => {
  let file = await fs.promises.readFile(`profile.json`, "utf8");
  file = JSON.parse(file);
  file.profile = req.body.profile;
  fs.promises.writeFile(`profile.json`, JSON.stringify(file));
  res.status(200).send();
});

app.post("/post", async (req, res) => {
  const id = short.generate();
  const result = await db.run(
    "INSERT INTO posts (post_type , post_text, shortid) VALUES (?, ?, ?)",
    [req.body.post_type, req.body.post_text, id]
  );
  let data = await fs.promises.readFile(`profile.json`, "utf8");
  data = JSON.parse(data);
  send_to_followers(data.profile.username, `${data.profile.username}/p/${id}`);
  res.status(200).json({ success: true });
});

app.get("/posts/", async (req, res) => {
  const result = await db.all("SELECT * FROM posts ORDER BY id DESC");
  res.json(result);
});

app.get("/feeds/", async (req, res) => {
  const result = await db.all(
    "SELECT * FROM signals WHERE type='new post' ORDER BY id DESC"
  );
  res.json(result);
});

app.get("/like/", async (req, res) => {
  const result = await db.all("SELECT * FROM likes WHERE post_id=$1", [
    req.query.id,
  ]);
  if (result.length === 1) {
    res.status(200).send();
  } else {
    res.status(300).send();
  }
});

app.post("/like/", async (req, res) => {
  const post_id = req.body.post;
  const result = await db.run("INSERT INTO likes (post_id) VALUES (?)", [
    post_id,
  ]);
  res.status(200).json({ success: true });
});

app.post("/unlike/", async (req, res) => {
  const post_id = req.body.post;
  const result = await db.run("DELETE FROM likes WHERE post_id=$1", [post_id]);
  res.status(200).json({ success: true });
});

app.get("/p/:id", async (req, res) => {
  const result = await db.all("SELECT * FROM posts WHERE shortid = ?", [
    req.params.id,
  ]);
  res.json(result);
});

app.post("/reply", async (req, res) => {
  let parent = req.body.parent;
  parent = parent.split("/");
  let username;
  for (let i = 0; i < parent.length; i++) {
    if (parent[i] == "u") {
      username = parent[i + 1];
    }
  }
  if (username.indexOf(".") !== -1) {
    //send the comment to the parent
    const address = `https://dv.${username}/signal/`;
  }

  const result = await db.run(
    "INSERT INTO replies (reply_type, reply_text, parent) VALUES (?,?,?)",
    [req.body.reply_type, req.body.reply_text, req.body.parent]
  );
  res.status(200).json({ success: true });
});

app.post("/signal/", async (req, res) => {
  const type = req.body.type;
  switch (type) {
    case "add_reply":
      // Add reply to the reply tree
      const username = req.body.username;
      const reply_id = req.body.reply_id;
      const reply_parent = req.body.reply_parent;
      const replies = 0; //default
      //A transaction that would increment the reply count on the parent, and adds the reply to the table
      break;
    case "new post":
      const from = req.body.from;
      const value = req.body.value;
      const result = await db.run(
        "INSERT INTO signals (type, origin, value) VALUES ('new post', ?, ?)",
        [from, value]
      );
      res.status(200).json({ success: true });
    default:
      break;
  }
});

const [command] = process.argv.slice(2);

const main = async () => {
  if (command == "start") {
    if (!fs.existsSync("profile.json")) {
      const code = Math.floor(Math.random() * 899999 + 100000);
      const data = {
        code: code,
      };
      await fs.promises.writeFile("profile.json", JSON.stringify(data));
      console.clear();
      console.log(
        `-------------------------------------------------------------`
      );
      console.log(
        `------------------- DELTAVERSE SERVER -----------------------`
      );
      console.log(
        `-------------------------------------------------------------`
      );
      console.log(` SECRET CODE IS : ${code}`);
      console.log(`INSTRUCTIONS:`);
      console.log(
        `Go to the Deltaverse client and signup using the secret code`
      );
    }
    app.listen(port, () => {
      console.log(`Instance Started on  port ${port}`);
    });
  }
};

main();
