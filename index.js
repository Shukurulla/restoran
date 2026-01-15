const express = require("express");
const app = express();
const cors = require("cors");
const mongoose = require("mongoose");
const fileUpload = require("express-fileupload");
const http = require("http");
const { Server } = require("socket.io");

// Models
const Order = require("./models/order");
const KitchenOrder = require("./models/kitchen-order");
const Staff = require("./models/staff");
const SaveOrder = require("./models/checkOrder");
const Call = require("./models/call.js");
const Restaurant = require("./models/restaurant");
const Table = require("./models/table");
const QRSession = require("./models/qr-session");

require("dotenv").config();

// CORS
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

// Default super admin yaratish
const createDefaultSuperAdmin = require("./seeds/super-admin.seed");

// Demo restoran yaratish va reset
const { createDemoRestaurant, resetDemoData } = require("./seeds/demo-restaurant.seed");

// MongoDB ulanish
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(async () => {
    console.log("Database connected");
    // Default super admin yaratish
    await createDefaultSuperAdmin();

    // Demo restoran yaratish (agar yo'q bo'lsa)
    try {
      await createDemoRestaurant();
      console.log("Demo restoran tayyor!");

      // Har 1 soatda demo ma'lumotlarni reset qilish
      setInterval(async () => {
        await resetDemoData();
      }, 60 * 60 * 1000); // 1 soat = 60 daqiqa * 60 sekund * 1000 millisekund

    } catch (error) {
      console.error("Demo restoran yaratishda xato:", error);
    }
  })
  .catch((err) => {
    console.error("Database connection error:", err);
  });

mongoose.set("strictQuery", false);

