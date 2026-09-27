import express from "express";

import {
  getCredits,
  getCreditTransactions,
} from "../controllers/creditController.js";

import protect from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);

router.get("/", getCredits);
router.get("/transactions", getCreditTransactions);

export default router;