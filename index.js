const express = require("express");
const app = express();
const cors = require("cors");
const mongoose = require("mongoose");
const Order = require("./models/order");
const fileUpload = require("express-fileupload");
const http = require("http");
const { Server } = require("socket.io");
const Karaoke = require("./models/karaoke");
const Call = requrie("./models/call.js");
const { google } = require("googleapis");

const apiKeys = require("./api.json");

const SCOPE = ["https://www.googleapis.com/auth/drive"];

const authorize = async () => {
  const jwtClient = new google.auth.JWT(
    apiKeys.client_email,
    null,
    apiKeys.private_key,
    SCOPE
  );
  await jwtClient.authorize();
  return jwtClient;
};

const fileUpload = async (authClient) => {};

require("dotenv").config();
// enable cors
app.use(
  cors({
    origin: "*",
    optionsSuccessStatus: 200,
    credentials: true,
  })
);

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then((res) => {
    res && console.log("database connected");
  });

io.on("connection", (socket) => {
  console.log(`User id: ${socket.id}`);
  socket.on("post_order", async (data) => {
    try {
      await Order.create(data);
      const orders = await Order.find();
      socket.broadcast.emit("get_order", orders);
      io.to(socket.id).emit("get_message", { msg: "success" });
    } catch (error) {
      io.to(socket.id).emit("get_message", { msg: "error" });
    }
  });
  socket.on("post_karaoke", async (data) => {
    try {
      await Karaoke.create(data);
      console.log(data);
      const karaoke = await Karaoke.find();
      socket.broadcast.emit("get_karaoke", karaoke);
      io.to(socket.id).emit("get_message", { msg: "success" });
    } catch (error) {
      io.to(socket.id).emit("get_message", { msg: "error" });
    }
  });
  socket.on("call", async (data) => {
    try {
      await Call.create(data);
      const call = await Call.find();
      socket.broadcast.emit("call-info", call);
      io.to(socket.id).emit("call-response", { msg: "successfully" });
    } catch (error) {
      io.to(socket.id).emit("call-respone", { msg: "error" });
    }
  });
});

mongoose.set("strictQuery", false);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(require("./routers/category"));
app.use(require("./routers/food"));
app.use(require("./routers/dosage"));
app.use(require("./routers/table"));
app.use(require("./routers/order"));
app.use(require("./routers/saveOrders"));
app.use(require("./routers/debt"));
app.use(require("./routers/service"));
app.use(require("./routers/discount"));
app.use(require("./routers/saved"));
app.use(require("./routers/service-dj"));
app.use(require("./routers/music"));
app.use(require("./routers/karaoke"));
app.use(require("./routers/call"));
app.use(fileUpload());

app.use(express.static("public"));
app.get("/", (req, res) => {
  res.send("asdsa");
});

server.listen(process.env.PORT);
