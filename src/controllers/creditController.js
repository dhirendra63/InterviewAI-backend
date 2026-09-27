import User from "../models/User.js";
import CreditTransaction from "../models/CreditTransaction.js";

export const getCredits = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select(
      "credits isPremium premiumExpiresAt"
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      credits: user.credits ?? 0,
      isPremium: Boolean(user.isPremium),
      premiumExpiresAt: user.premiumExpiresAt || null,
    });
  } catch (error) {
    console.error("Get credits error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch credits",
    });
  }
};

export const getCreditTransactions = async (req, res) => {
  try {
    const transactions = await CreditTransaction.find({
      userId: req.user._id,
    })
      .sort({ createdAt: -1 })
      .limit(100)
      .populate("interviewId", "role mode duration")
      .populate("paymentId", "orderId paymentId plan amount");

    res.status(200).json({
      success: true,
      transactions,
    });
  } catch (error) {
    console.error(
      "Get credit transactions error:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Failed to fetch credit transactions",
    });
  }
};