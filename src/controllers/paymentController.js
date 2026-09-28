import crypto from "crypto";
import Razorpay from "razorpay";

import User from "../models/User.js";
import Payment from "../models/Payment.js";
import CreditTransaction from "../models/CreditTransaction.js";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const plans = {
  starter: {
    amount: 99,
    credits: 10,
  },
  pro: {
    amount: 199,
    credits: 25,
  },
  premium: {
    amount: 399,
    credits: 60,
  },
};

export const createOrder = async (req, res) => {
  try {
    const { plan } = req.body;

    if (!plan || !plans[plan]) {
      return res.status(400).json({
        success: false,
        message: "Invalid plan",
      });
    }

    const selectedPlan = plans[plan];

    const order = await razorpay.orders.create({
      amount: selectedPlan.amount * 100,
      currency: "INR",
      receipt: `interviewai_${req.user._id}_${Date.now()}`,
      notes: {
        userId: String(req.user._id),
        plan,
        credits: String(selectedPlan.credits),
      },
    });

    const payment = await Payment.create({
      userId: req.user._id,
      orderId: order.id,
      amount: selectedPlan.amount,
      credits: selectedPlan.credits,
      plan,
      status: "created",
      creditsApplied: false,
    });

    return res.status(201).json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
      paymentId: payment._id,
      plan,
      credits: selectedPlan.credits,
      order: {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
      },
    });
  } catch (error) {
    console.error("Create Razorpay order error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create payment order",
    });
  }
};

export const verifyPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    if (
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature
    ) {
      return res.status(400).json({
        success: false,
        message: "Payment verification data is incomplete",
      });
    }

    let paymentRecord = await Payment.findOne({
      orderId: razorpay_order_id,
      userId: req.user._id,
    });

    if (!paymentRecord) {
      return res.status(404).json({
        success: false,
        message: "Payment order not found",
      });
    }

    if (
      paymentRecord.status === "paid" &&
      paymentRecord.creditsApplied
    ) {
      const user = await User.findById(req.user._id).select(
        "credits isPremium premiumExpiresAt"
      );

      return res.status(200).json({
        success: true,
        message: "Payment already verified",
        alreadyVerified: true,
        credits: user?.credits ?? 0,
        isPremium: Boolean(user?.isPremium),
        premiumExpiresAt: user?.premiumExpiresAt || null,
      });
    }

    const generatedSignature = crypto
      .createHmac(
        "sha256",
        process.env.RAZORPAY_KEY_SECRET
      )
      .update(
        `${razorpay_order_id}|${razorpay_payment_id}`
      )
      .digest("hex");

    if (generatedSignature !== razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment signature",
      });
    }

    const razorpayOrder =
      await razorpay.orders.fetch(razorpay_order_id);

    if (razorpayOrder.id !== razorpay_order_id) {
      return res.status(400).json({
        success: false,
        message: "Invalid Razorpay order",
      });
    }

    if (
      Number(razorpayOrder.amount) !==
      Number(paymentRecord.amount * 100)
    ) {
      return res.status(400).json({
        success: false,
        message: "Order amount mismatch",
      });
    }

    const razorpayPayment =
      await razorpay.payments.fetch(
        razorpay_payment_id
      );

    if (
      razorpayPayment.order_id !==
      razorpay_order_id
    ) {
      return res.status(400).json({
        success: false,
        message: "Payment order mismatch",
      });
    }

    if (razorpayPayment.status !== "captured") {
      return res.status(400).json({
        success: false,
        message: "Payment has not been captured",
      });
    }

    if (
      Number(razorpayPayment.amount) !==
      Number(paymentRecord.amount * 100)
    ) {
      return res.status(400).json({
        success: false,
        message: "Payment amount mismatch",
      });
    }

    if (
      paymentRecord.paymentId &&
      paymentRecord.paymentId !== razorpay_payment_id
    ) {
      return res.status(400).json({
        success: false,
        message: "Payment ID mismatch",
      });
    }

    const claimedPayment =
      await Payment.findOneAndUpdate(
        {
          _id: paymentRecord._id,
          userId: req.user._id,
          status: "created",
        },
        {
          $set: {
            paymentId: razorpay_payment_id,
            status: "paid",
            verifiedAt: new Date(),
          },
        },
        {
          new: true,
        }
      );

    if (!claimedPayment) {
      paymentRecord = await Payment.findById(
        paymentRecord._id
      );

      const user = await User.findById(
        req.user._id
      ).select(
        "credits isPremium premiumExpiresAt"
      );

      if (
        paymentRecord?.status === "paid" &&
        paymentRecord?.creditsApplied
      ) {
        return res.status(200).json({
          success: true,
          message: "Payment already verified",
          alreadyVerified: true,
          credits: user?.credits ?? 0,
          isPremium: Boolean(user?.isPremium),
          premiumExpiresAt:
            user?.premiumExpiresAt || null,
        });
      }

      return res.status(409).json({
        success: false,
        message: "Payment verification is already being processed",
      });
    }

    let creditTransaction =
      await CreditTransaction.findOne({
        paymentId: claimedPayment._id,
      });

    if (!creditTransaction) {
      creditTransaction =
        await CreditTransaction.create({
          userId: req.user._id,
          amount: claimedPayment.credits,
          type: "PURCHASE",
          description: `${claimedPayment.plan} plan purchased`,
          paymentId: claimedPayment._id,
        });
    }

    const updatedPayment =
      await Payment.findOneAndUpdate(
        {
          _id: claimedPayment._id,
          status: "paid",
          creditsApplied: false,
        },
        {
          $set: {
            creditTransactionId:
              creditTransaction._id,
          },
        },
        {
          new: true,
        }
      );

    if (!updatedPayment) {
      const existingPayment =
        await Payment.findById(
          claimedPayment._id
        );

      const user = await User.findById(
        req.user._id
      ).select(
        "credits isPremium premiumExpiresAt"
      );

      if (existingPayment?.creditsApplied) {
        return res.status(200).json({
          success: true,
          message: "Payment already verified",
          alreadyVerified: true,
          credits: user?.credits ?? 0,
          isPremium: Boolean(user?.isPremium),
          premiumExpiresAt:
            user?.premiumExpiresAt || null,
        });
      }

      return res.status(409).json({
        success: false,
        message:
          "Payment credit processing is already in progress",
      });
    }

    const user = await User.findOneAndUpdate(
      {
        _id: req.user._id,
      },
      {
        $inc: {
          credits: claimedPayment.credits,
        },
        $set: {
          isPremium: true,
          premiumExpiresAt: new Date(
            Date.now() +
              30 * 24 * 60 * 60 * 1000
          ),
        },
      },
      {
        new: true,
      }
    );

    if (!user) {
      await Payment.findByIdAndUpdate(
        claimedPayment._id,
        {
          $set: {
            creditsApplied: false,
          },
        }
      );

      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    await Payment.findOneAndUpdate(
      {
        _id: claimedPayment._id,
        status: "paid",
        creditsApplied: false,
      },
      {
        $set: {
          creditsApplied: true,
          creditTransactionId:
            creditTransaction._id,
        },
      }
    );

    return res.status(200).json({
      success: true,
      message: "Payment verified successfully",
      alreadyVerified: false,
      credits: user.credits,
      addedCredits: claimedPayment.credits,
      plan: claimedPayment.plan,
      isPremium: user.isPremium,
      premiumExpiresAt:
        user.premiumExpiresAt,
    });
  } catch (error) {
    console.error(
      "Verify payment error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to verify payment",
    });
  }
};