// Bo'sh ofitsiyantni topish va tayinlash (multi-tenant)
async function assignWaiterToOrder(restaurantId, tableId) {
  try {
    // Shu restoranning faol va online ofitsiyantlarini olish
    const availableWaiters = await Staff.find({
      restaurantId,
      role: "waiter",
      status: "working",
      isOnline: true,
    });

    if (availableWaiters.length === 0) {
      // Agar online ofitsiyant yo'q bo'lsa, faol ofitsiyantlardan birini olish
      const activeWaiters = await Staff.find({
        restaurantId,
        role: "waiter",
        status: "working",
      });
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
          restaurantId,
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

// Socket.io
io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Xodim ulanishi (waiter, cook, cashier)
  socket.on("staff_connect", async (data) => {
    try {
      const { staffId, restaurantId, role } = data;

      await Staff.findByIdAndUpdate(staffId, {
        socketId: socket.id,
        isOnline: true,
      });

      // Restoranga tegishli xonaga qo'shish
      socket.join(`restaurant_${restaurantId}`);

      if (role === "waiter") {
        socket.join(`waiter_${staffId}`);
        console.log(
          `Waiter ${staffId} connected to restaurant ${restaurantId}`
        );
      } else if (role === "cook") {
        socket.join(`kitchen_${restaurantId}`);
        console.log(`Cook connected to restaurant ${restaurantId}`);
      } else if (role === "cashier") {
        socket.join(`cashier_${restaurantId}`);
        console.log(`Cashier connected to restaurant ${restaurantId}`);
      }
    } catch (error) {
      console.error("Staff connect error:", error);
    }
  });

  // Legacy support - eski panellar uchun
  socket.on("waiter_connect", async (waiterId) => {
    try {
      const waiter = await Staff.findByIdAndUpdate(
        waiterId,
        { socketId: socket.id, isOnline: true },
        { new: true }
      );
      if (waiter) {
        socket.join(`waiter_${waiterId}`);
        socket.join(`restaurant_${waiter.restaurantId}`);
      }
    } catch (error) {
      console.error("Waiter connect error:", error);
    }
  });

  socket.on("cook_connect", (restaurantId) => {
    socket.join(`kitchen_${restaurantId || "default"}`);
    socket.join("kitchen"); // Legacy support
  });

  socket.on("cashier_connect", (restaurantId) => {
    socket.join(`cashier_${restaurantId || "default"}`);
    socket.join("cashier"); // Legacy support
  });

  // Yangi buyurtma (mijozdan) - ORDER MERGING bilan
  socket.on("post_order", async (data) => {
    try {
      console.log("Received order data:", JSON.stringify(data, null, 2));

      const {
        restaurantId,
        tableId,
        tableName,
        tableNumber,
        selectFoods,
        sessionId,
      } = data;

      // Validatsiya
      if (!restaurantId) {
        console.error("Order error: restaurantId is missing");
        socket.emit("get_message", { msg: "error", error: "Restaurant ID topilmadi" });
        return;
      }

      if (!tableId) {
        console.error("Order error: tableId is missing");
        socket.emit("get_message", { msg: "error", error: "Stol tanlanmagan" });
        return;
      }

      if (!selectFoods || selectFoods.length === 0) {
        console.error("Order error: selectFoods is empty");
        socket.emit("get_message", { msg: "error", error: "Buyurtma bo'sh" });
        return;
      }

      // SessionId ni token orqali topish
      let sessionObjectId = null;
      if (sessionId) {
        const session = await QRSession.findOne({ sessionToken: sessionId });
        if (session) {
          sessionObjectId = session._id;
        }
      }

      // Stol uchun mavjud ochiq orderni tekshirish (Order Merging)
      let existingOrder = await Order.findOne({
        restaurantId,
        tableId,
        status: { $nin: ["paid", "cancelled"] },
      });

      let order;
      let kitchenOrder;
      let isNewOrder = false;

      // Yangi itemlarni tayyorlash
      const newItems = [];
      if (selectFoods && Array.isArray(selectFoods)) {
        selectFoods.forEach((food) => {
          newItems.push({
            foodId: food._id || food.id,
            foodName: food.foodName || food.name,
            quantity: food.quantity || food.count || 1,
            price: food.price || 0,
            isReady: false,
          });
        });
      }

      if (existingOrder) {
        // Mavjud orderga qo'shish
        existingOrder.allOrders = [
          ...(existingOrder.allOrders || []),
          ...(data.allOrders || selectFoods),
        ];
        existingOrder.selectFoods = [
          ...(existingOrder.selectFoods || []),
          ...selectFoods,
        ];
        existingOrder.totalPrice =
          (parseFloat(existingOrder.totalPrice) || 0) +
          (parseFloat(data.totalPrice) || 0);
        await existingOrder.save();
        order = existingOrder;

        // KitchenOrder'ga yangi itemlarni qo'shish
        kitchenOrder = await KitchenOrder.findOne({
          orderId: existingOrder._id,
        });
        if (kitchenOrder) {
          kitchenOrder.items.push(...newItems);
          // Agar tayyor bo'lgan bo'lsa, statusni qaytarish
          if (kitchenOrder.status === "served" || kitchenOrder.allItemsReady) {
            kitchenOrder.status = "preparing";
            kitchenOrder.allItemsReady = false;
          }
          await kitchenOrder.save();
        }
      } else {
        // Yangi order yaratish
        isNewOrder = true;
        order = await Order.create({
          restaurantId,
          sessionId: sessionObjectId,
          tableId,
          tableName,
          tableNumber: tableNumber || 0,
          allOrders: data.allOrders || selectFoods,
          selectFoods,
          totalPrice: data.totalPrice || 0,
          discount: data.discount || false,
          userInfo: data.userInfo,
          surcharge: data.surcharge || 0,
          agent: data.agent,
        });

        // Ofitsiyantni tayinlash
        const assignedWaiter = await assignWaiterToOrder(restaurantId, tableId);

        // Kitchen order yaratish
        kitchenOrder = await KitchenOrder.create({
          restaurantId,
          orderId: order._id,
          tableId,
          tableName,
          tableNumber: tableNumber || 0,
          waiterId: assignedWaiter ? assignedWaiter._id : null,
          waiterName: assignedWaiter
            ? `${assignedWaiter.firstName} ${assignedWaiter.lastName}`
            : null,
          items: newItems,
          status: "pending",
        });

        // Ofitsiyantga xabar
        if (assignedWaiter) {
          io.to(`waiter_${assignedWaiter._id}`).emit("new_table_assigned", {
            order: kitchenOrder,
            tableName,
            tableNumber,
          });
        }
      }

      // Mijozga javob
      socket.emit("get_message", { msg: "success", orderId: order._id });

      // Oshpazlarga xabar
      const kitchenOrders = await KitchenOrder.find({
        restaurantId,
        status: { $in: ["pending", "preparing"] },
      })
        .sort({ createdAt: 1 })
        .populate("waiterId");

      io.to(`kitchen_${restaurantId}`).emit("new_kitchen_order", {
        order: kitchenOrder,
        allOrders: kitchenOrders,
        isNewOrder,
      });

      // Legacy support
      io.to("kitchen").emit("new_kitchen_order", {
        order: kitchenOrder,
        allOrders: kitchenOrders,
      });

      // Kassaga xabar
      io.to(`cashier_${restaurantId}`).emit("new_kitchen_order", {
        order: kitchenOrder,
      });
      io.to("cashier").emit("new_kitchen_order", { order: kitchenOrder });

      // Barcha buyurtmalarni broadcast
      const orders = await Order.find({ restaurantId });
      socket.broadcast.emit("get_order", orders);
    } catch (error) {
      console.error("Post order error:", error);
      socket.emit("get_message", { msg: "error", error: error.message });
    }
  });

  // Oshpaz ovqatni tayyor deb belgilashi
  socket.on("item_ready", async (data) => {
    try {
      const { orderId, itemIndex, restaurantId } = data;
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

      // Yangilangan ma'lumotni yuborish
      const kitchenOrders = await KitchenOrder.find({
        restaurantId: order.restaurantId,
        status: { $in: ["pending", "preparing", "ready"] },
      })
        .sort({ createdAt: 1 })
        .populate("waiterId");

      io.to(`kitchen_${order.restaurantId}`).emit(
        "kitchen_orders_updated",
        kitchenOrders
      );
      io.to(`cashier_${order.restaurantId}`).emit(
        "kitchen_orders_updated",
        kitchenOrders
      );
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

      // Yangilangan ma'lumot
      const kitchenOrders = await KitchenOrder.find({
        restaurantId: order.restaurantId,
        status: { $in: ["pending", "preparing", "ready"] },
      })
        .sort({ createdAt: 1 })
        .populate("waiterId");

      io.to(`kitchen_${order.restaurantId}`).emit(
        "kitchen_orders_updated",
        kitchenOrders
      );
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

      // Order statusini ham yangilash
      await Order.findByIdAndUpdate(order.orderId, { status: "served" });

      const kitchenOrders = await KitchenOrder.find({
        restaurantId: order.restaurantId,
        status: { $in: ["pending", "preparing", "ready"] },
      })
        .sort({ createdAt: 1 })
        .populate("waiterId");

      io.to(`kitchen_${order.restaurantId}`).emit(
        "kitchen_orders_updated",
        kitchenOrders
      );
      io.to(`cashier_${order.restaurantId}`).emit(
        "kitchen_orders_updated",
        kitchenOrders
      );
      io.to("kitchen").emit("kitchen_orders_updated", kitchenOrders);
      io.to("cashier").emit("kitchen_orders_updated", kitchenOrders);

      // Ofitsiyantga tasdiqlash
      if (order.waiterId) {
        io.to(`waiter_${order.waiterId}`).emit("order_served_confirmed", {
          orderId: order._id,
        });
      }
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

      // Order statusini ham yangilash
      await Order.findByIdAndUpdate(order.orderId, { status: "paid" });

      // To'lovni SaveOrder ga saqlash
      const totalPrice = order.items.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
      );

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
      io.to(`cashier_${order.restaurantId}`).emit("order_paid_success", {
        orderId: order._id,
        tableName: order.tableName,
      });
      io.to("cashier").emit("order_paid_success", {
        orderId: order._id,
        tableName: order.tableName,
      });

      const kitchenOrders = await KitchenOrder.find({
        restaurantId: order.restaurantId,
        status: { $in: ["pending", "preparing", "ready"] },
      })
        .sort({ createdAt: 1 })
        .populate("waiterId");

      io.to(`kitchen_${order.restaurantId}`).emit(
        "kitchen_orders_updated",
        kitchenOrders
      );
      io.to("kitchen").emit("kitchen_orders_updated", kitchenOrders);
    } catch (error) {
      console.error("Mark paid error:", error);
    }
  });

  // Ofitsiyantni chaqirish
  socket.on("call", async (data) => {
    try {
      const callData = await Call.create(data);
      const calls = await Call.find({ restaurantId: data.restaurantId });

      io.to(`restaurant_${data.restaurantId}`).emit("call-info", calls);
      socket.broadcast.emit("call-info", calls);
      socket.emit("call-response", { msg: "successfully" });
    } catch (error) {
      socket.emit("call-response", { msg: "error" });
    }
  });

  // Disconnect
  socket.on("disconnect", async () => {
    try {
      await Staff.findOneAndUpdate(
        { socketId: socket.id },
        { isOnline: false, socketId: null }
      );
      console.log(`User disconnected: ${socket.id}`);
    } catch (error) {
      console.error("Disconnect error:", error);
    }
  });
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Yangi API routerlar
app.use("/api", require("./routers/super-admin"));
app.use("/api", require("./routers/restaurant-admin"));
app.use("/api", require("./routers/qr-session"));
app.use("/api", require("./routers/staff"));
app.use("/api", require("./routers/menu")); // QR session uchun menu
app.use("/api", require("./routers/landing-contact")); // Landing page kontaktlar

// Mavjud routerlar - /api prefiksi bilan
app.use("/api", require("./routers/category"));
app.use("/api", require("./routers/food"));
app.use("/api", require("./routers/dosage"));
app.use("/api", require("./routers/table"));
app.use("/api", require("./routers/order"));
app.use("/api", require("./routers/saveOrders"));
app.use("/api", require("./routers/debt"));
app.use("/api", require("./routers/service"));
app.use("/api", require("./routers/discount"));
app.use("/api", require("./routers/saved"));
app.use("/api", require("./routers/call"));
app.use("/api", require("./routers/waiter"));
app.use("/api", require("./routers/kitchen-order"));
app.use("/api", require("./routers/demo")); // Demo API endpoints
app.use(fileUpload());

app.use(express.static("public"));
app.use("/uploads", express.static("uploads"));

app.get("/", (req, res) => {
  res.json({ message: "Restaurant API Server", version: "2.0" });
});

app.get("/restaurant", async (req, res) => {
  try {
    const restaurants = await Restaurant.find();
    res.status(200).json({ status: "success", data: restaurants });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
