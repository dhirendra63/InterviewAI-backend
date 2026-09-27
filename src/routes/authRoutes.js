import express from "express";
import passport from "../config/passport.js";

import {
  googleCallback,
  getMe,
  updateProfile,
  logout,
} from "../controllers/authControllers.js";

import protect from "../middleware/authMiddleware.js";

const router = express.Router();

router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    session: false,
  })
);

router.get(
  "/google/callback",
  passport.authenticate("google", {
    failureRedirect: "http://localhost:5173/login",
    session: false,
  }),
  googleCallback
);

router.get("/me", protect, getMe);

router.patch(
  "/profile",
  protect,
  updateProfile
);

router.post("/logout", logout);

export default router;