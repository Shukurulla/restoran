const express = require("express");
const app = express();
const cors = require("cors");
const mongoose = require("mongoose");
const Order = require("./models/order");
const fileUpload = require("express-fileupload");
const http = require("http");
const { Server } = require("socket.io");
const Karaoke = require("./models/karaoke");
const Call = require("./models/call.js");
const KitchenOrder = require("./models/kitchen-order");
const Waiter = require("./models/waiter");
const SaveOrder = require("./models/checkOrder");

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

// Bo'sh ofitsiyantni topish va tayinlash
async function assignWaiterToOrder(tableId, tableName, tableNumber) {
  try {
    // Faol va online ofitsiyantlarni olish
    const availableWaiters = await Waiter.find({
      isActive: true,
      isOnline: true,
    });

    if (availableWaiters.length === 0) {
      // Agar online ofitsiyant yo'q bo'lsa, faol ofitsiyantlardan birini olish
      const activeWaiters = await Waiter.find({ isActive: true });
      if (activeWaiters.length === 0) return null;

      // Random tanlash
      const randomIndex = Math.floor(Math.random() * activeWaiters.length);
      return activeWaiters[randomIndex];
    }

    // Har bir ofitsiyantning bugungi tayinlangan stollar sonini hisoblash
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const waiterWorkloads = await Promise.all(
      availableWaiters.map(async (waiter) => {
        const activeOrders = await KitchenOrder.countDocuments({
          waiterId: waiter._id,
          createdAt: { $gte: today },
          status: { $in: ["pending", "preparing", "ready"] },
        });
        return { waiter, activeOrders };
      })
    );

    // Eng kam ish yukiga ega ofitsiyantni tanlash
    waiterWorkloads.sort((a, b) => a.activeOrders - b.activeOrders);
    return waiterWorkloads[0].waiter;
  } catch (error) {
    console.error("Ofitsiyant tayinlashda xato:", error);
    return null;
  }
}

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Ofitsiyant ulanishi
  socket.on("waiter_connect", async (waiterId) => {
    try {
      await Waiter.findByIdAndUpdate(waiterId, {
        socketId: socket.id,
        isOnline: true,
      });
      socket.join(`waiter_${waiterId}`);
      console.log(`Waiter ${waiterId} connected`);
    } catch (error) {
      console.error("Waiter connect error:", error);
    }
  });

  // Oshpaz ulanishi
  socket.on("cook_connect", () => {
    socket.join("kitchen");
    console.log("Cook connected to kitchen room");
  });

  // Kassa ulanishi
  socket.on("cashier_connect", () => {
    socket.join("cashier");
    console.log("Cashier connected");
  });

  // Yangi buyurtma (mijozdan)
  socket.on("post_order", async (data) => {
    try {
      const order = await Order.create(data);
      const orders = await Order.find();
      socket.broadcast.emit("get_order", orders);
      io.to(socket.id).emit("get_message", { msg: "success" });

      // Ofitsiyantni tayinlash
      const assignedWaiter = await assignWaiterToOrder(
        data.tableId,
        data.tableName,
        data.tableNumber
      );

      // Kitchen order yaratish
      const items = [];
      if (data.selectFoods && Array.isArray(data.selectFoods)) {
        data.selectFoods.forEach((food) => {
          items.push({
            foodId: food._id || food.id,
            foodName: food.foodName || food.name,
            quantity: food.quantity || food.count || 1,
            price: food.price || 0,
            isReady: false,
          });
        });
      }

      const kitchenOrder = await KitchenOrder.create({
        orderId: order._id,
        tableId: data.tableId,
        tableName: data.tableName,
        tableNumber: data.tableNumber || 0,
        waiterId: assignedWaiter ? assignedWaiter._id : null,
        waiterName: assignedWaiter
          ? `${assignedWaiter.firstName} ${assignedWaiter.lastName}`
          : null,
        items: items,
        status: "pending",
      });

      // Oshpazlarga yangi buyurtma xabari
      const kitchenOrders = await KitchenOrder.find({
        status: { $in: ["pending", "preparing"] },
      })
        .sort({ createdAt: 1 })
        .populate("waiterId");

      io.to("kitchen").emit("new_kitchen_order", {
        order: kitchenOrder,
        allOrders: kitchenOrders,
      });

      // Kassaga xabar
      io.to("cashier").emit("new_kitchen_order", {
        order: kitchenOrder,
      });

      // Ofitsiyantga xabar
      if (assignedWaiter) {
        io.to(`waiter_${assignedWaiter._id}`).emit("new_table_assigned", {
          order: kitchenOrder,
          tableName: data.tableName,
          tableNumber: data.tableNumber,
        });
      }
    } catch (error) {
      console.error("Post order error:", error);
      io.to(socket.id).emit("get_message", { msg: "error" });
    }
  });

  // Oshpaz ovqatni tayyor deb belgilashi
  socket.on("item_ready", async (data) => {
    try {
      const { orderId, itemIndex } = data;
      const order = await KitchenOrder.findById(orderId);

      if (!order) return;

      order.items[itemIndex].isReady = !order.items[itemIndex].isReady;
      order.items[itemIndex].readyAt = order.items[itemIndex].isReady
        ? new Date()
        : null;

      const allReady = order.items.every((item) => item.isReady);
      order.allItemsReady = allReady;

      if (allReady) {
        order.status = "ready";
      } else if (order.items.some((item) => item.isReady)) {
        order.status = "preparing";
      } else {
        order.status = "pending";
      }

      await order.save();

      // Barcha oshpazlarga yangilangan ma'lumot
      const kitchenOrders = await KitchenOrder.find({
        status: { $in: ["pending", "preparing", "ready"] },
      })
        .sort({ createdAt: 1 })
        .populate("waiterId");

      io.to("kitchen").emit("kitchen_orders_updated", kitchenOrders);
      io.to("cashier").emit("kitchen_orders_updated", kitchenOrders);
    } catch (error) {
      console.error("Item ready error:", error);
    }
  });

  // Oshpaz ofitsiyantga xabar yuborishi
  socket.on("notify_waiter", async (data) => {
    try {
      const { orderId } = data;
      const order = await KitchenOrder.findById(orderId);

      if (!order) return;

      order.notifiedWaiter = true;
      order.notifiedAt = new Date();
      await order.save();

      // Ofitsiyantga notification
      if (order.waiterId) {
        io.to(`waiter_${order.waiterId}`).emit("order_ready_notification", {
          order: order,
          message: `${order.tableName} uchun buyurtma tayyor!`,
        });
      }

      // Barcha oshpazlarga yangilangan ma'lumot
      const kitchenOrders = await KitchenOrder.find({
        status: { $in: ["pending", "preparing", "ready"] },
      })
        .sort({ createdAt: 1 })
        .populate("waiterId");

      io.to("kitchen").emit("kitchen_orders_updated", kitchenOrders);
    } catch (error) {
      console.error("Notify waiter error:", error);
    }
  });

  // Ofitsiyant buyurtmani yetkazdi
  socket.on("order_served", async (data) => {
    try {
      const { orderId } = data;
      const order = await KitchenOrder.findById(orderId);

      if (!order) return;

      order.status = "served";
      order.servedAt = new Date();
      await order.save();

      // Barcha oshpazlarga yangilangan ma'lumot
      const kitchenOrders = await KitchenOrder.find({
        status: { $in: ["pending", "preparing", "ready"] },
      })
        .sort({ createdAt: 1 })
        .populate("waiterId");

      io.to("kitchen").emit("kitchen_orders_updated", kitchenOrders);
      io.to("cashier").emit("kitchen_orders_updated", kitchenOrders);

      // Ofitsiyantga tasdiqlash
      io.to(`waiter_${order.waiterId}`).emit("order_served_confirmed", {
        orderId: order._id,
      });
    } catch (error) {
      console.error("Order served error:", error);
    }
  });

  // Kassa to'lov
  socket.on("mark_paid", async (data) => {
    try {
      const { orderId, paymentMethod, debtInfo } = data;
      const order = await KitchenOrder.findById(orderId);

      if (!order) return;

      order.isPaid = true;
      order.paidAt = new Date();
      order.paymentMethod = paymentMethod || "cash";
      if (debtInfo) {
        order.debtInfo = debtInfo;
      }
      await order.save();

      // To'lovni SaveOrder ga ham saqlash (admin panel hisobotlari uchun)
      const totalPrice = order.items.reduce(
        (sum, item) => sum + (item.price * item.quantity),
        0
      );

      // To'lov turini aniqlash
      let paymentStatus = "Naqt toladi";
      if (paymentMethod === "card") {
        paymentStatus = "Plastik Karta";
      } else if (paymentMethod === "debt") {
        paymentStatus = "Qarz";
      }

      await SaveOrder.create({
        order: {
          tableName: order.tableName,
          tableNumber: order.tableNumber,
          totalPrice: totalPrice,
          orderedAt: order.createdAt,
          items: order.items,
        },
        clientName: debtInfo?.customerName || "",
        clientPhone: debtInfo?.customerPhone || "",
        assurance: debtInfo?.depositItem || "",
        status: paymentStatus,
        ofitsiantPrice: 0,
        similarOrder: {
          items: order.items,
        },
      });

      // Kassaga xabar
      io.to("cashier").emit("order_paid_success", {
        orderId: order._id,
        tableName: order.tableName,
      });

      // Barcha oshpazlarga yangilangan ma'lumot
      const kitchenOrders = await KitchenOrder.find({
        status: { $in: ["pending", "preparing", "ready"] },
      })
        .sort({ createdAt: 1 })
        .populate("waiterId");

      io.to("kitchen").emit("kitchen_orders_updated", kitchenOrders);
    } catch (error) {
      console.error("Mark paid error:", error);
    }
  });

  // Karaoke
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

  // Call
  socket.on("call", async (data) => {
    try {
      await Call.create(data);
      const call = await Call.find();
      socket.broadcast.emit("call-info", call);
      io.to(socket.id).emit("call-response", { msg: "successfully" });
    } catch (error) {
      io.to(socket.id).emit("call-response", { msg: "error" });
    }
  });

  // Disconnect
  socket.on("disconnect", async () => {
    try {
      // Ofitsiyantni offline qilish
      await Waiter.findOneAndUpdate(
        { socketId: socket.id },
        { isOnline: false, socketId: null }
      );
      console.log(`User disconnected: ${socket.id}`);
    } catch (error) {
      console.error("Disconnect error:", error);
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
app.use(require("./routers/waiter"));
app.use(require("./routers/kitchen-order"));
app.use(fileUpload());

app.use(express.static("public"));
app.get("/", (req, res) => {
  res.send("asdsa");
});

server.listen(process.env.PORT, () => {
  console.log(`Server is running on port ${process.env.PORT}`);
});
