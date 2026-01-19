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
const Food = require("./models/foods");
const WaiterNotification = require("./models/waiter-notification");

// Firebase Service
const { initializeFirebase, sendPushNotification } = require("./services/firebase.service");

require("dotenv").config();

// Firebase'ni initialize qilish
initializeFirebase();

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
// Stolga biriktirilgan waiter bo'lsa - uni qaytarish
// Aks holda eng kam ish yukiga ega waiter tanlash
async function assignWaiterToTable(restaurantId, tableId) {
  try {
    // Avval stolga biriktirilgan waiterni tekshirish
    const table = await Table.findById(tableId);
    if (table && table.assignedWaiterId) {
      const assignedWaiter = await Staff.findById(table.assignedWaiterId);
      if (assignedWaiter && assignedWaiter.status === "working") {
        return assignedWaiter;
      }
    }

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
      const selectedWaiter = activeWaiters[randomIndex];

      // Stolga waiter biriktirish
      if (table) {
        table.assignedWaiterId = selectedWaiter._id;
        table.status = "occupied";
        await table.save();
      }

      return selectedWaiter;
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
    const selectedWaiter = waiterWorkloads[0].waiter;

    // Stolga waiter biriktirish
    if (table) {
      table.assignedWaiterId = selectedWaiter._id;
      table.status = "occupied";
      await table.save();
    }

    return selectedWaiter;
  } catch (error) {
    console.error("Ofitsiyant tayinlashda xato:", error);
    return null;
  }
}

// Legacy support
async function assignWaiterToOrder(restaurantId, tableId) {
  return assignWaiterToTable(restaurantId, tableId);
}

