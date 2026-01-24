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
const {
  initializeFirebase,
  sendPushNotification,
} = require("./services/firebase.service");

require("dotenv").config();

// Firebase'ni initialize qilish
initializeFirebase();

// CORS
app.use(
  cors({
    origin: "*",
    optionsSuccessStatus: 200,
    credentials: true,
  }),
);

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["websocket", "polling"],
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Socket.io ni app ga attach qilish (router'larda ishlatish uchun)
app.set("io", io);

// Default super admin yaratish
const createDefaultSuperAdmin = require("./seeds/super-admin.seed");

// Demo restoran yaratish va reset
const {
  createDemoRestaurant,
  resetDemoData,
} = require("./seeds/demo-restaurant.seed");

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
  })
  .catch((err) => {
    console.error("Database connection error:", err);
  });

mongoose.set("strictQuery", false);

// Stolga biriktirilgan waiterni topish yoki fallback
// 1. Stolga biriktirilgan waiter bor va ishda - shunga berish
// 2. Agar waiter ishda emas - boshqa ishdagi waiterga berish
// 3. Random logika YO'Q - faqat stolga biriktirilgan waiter
async function assignWaiterToTable(restaurantId, tableId) {
  try {
    const table = await Table.findById(tableId);

    // 1. Stolga biriktirilgan waiter bormi tekshirish
    if (table && table.assignedWaiterId) {
      const assignedWaiter = await Staff.findById(table.assignedWaiterId);

      // Waiter topildi va ishlayotgan statusda
      if (assignedWaiter && assignedWaiter.status === "working") {
        // Waiter ishda (keldi) mi tekshirish
        if (assignedWaiter.isWorking) {
          console.log(
            `Order assigned to table's waiter: ${assignedWaiter.firstName} (working)`,
          );
          table.status = "occupied";
          await table.save();
          return assignedWaiter;
        } else {
          // Waiter ishda emas (ketdi) - boshqa ishdagi waiterni topish
          console.log(
            `Table's waiter ${assignedWaiter.firstName} is not working, finding fallback...`,
          );
        }
      }
    }

    // 2. Fallback: ishdagi (isWorking=true) waiterlardan birini topish
    const workingWaiters = await Staff.find({
      restaurantId,
      role: "waiter",
      status: "working",
      isWorking: true, // Faqat ishga kelganlar
    });

    if (workingWaiters.length === 0) {
      console.log("No working waiters found, trying any active waiter...");

      // 3. Hech kim ishda emas - status="working" waiterlardan tanlash (kamroq order yuki bo'yicha)
      const activeWaiters = await Staff.find({
        restaurantId,
        role: "waiter",
        status: "working",
      });

      if (activeWaiters.length === 0) {
        console.log("No active waiters found at all!");
        return null;
      }

      // Eng kam ish yukiga ega waiterni tanlash
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const waiterWorkloads = await Promise.all(
        activeWaiters.map(async (waiter) => {
          const activeOrders = await KitchenOrder.countDocuments({
            restaurantId,
            waiterId: waiter._id,
            createdAt: { $gte: today },
            status: { $in: ["pending", "preparing", "ready"] },
          });
          return { waiter, activeOrders };
        }),
      );

      waiterWorkloads.sort((a, b) => a.activeOrders - b.activeOrders);
      const selectedWaiter = waiterWorkloads[0].waiter;

      console.log(
        `Fallback (no one working): Selected ${selectedWaiter.firstName} with least orders`,
      );

      if (table) {
        table.status = "occupied";
        await table.save();
      }

      return selectedWaiter;
    }

    // Ishdagi waiterlardan eng kam ish yukiga egasini tanlash
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const waiterWorkloads = await Promise.all(
      workingWaiters.map(async (waiter) => {
        const activeOrders = await KitchenOrder.countDocuments({
          restaurantId,
          waiterId: waiter._id,
          createdAt: { $gte: today },
          status: { $in: ["pending", "preparing", "ready"] },
        });
        return { waiter, activeOrders };
      }),
    );

    waiterWorkloads.sort((a, b) => a.activeOrders - b.activeOrders);
    const selectedWaiter = waiterWorkloads[0].waiter;

    console.log(
      `Fallback (waiter not working): Selected ${selectedWaiter.firstName} with least orders`,
    );

    if (table) {
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

// Helper function: Har bir oshpazga faqat uning category'lariga tegishli orderlarni yuborish
async function emitFilteredKitchenOrders(
  io,
  restaurantId,
  kitchenOrder,
  allOrders,
  newItems,
  isNewOrder,
) {
  try {
    console.log("=== emitFilteredKitchenOrders ===");
    console.log(
      "newItems:",
      JSON.stringify(
        newItems.map((i) => ({ name: i.foodName, category: i.category })),
      ),
    );

    // Category ID'larni name'larga map qilish uchun
    const Category = require("./models/category");
    const allCategories = await Category.find({ restaurantId });
    const categoryIdToName = {};
    allCategories.forEach((cat) => {
      categoryIdToName[cat._id.toString()] = cat.title;
    });
    console.log("Category ID to Name map:", categoryIdToName);

    // Restoranning barcha ishlaydigan oshpazlarini olish
    const cooks = await Staff.find({
      restaurantId,
      role: "cook",
      status: "working",
    });

    console.log(
      "Found cooks:",
      cooks.map((c) => ({
        id: c._id,
        name: c.firstName,
        categories: c.assignedCategories,
      })),
    );

    // Har bir oshpazga alohida filtered data yuborish
    for (const cook of cooks) {
      const cookCategoryIds = cook.assignedCategories || [];

      // Agar oshpazning categorylari yo'q bo'lsa - barcha orderlarni ko'rsatish
      if (cookCategoryIds.length === 0) {
        io.to(`cook_${cook._id}`).emit("new_kitchen_order", {
          order: kitchenOrder,
          allOrders: allOrders,
          isNewOrder,
          newItems: newItems,
        });
        continue;
      }

      // Category ID'larni name'larga o'girish
      const cookCategoryNames = cookCategoryIds.map((id) => {
        const name = categoryIdToName[id];
        return name ? name.toLowerCase() : id.toLowerCase();
      });
      console.log(`Cook ${cook.firstName} category names:`, cookCategoryNames);

      // Yangi itemlarni filter qilish (faqat shu oshpazning categorylari)
      const filteredNewItems = newItems.filter((item) => {
        console.log(
          `Checking item: ${item.foodName}, category: ${item.category}, cookCategoryNames: ${cookCategoryNames}`,
        );
        if (!item.category) {
          console.log(`  -> SKIPPED (no category)`);
          return false;
        }
        const match = cookCategoryNames.some(
          (catName) => catName === item.category.toLowerCase(),
        );
        console.log(`  -> ${match ? "MATCHED" : "NOT MATCHED"}`);
        return match;
      });

      // Agar bu oshpazga tegishli yangi itemlar bo'lmasa - skip
      if (filteredNewItems.length === 0 && isNewOrder) {
        continue;
      }

      // allOrders ni ham filter qilish - faqat shu oshpazning itemlari bor orderlar
      // MUHIM: originalIndex ni saqlash kerak - backend to'g'ri item'ni topishi uchun
      const filteredAllOrders = allOrders
        .map((order) => {
          const orderObj = order.toObject ? order.toObject() : order;
          const filteredItems = [];

          // Har bir item'ni tekshirish va originalIndex ni saqlash
          (orderObj.items || []).forEach((item, originalIndex) => {
            if (!item.category) return;
            const matches = cookCategoryNames.some(
              (catName) => catName === item.category.toLowerCase(),
            );
            if (matches) {
              filteredItems.push({
                ...item,
                originalIndex: originalIndex, // Original index'ni saqlash
              });
            }
          });

          if (filteredItems.length === 0) return null;

          return {
            ...orderObj,
            items: filteredItems,
          };
        })
        .filter((order) => order !== null);

      // Agar bu oshpazga tegishli orderlar bo'lsa - yuborish
      if (filteredAllOrders.length > 0 || filteredNewItems.length > 0) {
        // kitchenOrder ni ham filter qilish - originalIndex bilan
        let filteredKitchenOrder = null;
        if (kitchenOrder) {
          const kitchenOrderObj = kitchenOrder.toObject
            ? kitchenOrder.toObject()
            : kitchenOrder;
          const filteredOrderItems = [];

          (kitchenOrderObj.items || []).forEach((item, originalIndex) => {
            if (!item.category) return;
            const matches = cookCategoryNames.some(
              (catName) => catName === item.category.toLowerCase(),
            );
            if (matches) {
              filteredOrderItems.push({
                ...item,
                originalIndex: originalIndex,
              });
            }
          });

          if (filteredOrderItems.length > 0) {
            filteredKitchenOrder = {
              ...kitchenOrderObj,
              items: filteredOrderItems,
            };
          }
        }

        io.to(`cook_${cook._id}`).emit("new_kitchen_order", {
          order: filteredKitchenOrder,
          allOrders: filteredAllOrders,
          isNewOrder,
          newItems: filteredNewItems,
        });

        console.log(
          `Sent filtered order to cook ${cook.firstName} (${cook._id}): ${filteredNewItems.length} new items, ${filteredAllOrders.length} total orders`,
        );
        console.log(
          `filteredAllOrders:`,
          JSON.stringify(
            filteredAllOrders.map((o) => ({
              id: o._id,
              table: o.tableName,
              items: o.items.map((i) => i.foodName),
            })),
          ),
        );
      }
    }
  } catch (error) {
    console.error("emitFilteredKitchenOrders error:", error);
    // Fallback - eski usulda yuborish
    io.to(`kitchen_${restaurantId}`).emit("new_kitchen_order", {
      order: kitchenOrder,
      allOrders: allOrders,
      isNewOrder,
      newItems: newItems,
    });
  }
}

// Har bir cook'ga filtrlangan kitchen_orders_updated yuborish
async function emitFilteredKitchenOrdersUpdated(
  io,
  restaurantId,
  kitchenOrders,
) {
  try {
    const Category = require("./models/category");
    const allCategories = await Category.find({ restaurantId });
    const categoryIdToName = {};
    allCategories.forEach((cat) => {
      categoryIdToName[cat._id.toString()] = cat.title;
    });

    // Barcha cook'larni olish
    const cooks = await Staff.find({
      restaurantId,
      role: "cook",
      status: "working",
    });

    for (const cook of cooks) {
      const cookCategoryIds = cook.assignedCategories || [];

      // Agar cook'ning categorylari yo'q bo'lsa - barcha orderlarni yuborish
      if (cookCategoryIds.length === 0) {
        io.to(`cook_${cook._id}`).emit("kitchen_orders_updated", kitchenOrders);
        continue;
      }

      // Category ID'larni name'larga o'girish
      const cookCategoryNames = cookCategoryIds.map((id) => {
        const name = categoryIdToName[id];
        return name ? name.toLowerCase() : id.toLowerCase();
      });

      // Orderlarni filter qilish - originalIndex bilan
      const filteredOrders = kitchenOrders
        .map((order) => {
          const orderObj = order.toObject ? order.toObject() : order;
          const filteredItems = [];

          (orderObj.items || []).forEach((item, originalIndex) => {
            if (!item.category) return;
            const matches = cookCategoryNames.some(
              (catName) => catName === item.category.toLowerCase(),
            );
            if (matches) {
              filteredItems.push({
                ...item,
                originalIndex: originalIndex,
              });
            }
          });

          if (filteredItems.length === 0) return null;

          return {
            ...orderObj,
            items: filteredItems,
          };
        })
        .filter((order) => order !== null);

      io.to(`cook_${cook._id}`).emit("kitchen_orders_updated", filteredOrders);
    }

    // Cashier'ga ham yuborish (filter qilmasdan)
    io.to(`cashier_${restaurantId}`).emit(
      "kitchen_orders_updated",
      kitchenOrders,
    );
    io.to("cashier").emit("kitchen_orders_updated", kitchenOrders);
  } catch (error) {
    console.error("emitFilteredKitchenOrdersUpdated error:", error);
    // Fallback
    io.to(`kitchen_${restaurantId}`).emit(
      "kitchen_orders_updated",
      kitchenOrders,
    );
    io.to("kitchen").emit("kitchen_orders_updated", kitchenOrders);
    io.to(`cashier_${restaurantId}`).emit(
      "kitchen_orders_updated",
      kitchenOrders,
    );
    io.to("cashier").emit("kitchen_orders_updated", kitchenOrders);
  }
}

// Socket.io
io.on("connection", async (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Query parametrlardan staffId va restaurantId olish (Flutter uchun)
  const queryStaffId = socket.handshake.query?.staffId;
  const queryRestaurantId = socket.handshake.query?.restaurantId;

  if (queryStaffId && queryRestaurantId) {
    console.log(
      `Auto-joining waiter from query: staffId=${queryStaffId}, restaurantId=${queryRestaurantId}`,
    );
    try {
      const waiter = await Staff.findByIdAndUpdate(
        queryStaffId,
        { socketId: socket.id, isOnline: true },
        { new: true },
      );
      if (waiter) {
        socket.join(`waiter_${queryStaffId}`);
        socket.join(`restaurant_${queryRestaurantId}`);
        console.log(
          `Waiter ${queryStaffId} auto-joined rooms from query params`,
        );

        // Waiter'ga ulanish tasdiqlangan deb xabar yuborish
        socket.emit("connection_established", {
          success: true,
          waiterId: queryStaffId,
          waiterName: `${waiter.firstName} ${waiter.lastName}`,
          restaurantId: queryRestaurantId,
          message: "Serverga muvaffaqiyatli ulandi!",
        });
        console.log(
          `Connection established event sent to waiter ${queryStaffId}`,
        );

        // Push notification yuborish - yangi fcmToken'ni olish
        // Sabab: Token socket ulanishidan oldin register qilingan bo'lishi kerak
        const freshWaiterForFcm = await Staff.findById(queryStaffId).select("fcmToken firstName");
        if (freshWaiterForFcm?.fcmToken) {
          sendPushNotification(
            freshWaiterForFcm.fcmToken,
            "Serverga ulandi!",
            `${waiter.firstName}, siz serverga muvaffaqiyatli ulandingiz!`,
            { type: "connection_established", waiterId: queryStaffId },
          );
          console.log(`Push notification sent to waiter ${queryStaffId}`);
        } else {
          console.log(`Waiter ${queryStaffId} has no FCM token (checked fresh)`);
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
          `Waiter ${staffId} connected to restaurant ${restaurantId}`,
        );
      } else if (role === "cook") {
        socket.join(`kitchen_${restaurantId}`);
        socket.join(`cook_${staffId}`); // Personal cook room for filtered orders
        console.log(`Cook ${staffId} connected to restaurant ${restaurantId}`);
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
      const waiterId = typeof data === "string" ? data : data?.waiterId;
      const restaurantId = typeof data === "object" ? data?.restaurantId : null;

      if (!waiterId) {
        console.error("Waiter connect: waiterId is missing");
        return;
      }

      console.log(
        `Waiter connect: waiterId=${waiterId}, restaurantId=${restaurantId}`,
      );

      const waiter = await Staff.findByIdAndUpdate(
        waiterId,
        { socketId: socket.id, isOnline: true },
        { new: true },
      );
      if (waiter) {
        // Har doim shaxsiy room'ga qo'shish (shaxsiy xabarlar uchun)
        socket.join(`waiter_${waiterId}`);

        // MUHIM: Faqat isWorking=true bo'lgan waiter'lar restaurant room'iga qo'shiladi
        // Bu real-time broadcast xabarlarni olish uchun kerak
        if (waiter.isWorking) {
          socket.join(`restaurant_${waiter.restaurantId}`);
          console.log(
            `Waiter ${waiterId} (isWorking=true) joined rooms: waiter_${waiterId}, restaurant_${waiter.restaurantId}`,
          );
        } else {
          console.log(
            `Waiter ${waiterId} (isWorking=false) joined only personal room: waiter_${waiterId}`,
          );
        }

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
            { type: "connection_established", waiterId: waiterId },
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
    const restaurantId = typeof data === "object" ? data.restaurantId : data;
    const cookId = typeof data === "object" ? data.cookId : null;
    socket.join(`kitchen_${restaurantId || "default"}`);
    socket.join("kitchen"); // Legacy support - eski clientlar uchun
    if (cookId) {
      socket.join(`cook_${cookId}`); // Personal cook room for filtered orders
    }
    console.log(
      `Cook ${cookId || "unknown"} connected to kitchen_${restaurantId}`,
    );
  });

  socket.on("cashier_connect", async (data) => {
    // data object yoki string bo'lishi mumkin
    const restaurantId = typeof data === "object" ? data.restaurantId : data;
    socket.join(`cashier_${restaurantId || "default"}`);
    socket.join("cashier"); // Legacy support
    console.log(`Cashier connected to cashier_${restaurantId}`);

    // Kassirga buyurtmalarni yuborish
    if (restaurantId) {
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Bugungi to'lanmagan buyurtmalar
        const activeOrders = await Order.find({
          restaurantId,
          isPaid: false,
          createdAt: { $gte: today },
        }).sort({ createdAt: -1 });

        // Bugungi to'langan buyurtmalar
        const paidOrders = await Order.find({
          restaurantId,
          isPaid: true,
          createdAt: { $gte: today },
        }).sort({ paidAt: -1 });

        socket.emit("cashier_orders", {
          activeOrders,
          paidOrders,
        });
        console.log(
          `Sent ${activeOrders.length} active and ${paidOrders.length} paid orders to cashier`,
        );
      } catch (error) {
        console.error("Cashier orders error:", error);
      }
    }
  });

  // Kassir buyurtmalarni so'rashi
  socket.on("get_cashier_orders", async (data) => {
    const restaurantId = typeof data === "object" ? data.restaurantId : data;
    if (!restaurantId) return;

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Bugungi to'lanmagan buyurtmalar
      const activeOrders = await Order.find({
        restaurantId,
        isPaid: false,
        createdAt: { $gte: today },
      }).sort({ createdAt: -1 });

      // Bugungi to'langan buyurtmalar
      const paidOrders = await Order.find({
        restaurantId,
        isPaid: true,
        createdAt: { $gte: today },
      }).sort({ paidAt: -1 });

      socket.emit("cashier_orders", {
        activeOrders,
        paidOrders,
      });
      console.log(
        `Cashier requested orders: ${activeOrders.length} active, ${paidOrders.length} paid`,
      );
    } catch (error) {
      console.error("Get cashier orders error:", error);
    }
  });

  // Restoranga xos room'ga qo'shilish
  // ESLATMA: Waiter'lar uchun bu isWorking tekshiruvidan o'tmaydi
  // Waiter'lar faqat waiter_connect orqali isWorking tekshiruvi bilan room'ga qo'shiladi
  socket.on("join_restaurant", async (data) => {
    const restaurantId = typeof data === "object" ? data.restaurantId : data;
    const staffId = typeof data === "object" ? data.staffId : null;

    if (restaurantId) {
      // Agar staffId berilgan bo'lsa, isWorking tekshirish
      if (staffId) {
        const staff = await Staff.findById(staffId);
        if (staff && staff.role === "waiter" && !staff.isWorking) {
          console.log(
            `Waiter ${staffId} (isWorking=false) blocked from joining restaurant_${restaurantId}`,
          );
          return;
        }
      }

      socket.join(`restaurant_${restaurantId}`);
      socket.join(`kitchen_${restaurantId}`);
      console.log(
        `Socket joined restaurant_${restaurantId} and kitchen_${restaurantId}`,
      );
    }
  });

  // Kassir room ga qo'shilish
  socket.on("join_cashier", (data) => {
    const restaurantId = typeof data === "object" ? data.restaurantId : data;
    if (restaurantId) {
      socket.join(`cashier_${restaurantId}`);
      socket.join("cashier"); // Legacy room
      console.log(`Socket joined cashier_${restaurantId}`);
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
        fromWaiter,
        waiterId: orderWaiterId,
      } = data;

      // Validatsiya
      if (!restaurantId) {
        console.error("Order error: restaurantId is missing");
        socket.emit("get_message", {
          msg: "error",
          error: "Restaurant ID topilmadi",
        });
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
      // MUHIM: Faqat tasdiqlanMAGAN orderlarga qo'shish mumkin
      // Agar order allaqachon tasdiqlangan bo'lsa - yangi order yaratiladi
      let existingOrder = null;

      // Agar waiterdan kelgan bo'lsa - mavjud ochiq orderga qo'shish mumkin
      // Agar mijozdan kelgan bo'lsa - faqat tasdiqlanmagan orderga qo'shish
      if (fromWaiter) {
        // Waiterdan - istalgan ochiq orderga qo'shish
        existingOrder = await Order.findOne({
          restaurantId,
          tableId,
          status: { $nin: ["paid", "cancelled"] },
        });
      } else {
        // Mijozdan - faqat tasdiqlanmagan orderga qo'shish
        existingOrder = await Order.findOne({
          restaurantId,
          tableId,
          status: { $nin: ["paid", "cancelled"] },
          waiterApproved: { $ne: true }, // Faqat tasdiqlanmagan
        });
      }

      let order;
      let kitchenOrder;
      let isNewOrder = false;

      // Yangi itemlarni tayyorlash - allOrders yoki selectFoods dan
      // allOrders - har bir bosishda alohida element (quantity yo'q)
      // selectFoods - unique elementlar (quantity bor bo'lishi kerak)
      const newItems = [];
      const sourceItems =
        selectFoods && Array.isArray(selectFoods) ? selectFoods : [];

      // Agar selectFoods'da quantity to'g'ri bo'lmasa, allOrders'dan hisoblash
      const itemsMap = new Map();

      // Avval selectFoods'ni tekshirish
      let useAllOrders = false;
      if (sourceItems.length > 0) {
        const totalQtyFromSelectFoods = sourceItems.reduce(
          (sum, f) => sum + (f.quantity || f.count || 1),
          0,
        );
        const allOrdersLength = (data.allOrders || []).length;
        // Agar quantity noto'g'ri bo'lsa (masalan, 3 ta qo'shilgan lekin quantity=1)
        if (totalQtyFromSelectFoods < allOrdersLength && allOrdersLength > 0) {
          useAllOrders = true;
        }
      }

      // Food modelidan category olish uchun yordamchi funksiya
      const Food = require("./models/foods");
      const getCategoryForFood = async (foodId) => {
        if (!foodId) return null;
        try {
          const food = await Food.findById(foodId).select("category");
          return food?.category || null;
        } catch (err) {
          console.error(`Error getting category for food ${foodId}:`, err);
          return null;
        }
      };

      if (useAllOrders && data.allOrders && Array.isArray(data.allOrders)) {
        // allOrders'dan guruhlash
        for (const food of data.allOrders) {
          const foodId = food._id || food.id;
          if (itemsMap.has(foodId)) {
            itemsMap.get(foodId).quantity += 1;
          } else {
            // Category yo'q bo'lsa, database'dan olish
            let category = food.category;
            if (!category && foodId) {
              category = await getCategoryForFood(foodId);
            }
            itemsMap.set(foodId, {
              foodId: foodId,
              foodName: food.foodName || food.name,
              category: category, // Category - cook panel uchun
              quantity: 1,
              price: food.price || 0,
              isReady: false,
            });
          }
        }
      } else {
        // selectFoods'dan olish (quantity bilan)
        for (const food of sourceItems) {
          const foodId = food._id || food.id;
          if (itemsMap.has(foodId)) {
            itemsMap.get(foodId).quantity += food.quantity || food.count || 1;
          } else {
            // Category yo'q bo'lsa, database'dan olish
            let category = food.category;
            if (!category && foodId) {
              category = await getCategoryForFood(foodId);
            }
            itemsMap.set(foodId, {
              foodId: foodId,
              foodName: food.foodName || food.name,
              category: category, // Category - cook panel uchun
              quantity: food.quantity || food.count || 1,
              price: food.price || 0,
              isReady: false,
            });
          }
        }
      }

      // Map'dan array'ga o'tkazish
      itemsMap.forEach((item) => newItems.push(item));

      console.log(
        "New items with categories:",
        newItems.map((i) => ({ name: i.foodName, category: i.category })),
      );

      // Agar mijozdan kelgan bo'lsa (fromWaiter=false), waiter tasdiqlashi kerak
      // Agar waiterdan kelgan bo'lsa (fromWaiter=true), to'g'ridan-to'g'ri kitchen/cashierga boradi
      const needsWaiterApproval = !fromWaiter;

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

        // Agar mijozdan kelgan bo'lsa, tasdiqlash kutilmoqda
        if (needsWaiterApproval) {
          existingOrder.waiterApproved = false;
        }
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
          // Agar mijozdan kelgan bo'lsa, tasdiqlash kutilmoqda
          if (needsWaiterApproval) {
            kitchenOrder.waiterApproved = false;
          }
          await kitchenOrder.save();

          // Mavjud orderga qo'shilganda waiter'ga xabar yuborish
          if (kitchenOrder.waiterId) {
            const waiter = await Staff.findById(kitchenOrder.waiterId);
            if (waiter) {
              console.log(
                `Sending new_order_items to waiter ${waiter._id} (${waiter.firstName})`,
              );
              console.log(`Waiter FCM token exists: ${!!waiter.fcmToken}`);

              // Agar mijozdan kelgan bo'lsa - tasdiqlash so'rovi
              if (needsWaiterApproval) {
                io.to(`waiter_${waiter._id}`).emit("pending_order_approval", {
                  order: kitchenOrder,
                  tableName,
                  tableNumber,
                  newItems: newItems,
                  isAddingToExisting: true,
                  message: `${tableName} dan yangi buyurtma tasdiqlash kutilmoqda!`,
                });

                // Push notification yuborish
                if (waiter.fcmToken) {
                  sendPushNotification(
                    waiter.fcmToken,
                    "Buyurtma tasdiqlash!",
                    `${tableName} dan yangi buyurtma - tasdiqlang!`,
                    {
                      type: "pending_order_approval",
                      orderId: kitchenOrder._id.toString(),
                    },
                  );
                }
              } else {
                // Waiterdan kelgan - oddiy xabar
                io.to(`waiter_${waiter._id}`).emit("new_order_items", {
                  order: kitchenOrder,
                  tableName,
                  tableNumber,
                  newItems: newItems,
                  message: `${tableName} ga yangi buyurtma qo'shildi!`,
                });

                // Push notification yuborish
                if (waiter.fcmToken) {
                  console.log(
                    `Sending push notification for new items to waiter ${waiter._id}`,
                  );
                  sendPushNotification(
                    waiter.fcmToken,
                    "Yangi buyurtma qo'shildi!",
                    `${tableName} ga yangi buyurtma qo'shildi`,
                    {
                      type: "new_order_items",
                      orderId: kitchenOrder._id.toString(),
                    },
                  );
                }
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
          // Agar mijozdan kelgan bo'lsa - tasdiqlanmagan
          waiterApproved: !needsWaiterApproval,
          approvedAt: needsWaiterApproval ? null : new Date(),
        });

        // Ofitsiyantni tayinlash
        // MUHIM: Order DOIM stolga biriktirilgan waiterga borishi kerak
        // Hatto boshqa waiter order bersa ham, stolga biriktirilgan waiterga boradi
        let assignedWaiter = await assignWaiterToOrder(restaurantId, tableId);

        // Agar stolga biriktirilgan waiter topilmasa va waiter app'dan kelgan bo'lsa
        // O'sha waiterni ishlatish (fallback)
        if (!assignedWaiter && fromWaiter && orderWaiterId) {
          assignedWaiter = await Staff.findById(orderWaiterId);
          console.log(
            `No table waiter found, using order creator: ${assignedWaiter?.firstName} (${orderWaiterId})`,
          );
        } else if (assignedWaiter) {
          console.log(
            `Order assigned to table's waiter: ${assignedWaiter?.firstName}`,
          );
        }

        // Order'ga waiter ma'lumotlarini qo'shish
        if (assignedWaiter) {
          order.waiterId = assignedWaiter._id;
          order.waiterName = `${assignedWaiter.firstName} ${assignedWaiter.lastName}`;
          await order.save();
        }

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
          // Agar mijozdan kelgan bo'lsa - tasdiqlanmagan
          waiterApproved: !needsWaiterApproval,
          approvedAt: needsWaiterApproval ? null : new Date(),
        });

        // Ofitsiyantga xabar
        if (assignedWaiter) {
          console.log(
            `Sending notification to waiter ${assignedWaiter._id} (${assignedWaiter.firstName}), needsApproval=${needsWaiterApproval}`,
          );
          console.log(`Waiter FCM token exists: ${!!assignedWaiter.fcmToken}`);

          // Push notification uchun FCM token
          let fcmToken = assignedWaiter.fcmToken;
          if (!fcmToken) {
            const freshWaiter = await Staff.findById(assignedWaiter._id).select(
              "fcmToken",
            );
            fcmToken = freshWaiter?.fcmToken;
            console.log(
              `Fetched fresh FCM token for waiter ${assignedWaiter._id}: ${!!fcmToken}`,
            );
          }

          if (needsWaiterApproval) {
            // Mijozdan kelgan - tasdiqlash so'rovi
            io.to(`waiter_${assignedWaiter._id}`).emit(
              "pending_order_approval",
              {
                order: kitchenOrder,
                tableName,
                tableNumber,
                newItems: newItems,
                isAddingToExisting: false,
                message: `${tableName} dan yangi buyurtma tasdiqlash kutilmoqda!`,
              },
            );

            if (fcmToken) {
              sendPushNotification(
                fcmToken,
                "Buyurtma tasdiqlash!",
                `${tableName} dan yangi buyurtma - tasdiqlang!`,
                {
                  type: "pending_order_approval",
                  orderId: kitchenOrder._id.toString(),
                },
              );
            }
          } else {
            // Waiterdan kelgan - oddiy xabar
            io.to(`waiter_${assignedWaiter._id}`).emit("new_table_assigned", {
              order: kitchenOrder,
              tableName,
              tableNumber,
              message: `${tableName} dan yangi buyurtma keldi!`,
            });

            if (fcmToken) {
              console.log(
                `Sending push notification for new table to waiter ${assignedWaiter._id}`,
              );
              sendPushNotification(
                fcmToken,
                "Yangi buyurtma!",
                `${tableName} dan yangi buyurtma keldi`,
                {
                  type: "new_table_assigned",
                  orderId: kitchenOrder._id.toString(),
                },
              );
            }
          }
        } else {
          console.log(`No waiter assigned for table ${tableName}`);
        }
      }

      // Mijozga javob
      socket.emit("get_message", {
        msg: "success",
        orderId: order._id,
        needsApproval: needsWaiterApproval,
      });

      // MUHIM: Agar mijozdan kelgan bo'lsa va tasdiqlash kerak bo'lsa
      // Kitchen va Cashier ga XABAR YUBORMAYMIZ - waiter tasdiqlagunicha kutamiz
      if (needsWaiterApproval) {
        console.log(
          `Order ${order._id} waiting for waiter approval - NOT sending to kitchen/cashier`,
        );
        // Faqat admin panelga xabar (monitoring uchun)
        io.to(`admin_${restaurantId}`).emit("new_order_pending_approval", {
          order: kitchenOrder,
          tableName,
          tableNumber,
          isNewOrder,
          message: `${tableName} dan yangi buyurtma - waiter tasdiqlashi kutilmoqda`,
        });
        return; // Kitchen va cashierga xabar yubormaymiz
      }

      // ============================================
      // FAQAT WAITER TASDIQLAGAN ORDERLAR UCHUN
      // (fromWaiter=true yoki waiter approve qilgandan keyin)
      // ============================================

      // Admin panel uchun (real-time updates)
      io.to(`admin_${restaurantId}`).emit("new_order", {
        order: kitchenOrder,
        tableName,
        tableNumber,
        isNewOrder,
        message: isNewOrder
          ? `${tableName} dan yangi buyurtma keldi!`
          : `${tableName} ga yangi buyurtma qo'shildi!`,
      });

      // Oshpazlarga xabar - FAQAT TASDIQLANGAN ORDERLAR
      const kitchenOrders = await KitchenOrder.find({
        restaurantId,
        status: { $in: ["pending", "preparing"] },
        waiterApproved: true, // Faqat tasdiqlangan orderlar
      })
        .sort({ createdAt: 1 })
        .populate("waiterId");

      // Har bir oshpazga faqat uning category'lariga tegishli orderlarni yuborish
      await emitFilteredKitchenOrders(
        io,
        restaurantId,
        kitchenOrder,
        kitchenOrders,
        newItems,
        isNewOrder,
      );

      // Kassaga xabar
      io.to(`cashier_${restaurantId}`).emit("new_kitchen_order", {
        order: kitchenOrder,
      });
      io.to("cashier").emit("new_kitchen_order", { order: kitchenOrder }); // Legacy

      // Kassirga yangi buyurtma xabari (order formatida)
      io.to(`cashier_${restaurantId}`).emit("new_order_for_cashier", order);
      io.to("cashier").emit("new_order_for_cashier", order); // Legacy

      // Barcha buyurtmalarni faqat shu restoranga broadcast
      const orders = await Order.find({ restaurantId });
      io.to(`restaurant_${restaurantId}`).emit("get_order", orders);
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
              food.cookingTimeTotal =
                (food.cookingTimeTotal || 0) + cookingTimeSeconds;
              food.averageCookingTime = Math.round(
                food.cookingTimeTotal / food.cookingTimeCount,
              );
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

      // Har bir cook'ga filtrlangan ma'lumot yuborish
      await emitFilteredKitchenOrdersUpdated(
        io,
        order.restaurantId,
        kitchenOrders,
      );

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
            items: [
              {
                foodName: item.foodName,
                quantity: item.quantity,
                isReady: true,
              },
            ],
          });
        } catch (saveErr) {
          console.error("WaiterNotification save error:", saveErr);
        }

        const notificationData = {
          notificationId: savedNotification
            ? savedNotification._id.toString()
            : null,
          orderId: order._id.toString(),
          tableName: order.tableName,
          tableNumber: order.tableNumber || 0,
          message: `${order.tableName}: ${item.foodName} tayyor!`,
          items: [
            {
              foodName: item.foodName,
              quantity: item.quantity,
              isReady: true,
            },
          ],
          allReady: allReady,
        };

        // Socket orqali yuborish
        io.to(`waiter_${order.waiterId}`).emit(
          "order_ready_notification",
          notificationData,
        );
        console.log(
          `Item ready notification sent to waiter_${order.waiterId}: ${item.foodName}, notificationId: ${notificationData.notificationId}`,
        );
      }

      // Cashier ga item status o'zgarganini xabar berish
      io.to(`cashier_${order.restaurantId}`).emit("item_status_updated", {
        orderId: order._id,
        itemIndex,
        itemName: item.foodName,
        isReady: item.isReady,
        status: order.status,
        allReady: allReady,
      });
      io.to("cashier").emit("item_status_updated", {
        orderId: order._id,
        itemIndex,
        itemName: item.foodName,
        isReady: item.isReady,
        status: order.status,
        allReady: allReady,
      }); // Legacy

    } catch (error) {
      console.error("Item ready error:", error);
    }
  });

  // Qisman tayyor qilish (partial ready) - yangi event
  socket.on("partial_item_ready", async (data) => {
    try {
      const { orderId, itemIndex, readyCount, restaurantId } = data;
      const order = await KitchenOrder.findById(orderId);

      if (!order) return;

      const item = order.items[itemIndex];
      if (!item) return;

      const currentReadyQuantity = item.readyQuantity || 0;
      const newReadyQuantity = currentReadyQuantity + readyCount;

      // Umumiy sondan oshib ketmasligi kerak
      if (newReadyQuantity > item.quantity) {
        console.error(`Partial ready error: readyQuantity (${newReadyQuantity}) exceeds quantity (${item.quantity})`);
        return;
      }

      // readyQuantity ni yangilash
      item.readyQuantity = newReadyQuantity;

      // Agar hammasi tayyor bo'lsa
      if (newReadyQuantity >= item.quantity) {
        item.isReady = true;
        item.readyAt = new Date();
        // Tayyorlash vaqtini hisoblash
        const addedAt = item.addedAt || order.createdAt;
        const cookingTimeSeconds = Math.floor((Date.now() - new Date(addedAt).getTime()) / 1000);
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
      }

      // Order statusini yangilash
      const allReady = order.items.every((i) => i.isReady);
      const someReady = order.items.some((i) => (i.readyQuantity || 0) > 0);

      order.allItemsReady = allReady;

      if (allReady) {
        order.status = "ready";
      } else if (someReady) {
        order.status = "preparing";
      } else {
        order.status = "pending";
      }

      await order.save();

      // Yangilangan ma'lumotni yuborish
      const kitchenOrders = await KitchenOrder.find({
        restaurantId: order.restaurantId,
        status: { $in: ["pending", "preparing", "ready"] },
        $or: [
          { waiterApproved: true },
          { waiterApproved: { $exists: false } }
        ]
      })
        .sort({ createdAt: 1 })
        .populate("waiterId");

      // Har bir cook'ga filtrlangan ma'lumot yuborish
      await emitFilteredKitchenOrdersUpdated(io, order.restaurantId, kitchenOrders);

      // Waiter'ga notification yuborish - qisman tayyor haqida
      if (order.waiterId) {
        const isFullyReady = newReadyQuantity >= item.quantity;
        const message = isFullyReady
          ? `${order.tableName}: ${item.foodName} (${item.quantity}x) to'liq tayyor!`
          : `${order.tableName}: ${item.foodName} - ${readyCount}x tayyor (${newReadyQuantity}/${item.quantity})`;

        // Bazaga saqlash
        let savedNotification = null;
        try {
          savedNotification = await WaiterNotification.create({
            waiterId: order.waiterId,
            restaurantId: order.restaurantId,
            orderId: order._id,
            type: "food_ready",
            tableName: order.tableName,
            tableNumber: order.tableNumber || 0,
            message: message,
            items: [{
              foodName: item.foodName,
              quantity: readyCount,
              totalQuantity: item.quantity,
              readyQuantity: newReadyQuantity,
              isReady: isFullyReady,
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
          message: message,
          items: [{
            foodName: item.foodName,
            quantity: readyCount,
            totalQuantity: item.quantity,
            readyQuantity: newReadyQuantity,
            isReady: isFullyReady,
          }],
          allReady: allReady,
          isPartialReady: !isFullyReady,
        };

        io.to(`waiter_${order.waiterId}`).emit("order_ready_notification", notificationData);
        console.log(`Partial ready notification sent to waiter_${order.waiterId}: ${readyCount}x ${item.foodName} (${newReadyQuantity}/${item.quantity})`);

        // Push notification
        const waiter = await Staff.findById(order.waiterId);
        if (waiter?.fcmToken) {
          sendPushNotification(
            waiter.fcmToken,
            isFullyReady ? "Taom tayyor!" : "Qisman tayyor!",
            message,
            { type: "partial_ready", orderId: order._id.toString() }
          );
        }
      }

      // Cashierga item status o'zgarganini xabar berish
      io.to(`cashier_${order.restaurantId}`).emit("item_status_updated", {
        orderId: order._id,
        itemIndex,
        itemName: item.foodName,
        readyQuantity: newReadyQuantity,
        totalQuantity: item.quantity,
        isReady: item.isReady,
        status: order.status,
        allReady: allReady,
      });
      io.to("cashier").emit("item_status_updated", {
        orderId: order._id,
        itemIndex,
        itemName: item.foodName,
        readyQuantity: newReadyQuantity,
        totalQuantity: item.quantity,
        isReady: item.isReady,
        status: order.status,
        allReady: allReady,
      }); // Legacy

    } catch (error) {
      console.error("Partial item ready error:", error);
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
            { type: "order_ready", orderId: order._id.toString() },
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
        kitchenOrders,
      );
      io.to("kitchen").emit("kitchen_orders_updated", kitchenOrders); // Legacy
    } catch (error) {
      console.error("Notify waiter error:", error);
    }
  });

  // =====================================================
  // WAITER TOMONIDAN BUYURTMANI TASDIQLASH
  // Mijozdan kelgan buyurtmani waiter tasdiqlaydi
  // =====================================================
  socket.on("approve_order", async (data) => {
    try {
      const { orderId, waiterId } = data;
      console.log(`Waiter ${waiterId} approving order ${orderId}`);

      const kitchenOrder = await KitchenOrder.findById(orderId);
      if (!kitchenOrder) {
        socket.emit("approve_order_response", {
          success: false,
          error: "Buyurtma topilmadi",
        });
        return;
      }

      // Order allaqachon tasdiqlangan
      if (kitchenOrder.waiterApproved) {
        socket.emit("approve_order_response", {
          success: false,
          error: "Buyurtma allaqachon tasdiqlangan",
        });
        return;
      }

      // KitchenOrderni tasdiqlash
      kitchenOrder.waiterApproved = true;
      kitchenOrder.approvedAt = new Date();
      await kitchenOrder.save();

      // Order modelini ham tasdiqlash
      await Order.findByIdAndUpdate(kitchenOrder.orderId, {
        waiterApproved: true,
        approvedAt: new Date(),
      });

      const restaurantId = kitchenOrder.restaurantId;
      const tableName = kitchenOrder.tableName;
      const tableNumber = kitchenOrder.tableNumber;

      // Waiter'ga tasdiqlash xabari
      socket.emit("approve_order_response", {
        success: true,
        orderId: kitchenOrder._id,
      });

      // ENDI Kitchen va Cashier ga xabar yuboramiz
      console.log(`Order ${orderId} approved - sending to kitchen and cashier`);

      // Oshpazlarga xabar
      const kitchenOrders = await KitchenOrder.find({
        restaurantId,
        status: { $in: ["pending", "preparing"] },
        waiterApproved: true,
      })
        .sort({ createdAt: 1 })
        .populate("waiterId");

      // Har bir oshpazga faqat uning category'lariga tegishli orderlarni yuborish
      await emitFilteredKitchenOrders(
        io,
        restaurantId,
        kitchenOrder,
        kitchenOrders,
        kitchenOrder.items,
        true,
      );

      // Kassaga xabar
      const order = await Order.findById(kitchenOrder.orderId);
      io.to(`cashier_${restaurantId}`).emit("new_kitchen_order", {
        order: kitchenOrder,
      });
      io.to("cashier").emit("new_kitchen_order", { order: kitchenOrder });

      io.to(`cashier_${restaurantId}`).emit("new_order_for_cashier", order);
      io.to("cashier").emit("new_order_for_cashier", order);

      // Admin panel uchun
      io.to(`admin_${restaurantId}`).emit("new_order", {
        order: kitchenOrder,
        tableName,
        tableNumber,
        isNewOrder: true,
        message: `${tableName} dan buyurtma tasdiqlandi!`,
      });

      // Barcha buyurtmalarni broadcast
      const orders = await Order.find({ restaurantId });
      io.to(`restaurant_${restaurantId}`).emit("get_order", orders);

      console.log(`Order ${orderId} approved and sent to kitchen/cashier`);
    } catch (error) {
      console.error("Approve order error:", error);
      socket.emit("approve_order_response", {
        success: false,
        error: error.message,
      });
    }
  });

  // =====================================================
  // WAITER TOMONIDAN BUYURTMANI RAD ETISH
  // Mijozdan kelgan buyurtmani waiter rad etadi
  // =====================================================
  socket.on("reject_order", async (data) => {
    try {
      const { orderId, waiterId, reason } = data;
      console.log(
        `Waiter ${waiterId} rejecting order ${orderId}, reason: ${reason}`,
      );

      const kitchenOrder = await KitchenOrder.findById(orderId);
      if (!kitchenOrder) {
        socket.emit("reject_order_response", {
          success: false,
          error: "Buyurtma topilmadi",
        });
        return;
      }

      // Order allaqachon tasdiqlangan
      if (kitchenOrder.waiterApproved) {
        socket.emit("reject_order_response", {
          success: false,
          error: "Tasdiqlangan buyurtmani rad etib bo'lmaydi",
        });
        return;
      }

      const restaurantId = kitchenOrder.restaurantId;
      const tableName = kitchenOrder.tableName;
      const tableNumber = kitchenOrder.tableNumber;
      const orderObjId = kitchenOrder.orderId;
      const tableId = kitchenOrder.tableId;

      // KitchenOrderni rad etilgan deb belgilash
      kitchenOrder.waiterRejected = true;
      kitchenOrder.rejectionReason = reason || "Waiter tomonidan rad etildi";
      await kitchenOrder.save();

      // Order modelini ham rad etilgan deb belgilash va statusni cancelled qilish
      await Order.findByIdAndUpdate(orderObjId, {
        waiterRejected: true,
        rejectionReason: reason || "Waiter tomonidan rad etildi",
        status: "cancelled",
      });

      // Stolni bo'shatish
      if (tableId) {
        await Table.findByIdAndUpdate(tableId, {
          status: "free",
        });
      }

      // Waiter'ga tasdiqlash xabari
      socket.emit("reject_order_response", {
        success: true,
        orderId: kitchenOrder._id,
      });

      // Mijozga xabar yuborish (agar session bo'lsa)
      const order = await Order.findById(orderObjId);
      if (order && order.sessionId) {
        io.to(`session_${order.sessionId}`).emit("order_rejected", {
          orderId: orderObjId,
          kitchenOrderId: kitchenOrder._id,
          tableName,
          reason: reason || "Buyurtma rad etildi",
          message: `Buyurtmangiz rad etildi: ${reason || "Waiter tomonidan rad etildi"}`,
        });
      }

      // Admin panel uchun
      io.to(`admin_${restaurantId}`).emit("order_rejected", {
        order: kitchenOrder,
        tableName,
        tableNumber,
        reason: reason || "Waiter tomonidan rad etildi",
        message: `${tableName} dan buyurtma rad etildi`,
      });

      console.log(`Order ${orderId} rejected by waiter`);
    } catch (error) {
      console.error("Reject order error:", error);
      socket.emit("reject_order_response", {
        success: false,
        error: error.message,
      });
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
        kitchenOrders,
      );
      io.to("kitchen").emit("kitchen_orders_updated", kitchenOrders); // Legacy
      io.to(`cashier_${order.restaurantId}`).emit(
        "kitchen_orders_updated",
        kitchenOrders,
      );
      io.to("cashier").emit("kitchen_orders_updated", kitchenOrders); // Legacy

      // Ofitsiyantga tasdiqlash
      if (order.waiterId) {
        io.to(`waiter_${order.waiterId}`).emit("order_served_confirmed", {
          orderId: order._id,
        });
      }

      // Cashierga food status o'zgarganini xabar berish
      io.to(`cashier_${order.restaurantId}`).emit("food_status_changed", {
        orderId: order._id,
        status: "served",
        tableName: order.tableName,
      });
      io.to("cashier").emit("food_status_changed", {
        orderId: order._id,
        status: "served",
        tableName: order.tableName,
      }); // Legacy

      // Barcha itemlar yetkazildi - order completed
      io.to(`cashier_${order.restaurantId}`).emit("order_completed", {
        orderId: order._id,
        tableName: order.tableName,
      });
      io.to("cashier").emit("order_completed", {
        orderId: order._id,
        tableName: order.tableName,
      }); // Legacy

    } catch (error) {
      console.error("Order served error:", error);
    }
  });

  // Kassa to'lov
  socket.on("mark_paid", async (data) => {
    try {
      const { orderId, paymentMethod, paymentSplit, comment, debtInfo } = data;
      const order = await KitchenOrder.findById(orderId);

      if (!order) return;

      order.isPaid = true;
      order.paidAt = new Date();
      order.paymentMethod = paymentMethod || "cash";
      if (debtInfo) {
        order.debtInfo = debtInfo;
      }
      await order.save();

      // Taomlar summasini hisoblash va 10% xizmat haqi qo'shish
      const itemsTotal = order.items.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0,
      );
      const serviceFee = Math.round(itemsTotal * 0.1);
      const grandTotal = itemsTotal + serviceFee;

      // Order statusini ham yangilash - split payment va comment bilan
      const updateData = {
        status: "paid",
        isPaid: true,
        paidAt: new Date(),
        paymentType: paymentMethod || "cash",
        totalPrice: grandTotal, // 10% xizmat haqi bilan
        ofitsianService: serviceFee
      };

      // Bo'lingan to'lov (split payment)
      if (paymentSplit) {
        updateData.paymentSplit = {
          cash: paymentSplit.cash || 0,
          card: paymentSplit.card || 0,
          click: paymentSplit.click || 0,
        };
      }

      // To'lov izohi
      if (comment) {
        updateData.comment = comment;
      }

      await Order.findByIdAndUpdate(order.orderId, updateData);

      // Stolni bo'shatish va waiter'ni o'chirish
      if (order.tableId) {
        await Table.findByIdAndUpdate(order.tableId, {
          status: "free",
          assignedWaiterId: null,
        });
      }

      // To'lovni SaveOrder ga saqlash - 10% bilan
      const totalPrice = grandTotal;

      let paymentStatus = "Naqt toladi";
      if (paymentMethod === "card") {
        paymentStatus = "Plastik Karta";
      } else if (paymentMethod === "click") {
        paymentStatus = "Click";
      } else if (paymentMethod === "debt") {
        paymentStatus = "Qarz";
      } else if (paymentSplit) {
        // Bo'lingan to'lov
        const parts = [];
        if (paymentSplit.cash > 0) parts.push(`Naqd: ${paymentSplit.cash}`);
        if (paymentSplit.card > 0) parts.push(`Karta: ${paymentSplit.card}`);
        if (paymentSplit.click > 0) parts.push(`Click: ${paymentSplit.click}`);
        paymentStatus = parts.join(", ");
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
      }); // Legacy

      const kitchenOrders = await KitchenOrder.find({
        restaurantId: order.restaurantId,
        status: { $in: ["pending", "preparing", "ready"] },
      })
        .sort({ createdAt: 1 })
        .populate("waiterId");

      io.to(`kitchen_${order.restaurantId}`).emit(
        "kitchen_orders_updated",
        kitchenOrders,
      );
      io.to("kitchen").emit("kitchen_orders_updated", kitchenOrders); // Legacy
    } catch (error) {
      console.error("Mark paid error:", error);
    }
  });

  // Kassir to'lovni tasdiqlash (cashier-electron uchun)
  socket.on("confirm_payment", async (data) => {
    try {
      const { orderId, paymentType, restaurantId, cashierId } = data;
      console.log("Confirm payment:", data);

      // Order ni topish va yangilash
      const order = await Order.findById(orderId);
      if (!order) {
        socket.emit("payment_confirmed", {
          success: false,
          error: "Buyurtma topilmadi",
        });
        return;
      }

      // Taomlar summasini hisoblash va 10% xizmat haqi qo'shish
      const itemsTotal = (order.selectFoods || order.allOrders || []).reduce((sum, item) => {
        return sum + ((item.price || 0) * (item.quantity || item.count || 1));
      }, 0);
      const serviceFee = Math.round(itemsTotal * 0.1);
      const grandTotal = itemsTotal + serviceFee;

      order.isPaid = true;
      order.paidAt = new Date();
      order.paymentType = paymentType || "cash";
      order.cashierId = cashierId;
      order.status = "paid";
      order.totalPrice = grandTotal; // 10% xizmat haqi bilan
      order.ofitsianService = serviceFee;
      await order.save();

      // Stolni bo'shatish
      if (order.tableId) {
        await Table.findByIdAndUpdate(order.tableId, {
          status: "free",
          assignedWaiterId: null,
        });
      }

      // KitchenOrder ni ham yangilash
      await KitchenOrder.updateMany(
        { orderId: order._id },
        { isPaid: true, paidAt: new Date(), paymentMethod: paymentType },
      );

      // Kassirga tasdiqlash
      socket.emit("payment_confirmed", { success: true, orderId });

      // Boshqa kassirlar uchun order_paid event
      io.to(`cashier_${restaurantId}`).emit("order_paid", {
        orderId: order._id,
        paymentType: paymentType,
      });
      io.to("cashier").emit("order_paid", { orderId: order._id, paymentType }); // Legacy

      console.log(`Payment confirmed for order ${orderId}`);
    } catch (error) {
      console.error("Confirm payment error:", error);
      socket.emit("payment_confirmed", {
        success: false,
        error: error.message,
      });
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
        socket.emit("call_waiter_response", {
          success: false,
          error: "Stol topilmadi",
        });
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
        socket.emit("call_waiter_response", {
          success: false,
          error: "Hozirda bo'sh ofitsiyant yo'q",
        });
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
        console.log(
          `WaiterNotification saved for waiter_call: ${tableName || table.title}, id: ${savedNotification._id}`,
        );
      } catch (saveErr) {
        console.error("WaiterNotification save error (waiter_call):", saveErr);
      }

      // Waiter'ga notification yuborish - notificationId bilan
      io.to(`waiter_${waiter._id}`).emit("waiter_called", {
        notificationId: savedNotification
          ? savedNotification._id.toString()
          : null,
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
          { type: "waiter_called", tableId },
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
      socket.emit("call_waiter_response", {
        success: false,
        error: error.message,
      });
    }
  });

  // Buyurtmani bekor qilish
  // - Mijoz (my-orders): faqat tayyorlanmoqda statusida va isReady=false bo'lsa
  // - Admin: barcha taomlarni bekor qilishi mumkin (hech qanday cheklov yo'q)
  socket.on("cancel_order_item", async (data) => {
    try {
      const { orderId, itemIndex, sessionId, fromAdmin } = data;

      const kitchenOrder = await KitchenOrder.findById(orderId);
      if (!kitchenOrder) {
        socket.emit("cancel_order_response", {
          success: false,
          error: "Buyurtma topilmadi",
        });
        return;
      }

      const item = kitchenOrder.items[itemIndex];
      if (!item) {
        socket.emit("cancel_order_response", {
          success: false,
          error: "Item topilmadi",
        });
        return;
      }

      // Admin uchun - barcha taomlarni bekor qilish mumkin (hech qanday cheklov yo'q)
      if (fromAdmin) {
        console.log(
          `Admin cancelling item: ${item.foodName} from order ${orderId}`,
        );
      } else {
        // Mijoz uchun - faqat pending yoki preparing statusda bekor qilish mumkin
        if (
          kitchenOrder.status === "ready" ||
          kitchenOrder.status === "served"
        ) {
          socket.emit("cancel_order_response", {
            success: false,
            error: "Bu buyurtmani bekor qilib bo'lmaydi",
          });
          return;
        }

        // Agar item tayyor bo'lsa - mijoz bekor qila olmaydi
        if (item.isReady) {
          socket.emit("cancel_order_response", {
            success: false,
            error: "Tayyor bo'lgan ovqatni bekor qilib bo'lmaydi",
          });
          return;
        }
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
      const newTotalPrice = kitchenOrder.items.reduce(
        (sum, i) => sum + (i.price || 0) * (i.quantity || 1),
        0,
      );
      kitchenOrder.totalPrice = newTotalPrice;

      // Agar barcha itemlar o'chirilgan bo'lsa - orderni to'liq o'chirish
      if (kitchenOrder.items.length === 0) {
        // KitchenOrder va Order'ni to'liq o'chirish
        await Order.findByIdAndDelete(kitchenOrder.orderId);
        await KitchenOrder.findByIdAndDelete(kitchenOrder._id);
        console.log(
          `Order ${orderId} to'liq o'chirildi - barcha itemlar bekor qilindi`,
        );
      } else {
        // Order totalPrice ni ham yangilash
        await Order.findByIdAndUpdate(kitchenOrder.orderId, {
          totalPrice: newTotalPrice,
        });
        await kitchenOrder.save();
      }

      // Oshxonaga xabar
      const kitchenOrders = await KitchenOrder.find({
        restaurantId: kitchenOrder.restaurantId,
        status: { $in: ["pending", "preparing", "ready"] },
      })
        .sort({ createdAt: 1 })
        .populate("waiterId");

      io.to(`kitchen_${kitchenOrder.restaurantId}`).emit(
        "kitchen_orders_updated",
        kitchenOrders,
      );
      io.to("kitchen").emit("kitchen_orders_updated", kitchenOrders); // Legacy

      // Waiter (ofitsiant) tomonga ham xabar - restoran room orqali
      io.to(`restaurant_${kitchenOrder.restaurantId}`).emit(
        "kitchen_orders_updated",
        kitchenOrders,
      );

      // Kassir tomonga xabar
      io.to(`cashier_${kitchenOrder.restaurantId}`).emit(
        "kitchen_orders_updated",
        kitchenOrders,
      );
      io.to("cashier").emit("kitchen_orders_updated", kitchenOrders); // Legacy
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
        itemIndex, // Deduplication uchun
        newTotalPrice,
        itemsCount: kitchenOrder.items.length,
        cancelledItem,
        tableName: kitchenOrder.tableName,
        restaurantId: kitchenOrder.restaurantId,
      };

      // Kitchen (cook-panel) ga yuborish
      io.to(`kitchen_${kitchenOrder.restaurantId}`).emit(
        "order_item_cancelled",
        cancelEventData,
      );
      io.to("kitchen").emit("order_item_cancelled", cancelEventData); // Legacy

      // My-orders (mijoz) uchun - faqat tegishli sessiyaga
      if (sessionId) {
        io.to(`session_${sessionId}`).emit(
          "order_item_cancelled",
          cancelEventData,
        );
      }

      socket.emit("cancel_order_response", { success: true, newTotalPrice });
    } catch (error) {
      console.error("Cancel order error:", error);
      socket.emit("cancel_order_response", {
        success: false,
        error: error.message,
      });
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
          const kitchenOrder = await KitchenOrder.findOne({
            orderId: order._id,
          });
          return {
            ...order.toObject(),
            kitchenOrderId: kitchenOrder ? kitchenOrder._id : null,
            kitchenStatus: kitchenOrder ? kitchenOrder.status : "pending",
            items: kitchenOrder ? kitchenOrder.items : [],
          };
        }),
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
        { isOnline: false, socketId: null },
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
    const restaurants = await Staff.find();
    res.status(200).json({ status: "success", data: restaurants });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
