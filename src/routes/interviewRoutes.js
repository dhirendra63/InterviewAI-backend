import express from "express";

import {
  createInterview,
  getInterview,
  getInterviews,
  startInterview,
  cancelInterview,
  submitAnswer,
} from "../controllers/interviewController.js";

import protect from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);

router.post("/", createInterview);
router.get("/", getInterviews);
router.get("/:id", getInterview);
router.patch("/:id/start", startInterview);
router.patch("/:id/cancel", cancelInterview);
router.post("/:id/answer", submitAnswer);

export default router;