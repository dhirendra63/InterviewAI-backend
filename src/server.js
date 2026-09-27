import "dotenv/config";

import express from "express";
import http from "http";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { Server } from "socket.io";
import passport from "./config/passport.js";

import interviewRoutes from "./routes/interviewRoutes.js";
import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import resumeRoutes from "./routes/resumeRoutes.js";
import creditRoutes from "./routes/creditRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import analyticsRoutes from "./routes/analyticsRoutes.js";
import errorMiddleware from "./middleware/errorMiddleware.js";

import jwt from "jsonwebtoken";
import User from "./models/User.js";
import Interview from "./models/Interview.js";

const app = express();
const server = http.createServer(app);

connectDB();

app.use(helmet());

app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
  })
);

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(passport.initialize());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    success: false,
    message: "Too many requests. Please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api", limiter);

app.use("/api/auth", authRoutes);
app.use("/api/resumes", resumeRoutes);
app.use("/api/interviews", interviewRoutes);
app.use("/api/credits", creditRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/analytics", analyticsRoutes);

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "InterviewAI server is running",
  });
});

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL,
    credentials: true,
  },
  transports: ["websocket", "polling"],
});

io.use(async (socket, next) => {
  try {
    const cookieHeader =
      socket.handshake.headers.cookie || "";

    const tokenMatch =
      cookieHeader.match(
        /(?:^|;\s*)token=([^;]+)/
      );

    if (!tokenMatch) {
      return next(
        new Error("Authentication required")
      );
    }

    const token = decodeURIComponent(
      tokenMatch[1]
    );

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    const user = await User.findById(
      decoded.userId
    ).select("_id");

    if (!user) {
      return next(
        new Error("User not found")
      );
    }

    socket.userId = user._id.toString();

    next();
  } catch (error) {
    console.error(
      "Socket authentication failed:",
      error.message
    );

    next(
      new Error("Invalid or expired session")
    );
  }
});

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

socket.on(
  "join-interview",
  async (interviewId) => {
    try {
      if (!interviewId) {
        return;
      }

      const interview =
        await Interview.findOne({
          _id: interviewId,
          userId: socket.userId,
        }).select("_id");

      if (!interview) {
        socket.emit("socket-error", {
          message:
            "You are not authorized to join this interview",
        });

        return;
      }

      const roomName =
        `interview:${interviewId}`;

      socket.join(roomName);

      socket.emit("interview-joined", {
        interviewId,
        room: roomName,
      });

      console.log(
        `Socket ${socket.id} joined ${roomName}`
      );
    } catch (error) {
      console.error(
        "Join interview socket error:",
        error.message
      );

      socket.emit("socket-error", {
        message:
          "Unable to join interview",
      });
    }
  }
);

  socket.on("leave-interview", (interviewId) => {
    if (!interviewId) {
      return;
    }

    const roomName = `interview:${interviewId}`;

    socket.leave(roomName);

    console.log(
      `Socket ${socket.id} left ${roomName}`
    );
  });

  socket.on("interview-status", (data) => {
    if (!data?.interviewId) {
      return;
    }

    const roomName = `interview:${data.interviewId}`;

    socket.to(roomName).emit(
      "interview-status",
      {
        interviewId: data.interviewId,
        status: data.status,
      }
    );
  });

  socket.on("answer-started", (data) => {
    if (!data?.interviewId) {
      return;
    }

    const roomName = `interview:${data.interviewId}`;

    socket.to(roomName).emit(
      "answer-started",
      {
        interviewId: data.interviewId,
      }
    );
  });

  socket.on("answer-submitted", (data) => {
    if (!data?.interviewId) {
      return;
    }

    const roomName = `interview:${data.interviewId}`;

    socket.to(roomName).emit(
      "answer-submitted",
      {
        interviewId: data.interviewId,
        questionId: data.questionId,
      }
    );
  });

  socket.on("disconnect", (reason) => {
    console.log(
      `Socket disconnected: ${socket.id}`,
      reason
    );
  });
});

app.use(errorMiddleware);

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(
    `InterviewAI server running on port ${PORT}`
  );
});