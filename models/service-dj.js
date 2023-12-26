const mongoose = require("mongoose");

const ServiceDJ = mongoose.model("ServiceDJ", {
  serviceDosage: {
    type: Number,
    required: true,
  },
});

module.exports = ServiceDJ;
