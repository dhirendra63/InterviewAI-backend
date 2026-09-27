import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    orderId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    paymentId: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 1,
    },

    credits: {
      type: Number,
      required: true,
      min: 1,
    },

    plan: {
      type: String,
      enum: ["starter", "pro", "premium"],
      required: true,
    },

    status: {
      type: String,
      enum: ["created", "paid", "failed"],
      default: "created",
      index: true,
    },

    creditsApplied: {
      type: Boolean,
      default: false,
      index: true,
    },

    creditTransactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CreditTransaction",
      default: null,
    },

    verifiedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Payment", paymentSchema);