// Socket.io
io.on("connection", async (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Query parametrlardan staffId va restaurantId olish (Flutter uchun)
  const queryStaffId = socket.handshake.query?.staffId;
  const queryRestaurantId = socket.handshake.query?.restaurantId;

  if (queryStaffId && queryRestaurantId) {
    console.log(`Auto-joining waiter from query: staffId=${queryStaffId}, restaurantId=${queryRestaurantId}`);
    try {
      const waiter = await Staff.findByIdAndUpdate(
        queryStaffId,
        { socketId: socket.id, isOnline: true },
        { new: true }
      );
      if (waiter) {
        socket.join(`waiter_${queryStaffId}`);
        socket.join(`restaurant_${queryRestaurantId}`);
        console.log(`Waiter ${queryStaffId} auto-joined rooms from query params`);

        // Waiter'ga ulanish tasdiqlangan deb xabar yuborish
        socket.emit("connection_established", {
          success: true,
          waiterId: queryStaffId,
          waiterName: `${waiter.firstName} ${waiter.lastName}`,
          restaurantId: queryRestaurantId,
          message: "Serverga muvaffaqiyatli ulandi!",
        });
        console.log(`Connection established event sent to waiter ${queryStaffId}`);

        // Push notification yuborish (app ochiq bo'lsa ham test uchun)
        if (waiter.fcmToken) {
          sendPushNotification(
            waiter.fcmToken,
            "Serverga ulandi!",
            `${waiter.firstName}, siz serverga muvaffaqiyatli ulandingiz!`,
            { type: "connection_established", waiterId: queryStaffId }
          );
          console.log(`Push notification sent to waiter ${queryStaffId}`);
        } else {
          console.log(`Waiter ${queryStaffId} has no FCM token`);
        }
      }
    } catch (error) {
      console.error("Auto-join waiter error:", error);
    }
  }

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

  // Legacy support - eski panellar uchun (string yoki object qabul qiladi)
  socket.on("waiter_connect", async (data) => {
    try {
      // String yoki object bo'lishi mumkin
      const waiterId = typeof data === 'string' ? data : data?.waiterId;
      const restaurantId = typeof data === 'object' ? data?.restaurantId : null;

      if (!waiterId) {
        console.error("Waiter connect: waiterId is missing");
        return;
      }

      console.log(`Waiter connect: waiterId=${waiterId}, restaurantId=${restaurantId}`);

      const waiter = await Staff.findByIdAndUpdate(
        waiterId,
        { socketId: socket.id, isOnline: true },
        { new: true }
      );
      if (waiter) {
        socket.join(`waiter_${waiterId}`);
        socket.join(`restaurant_${waiter.restaurantId}`);
        console.log(`Waiter ${waiterId} joined rooms: waiter_${waiterId}, restaurant_${waiter.restaurantId}`);

        // Waiter'ga ulanish tasdiqlangan deb xabar yuborish
        socket.emit("connection_established", {
          success: true,
          waiterId: waiterId,
          waiterName: `${waiter.firstName} ${waiter.lastName}`,
          restaurantId: waiter.restaurantId,
          message: "Serverga muvaffaqiyatli ulandi!",
        });
        console.log(`Connection established event sent to waiter ${waiterId}`);

        // Push notification yuborish
        if (waiter.fcmToken) {
          sendPushNotification(
            waiter.fcmToken,
            "Serverga ulandi!",
            `${waiter.firstName}, siz serverga muvaffaqiyatli ulandingiz!`,
            { type: "connection_established", waiterId: waiterId }
          );
          console.log(`Push notification sent to waiter ${waiterId}`);
        } else {
          console.log(`Waiter ${waiterId} has no FCM token`);
        }
      }
    } catch (error) {
      console.error("Waiter connect error:", error);
    }
  });

  socket.on("cook_connect", (data) => {
    // data object yoki string bo'lishi mumkin
    const restaurantId = typeof data === 'object' ? data.restaurantId : data;
    socket.join(`kitchen_${restaurantId || "default"}`);
    socket.join("kitchen"); // Legacy support
    console.log(`Cook connected to kitchen_${restaurantId}`);
  });

  socket.on("cashier_connect", (data) => {
    // data object yoki string bo'lishi mumkin
    const restaurantId = typeof data === 'object' ? data.restaurantId : data;
    socket.join(`cashier_${restaurantId || "default"}`);
    socket.join("cashier"); // Legacy support
    console.log(`Cashier connected to cashier_${restaurantId}`);
  });

  // Restoranga xos room'ga qo'shilish
  socket.on("join_restaurant", (data) => {
    const restaurantId = typeof data === 'object' ? data.restaurantId : data;
    if (restaurantId) {
      socket.join(`restaurant_${restaurantId}`);
      socket.join(`kitchen_${restaurantId}`);
      console.log(`Socket joined restaurant_${restaurantId} and kitchen_${restaurantId}`);
    }
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

      // Yangi itemlarni tayyorlash - allOrders yoki selectFoods dan
      // allOrders - har bir bosishda alohida element (quantity yo'q)
      // selectFoods - unique elementlar (quantity bor bo'lishi kerak)
      const newItems = [];
      const sourceItems = selectFoods && Array.isArray(selectFoods) ? selectFoods : [];

      // Agar selectFoods'da quantity to'g'ri bo'lmasa, allOrders'dan hisoblash
      const itemsMap = new Map();

      // Avval selectFoods'ni tekshirish
      let useAllOrders = false;
      if (sourceItems.length > 0) {
        const totalQtyFromSelectFoods = sourceItems.reduce((sum, f) => sum + (f.quantity || f.count || 1), 0);
        const allOrdersLength = (data.allOrders || []).length;
        // Agar quantity noto'g'ri bo'lsa (masalan, 3 ta qo'shilgan lekin quantity=1)
        if (totalQtyFromSelectFoods < allOrdersLength && allOrdersLength > 0) {
          useAllOrders = true;
        }
      }

      if (useAllOrders && data.allOrders && Array.isArray(data.allOrders)) {
        // allOrders'dan guruhlash
        data.allOrders.forEach((food) => {
          const foodId = food._id || food.id;
          if (itemsMap.has(foodId)) {
            itemsMap.get(foodId).quantity += 1;
          } else {
            itemsMap.set(foodId, {
              foodId: foodId,
              foodName: food.foodName || food.name,
              quantity: 1,
              price: food.price || 0,
              isReady: false,
            });
          }
        });
      } else {
        // selectFoods'dan olish (quantity bilan)
        sourceItems.forEach((food) => {
          const foodId = food._id || food.id;
          if (itemsMap.has(foodId)) {
            itemsMap.get(foodId).quantity += (food.quantity || food.count || 1);
          } else {
            itemsMap.set(foodId, {
              foodId: foodId,
              foodName: food.foodName || food.name,
              quantity: food.quantity || food.count || 1,
              price: food.price || 0,
              isReady: false,
            });
          }
        });
      }

      // Map'dan array'ga o'tkazish
      itemsMap.forEach((item) => newItems.push(item));

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

          // Mavjud orderga qo'shilganda ham waiter'ga xabar yuborish
          if (kitchenOrder.waiterId) {
            const waiter = await Staff.findById(kitchenOrder.waiterId);
            if (waiter) {
              console.log(`Sending new_order_items to waiter ${waiter._id}`);
              io.to(`waiter_${waiter._id}`).emit("new_order_items", {
                order: kitchenOrder,
                tableName,
                tableNumber,
                newItems: newItems,
                message: `${tableName} ga yangi buyurtma qo'shildi!`,
              });

              // Push notification yuborish
              if (waiter.fcmToken) {
                console.log(`Sending push notification for new items to waiter ${waiter._id}`);
                sendPushNotification(
                  waiter.fcmToken,
                  "Yangi buyurtma qo'shildi!",
                  `${tableName} ga yangi buyurtma qo'shildi`,
                  { type: "new_order_items", orderId: kitchenOrder._id.toString() }
                );
              }
            }
          }
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
          console.log(`Sending new_table_assigned to waiter ${assignedWaiter._id}`);
          io.to(`waiter_${assignedWaiter._id}`).emit("new_table_assigned", {
            order: kitchenOrder,
            tableName,
            tableNumber,
            message: `${tableName} dan yangi buyurtma keldi!`,
          });

          // Push notification yuborish (app yopiq bo'lsa ham)
          if (assignedWaiter.fcmToken) {
            console.log(`Sending push notification for new table to waiter ${assignedWaiter._id}`);
            sendPushNotification(
              assignedWaiter.fcmToken,
              "Yangi buyurtma!",
              `${tableName} dan yangi buyurtma keldi`,
              { type: "new_table_assigned", orderId: kitchenOrder._id.toString() }
            );
          } else {
            console.log(`Waiter ${assignedWaiter._id} has no FCM token for new_table_assigned`);
          }
        } else {
          console.log(`No waiter assigned for table ${tableName}`);
        }
      }

      // Mijozga javob
      socket.emit("get_message", { msg: "success", orderId: order._id });

      // BARCHA WAITER'LARGA XABAR YUBORISH (restaurant_${restaurantId} room orqali)
      console.log(`Broadcasting new_order to restaurant_${restaurantId}`);
      io.to(`restaurant_${restaurantId}`).emit("new_order", {
        order: kitchenOrder,
        tableName,
        tableNumber,
        isNewOrder,
        message: isNewOrder
          ? `${tableName} dan yangi buyurtma keldi!`
          : `${tableName} ga yangi buyurtma qo'shildi!`,
      });

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

      const item = order.items[itemIndex];
      const wasReady = item.isReady;
      item.isReady = !item.isReady;

      if (item.isReady) {
        // Tayyor bo'lganda - vaqtni hisoblash
        item.readyAt = new Date();
        const addedAt = item.addedAt || order.createdAt;
        const cookingTimeSeconds = Math.floor((item.readyAt - addedAt) / 1000);
        item.cookingTime = cookingTimeSeconds;

        // Food'ning ortacha tayyorlash vaqtini yangilash
        if (item.foodId) {
          try {
            const food = await Food.findById(item.foodId);
            if (food) {
              food.cookingTimeCount = (food.cookingTimeCount || 0) + 1;
              food.cookingTimeTotal = (food.cookingTimeTotal || 0) + cookingTimeSeconds;
              food.averageCookingTime = Math.round(food.cookingTimeTotal / food.cookingTimeCount);
              await food.save();
            }
          } catch (err) {
            console.error("Food cooking time update error:", err);
          }
        }
      } else {
        // Tayyor emas deb belgilanganda
        item.readyAt = null;
        item.cookingTime = null;
      }

      const allReady = order.items.every((i) => i.isReady);
      order.allItemsReady = allReady;

      if (allReady) {
        order.status = "ready";
      } else if (order.items.some((i) => i.isReady)) {
        order.status = "preparing";
      } else {
        order.status = "pending";
      }

      await order.save();

      // Yangilangan ma'lumotni yuborish - KO'P KUTILGANLAR BIRINCHI
      const kitchenOrders = await KitchenOrder.find({
        restaurantId: order.restaurantId,
        status: { $in: ["pending", "preparing", "ready"] },
      })
        .sort({ createdAt: 1 }) // Eng eski (ko'p kutilgan) birinchi
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

      // Waiter'ga ham xabar yuborish - faqat shu paytda tayyor bo'lgan 1 ta taom
      if (order.waiterId && item.isReady) {
        // Avval bazaga saqlash - notificationId olish uchun
        let savedNotification = null;
        try {
          savedNotification = await WaiterNotification.create({
            waiterId: order.waiterId,
            restaurantId: order.restaurantId,
            orderId: order._id,
            type: "food_ready",
            tableName: order.tableName,
            tableNumber: order.tableNumber || 0,
            message: `${order.tableName}: ${item.foodName} tayyor!`,
            items: [{
              foodName: item.foodName,
              quantity: item.quantity,
              isReady: true
            }],
          });
        } catch (saveErr) {
          console.error("WaiterNotification save error:", saveErr);
        }

        const notificationData = {
          notificationId: savedNotification ? savedNotification._id.toString() : null,
          orderId: order._id.toString(),
          tableName: order.tableName,
          tableNumber: order.tableNumber || 0,
          message: `${order.tableName}: ${item.foodName} tayyor!`,
          items: [{
            foodName: item.foodName,
            quantity: item.quantity,
            isReady: true
          }],
          allReady: allReady,
        };

        // Socket orqali yuborish
        io.to(`waiter_${order.waiterId}`).emit("order_ready_notification", notificationData);
        console.log(`Item ready notification sent to waiter_${order.waiterId}: ${item.foodName}, notificationId: ${notificationData.notificationId}`);
      }
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

        // Push notification yuborish
        const waiter = await Staff.findById(order.waiterId);
        if (waiter?.fcmToken) {
          sendPushNotification(
            waiter.fcmToken,
            "Buyurtma tayyor!",
            `${order.tableName} uchun buyurtma tayyor - olib boring!`,
            { type: "order_ready", orderId: order._id.toString() }
          );
        }
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

      // Stolni bo'shatish va waiter'ni o'chirish
      if (order.tableId) {
        await Table.findByIdAndUpdate(order.tableId, {
          status: "free",
          assignedWaiterId: null,
        });
      }

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

  // Ofitsiyantni chaqirish (legacy)
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

  // Yangi: Bell icon - waiter chaqirish va stolga biriktirish
  socket.on("call_waiter", async (data) => {
    try {
      const { restaurantId, tableId, tableName, sessionId } = data;

      // Stolni topish
      let table = await Table.findById(tableId);
      if (!table) {
        socket.emit("call_waiter_response", { success: false, error: "Stol topilmadi" });
        return;
      }

      let waiter;

      // Agar stolga waiter biriktirilgan bo'lsa
      if (table.assignedWaiterId) {
        waiter = await Staff.findById(table.assignedWaiterId);
        if (!waiter || waiter.status !== "working") {
          // Waiter ishlamayapti - yangi waiter tanlash
          waiter = await assignWaiterToTable(restaurantId, tableId);
        }
      } else {
        // Stolga waiter biriktirilmagan - yangi waiter tanlash
        waiter = await assignWaiterToTable(restaurantId, tableId);
      }

      if (!waiter) {
        socket.emit("call_waiter_response", { success: false, error: "Hozirda bo'sh ofitsiyant yo'q" });
        return;
      }

      // Stolni occupied qilish
      table.status = "occupied";
      await table.save();

      // WaiterNotification ga avval saqlash (notificationId olish uchun)
      let savedNotification = null;
      try {
        savedNotification = await WaiterNotification.create({
          waiterId: waiter._id,
          restaurantId,
          orderId: null,
          type: "waiter_call",
          tableName: tableName || table.title,
          tableNumber: table.tableNumber || 0,
          message: `${tableName || table.title} dan chaqiruv!`,
          items: [],
        });
        console.log(`WaiterNotification saved for waiter_call: ${tableName || table.title}, id: ${savedNotification._id}`);
      } catch (saveErr) {
        console.error("WaiterNotification save error (waiter_call):", saveErr);
      }

      // Waiter'ga notification yuborish - notificationId bilan
      io.to(`waiter_${waiter._id}`).emit("waiter_called", {
        notificationId: savedNotification ? savedNotification._id.toString() : null,
        tableId,
        tableName: tableName || table.title,
        tableNumber: table.tableNumber,
        message: `${tableName || table.title} dan chaqiruv!`,
      });

      // Push notification yuborish (app yopiq bo'lsa ham)
      if (waiter.fcmToken) {
        sendPushNotification(
          waiter.fcmToken,
          "Mijoz chaqirmoqda!",
          `${tableName || table.title} sizni chaqirmoqda!`,
          { type: "waiter_called", tableId }
        );
      }

      // Call recordini saqlash
      await Call.create({
        restaurantId,
        tableId,
        tableNumber: table.tableNumber || 0,
        tableName: tableName || table.title,
        agent: {
          _id: waiter._id,
          firstName: waiter.firstName,
          lastName: waiter.lastName,
          phone: waiter.phone,
        },
        waiterId: waiter._id,
        waiterName: `${waiter.firstName} ${waiter.lastName}`,
        type: "bell_call",
      });

      socket.emit("call_waiter_response", {
        success: true,
        waiter: {
          id: waiter._id,
          name: `${waiter.firstName} ${waiter.lastName}`,
        },
      });
    } catch (error) {
      console.error("Call waiter error:", error);
      socket.emit("call_waiter_response", { success: false, error: error.message });
    }
  });

  // Buyurtmani bekor qilish (faqat tayyorlanmoqda statusida)
  socket.on("cancel_order_item", async (data) => {
    try {
      const { orderId, itemIndex, sessionId } = data;

      const kitchenOrder = await KitchenOrder.findById(orderId);
      if (!kitchenOrder) {
        socket.emit("cancel_order_response", { success: false, error: "Buyurtma topilmadi" });
        return;
      }

      // Faqat pending yoki preparing statusda bekor qilish mumkin
      if (kitchenOrder.status === "ready" || kitchenOrder.status === "served") {
        socket.emit("cancel_order_response", { success: false, error: "Bu buyurtmani bekor qilib bo'lmaydi" });
        return;
      }

      const item = kitchenOrder.items[itemIndex];
      if (!item) {
        socket.emit("cancel_order_response", { success: false, error: "Item topilmadi" });
        return;
      }

      // Agar item tayyor bo'lsa - bekor qilib bo'lmaydi
      if (item.isReady) {
        socket.emit("cancel_order_response", { success: false, error: "Tayyor bo'lgan ovqatni bekor qilib bo'lmaydi" });
        return;
      }

      // O'chirilayotgan item ma'lumotlarini saqlash (notification uchun)
      const cancelledItem = {
        foodName: item.foodName,
        quantity: item.quantity || 1,
        price: item.price || 0,
        foodId: item.foodId,
      };
      const cancelledItemPrice = (item.price || 0) * (item.quantity || 1);

      // Itemni o'chirish
      kitchenOrder.items.splice(itemIndex, 1);

      // TotalPrice ni yangilash
      const newTotalPrice = kitchenOrder.items.reduce((sum, i) => sum + (i.price || 0) * (i.quantity || 1), 0);
      kitchenOrder.totalPrice = newTotalPrice;

      // Agar barcha itemlar o'chirilgan bo'lsa - orderni cancelled qilish
      if (kitchenOrder.items.length === 0) {
        kitchenOrder.status = "served"; // yoki cancelled
        await Order.findByIdAndUpdate(kitchenOrder.orderId, { status: "cancelled", totalPrice: 0 });
      } else {
        // Order totalPrice ni ham yangilash
        await Order.findByIdAndUpdate(kitchenOrder.orderId, { totalPrice: newTotalPrice });
      }

      await kitchenOrder.save();

      // Oshxonaga xabar
      const kitchenOrders = await KitchenOrder.find({
        restaurantId: kitchenOrder.restaurantId,
        status: { $in: ["pending", "preparing", "ready"] },
      })
        .sort({ createdAt: 1 })
        .populate("waiterId");

      io.to(`kitchen_${kitchenOrder.restaurantId}`).emit("kitchen_orders_updated", kitchenOrders);
      io.to("kitchen").emit("kitchen_orders_updated", kitchenOrders);

      // Waiter (ofitsiant) tomonga ham xabar
      io.to(`waiter_${kitchenOrder.restaurantId}`).emit("kitchen_orders_updated", kitchenOrders);

      // Kassir tomonga xabar
      io.to(`cashier_${kitchenOrder.restaurantId}`).emit("kitchen_orders_updated", kitchenOrders);
      io.to(`cashier_${kitchenOrder.restaurantId}`).emit("order_updated", {
        orderId: kitchenOrder.orderId,
        kitchenOrderId: kitchenOrder._id,
        totalPrice: newTotalPrice,
        items: kitchenOrder.items,
      });

      // Client (my-orders) va Kitchen (cook-panel) ga yangilangan ma'lumot yuborish
      const cancelEventData = {
        kitchenOrderId: kitchenOrder._id,
        orderId: kitchenOrder.orderId,
        newTotalPrice,
        itemsCount: kitchenOrder.items.length,
        cancelledItem,
        tableName: kitchenOrder.tableName,
        restaurantId: kitchenOrder.restaurantId,
      };

      // Barcha clientlarga
      io.emit("order_item_cancelled", cancelEventData);

      // Kitchen (cook-panel) ga alohida
      io.to(`kitchen_${kitchenOrder.restaurantId}`).emit("order_item_cancelled", cancelEventData);
      io.to("kitchen").emit("order_item_cancelled", cancelEventData);

      socket.emit("cancel_order_response", { success: true, newTotalPrice });
    } catch (error) {
      console.error("Cancel order error:", error);
      socket.emit("cancel_order_response", { success: false, error: error.message });
    }
  });

  // Foydalanuvchining orderlarini olish (session bo'yicha)
  socket.on("get_my_orders", async (data) => {
    try {
      const { sessionId, restaurantId, tableId } = data;

      // SessionId orqali yoki tableId orqali orderlarni topish
      let query = { restaurantId };

      if (sessionId) {
        const session = await QRSession.findOne({ sessionToken: sessionId });
        if (session) {
          query.sessionId = session._id;
        }
      }

      if (tableId) {
        query.tableId = tableId;
      }

      // Faqat to'lanmagan orderlarni olish
      query.status = { $nin: ["paid", "cancelled"] };

      const orders = await Order.find(query).sort({ createdAt: -1 });

      // Har bir order uchun kitchen order statusini olish
      const ordersWithStatus = await Promise.all(
        orders.map(async (order) => {
          const kitchenOrder = await KitchenOrder.findOne({ orderId: order._id });
          return {
            ...order.toObject(),
            kitchenOrderId: kitchenOrder ? kitchenOrder._id : null,
            kitchenStatus: kitchenOrder ? kitchenOrder.status : "pending",
            items: kitchenOrder ? kitchenOrder.items : [],
          };
        })
      );

      socket.emit("my_orders", ordersWithStatus);
    } catch (error) {
      console.error("Get my orders error:", error);
      socket.emit("my_orders", []);
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
