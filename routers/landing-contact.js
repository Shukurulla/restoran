const express = require("express");
const router = express.Router();
const LandingContact = require("../models/landing-contact");

// Yangi kontakt yaratish (landing page uchun - autentifikatsiyasiz)
router.post("/landing-contacts", async (req, res) => {
  try {
    const { fullName, phone, message, plan, source } = req.body;

    if (!fullName || !phone) {
      return res.status(400).json({
        status: "error",
        message: "Ism va telefon raqam kiritilishi shart",
      });
    }

    const contact = await LandingContact.create({
      fullName,
      phone,
      message: message || null,
      plan: plan || null,
      source: source || "contact_form",
    });

    res.status(201).json({
      status: "success",
      message: "So'rov muvaffaqiyatli yuborildi",
      data: contact,
    });
  } catch (error) {
    console.error("Landing contact error:", error);
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
});

// Barcha kontaktlarni olish (super admin uchun)
router.get("/landing-contacts", async (req, res) => {
  try {
    const { status, source, page = 1, limit = 20 } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (source) filter.source = source;

    const skip = (page - 1) * limit;

    const contacts = await LandingContact.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await LandingContact.countDocuments(filter);

    res.status(200).json({
      status: "success",
      data: contacts,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
});

// Kontakt statusini yangilash
router.patch("/landing-contacts/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const contact = await LandingContact.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    if (!contact) {
      return res.status(404).json({
        status: "error",
        message: "Kontakt topilmadi",
      });
    }

    res.status(200).json({
      status: "success",
      data: contact,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
});

// Kontaktni o'chirish
router.delete("/landing-contacts/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const contact = await LandingContact.findByIdAndDelete(id);

    if (!contact) {
      return res.status(404).json({
        status: "error",
        message: "Kontakt topilmadi",
      });
    }

    res.status(200).json({
      status: "success",
      message: "Kontakt o'chirildi",
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
});

module.exports = router;
