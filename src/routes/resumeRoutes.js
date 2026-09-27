import express from "express";
import multer from "multer";
import path from "path";
import protect from "../middleware/authMiddleware.js";

import {
  uploadResume,
  getResumes,
  getResume,
  deleteResume,
} from "../controllers/resumeController.js";

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/resumes");
  },
  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();

    const uniqueName = `${Date.now()}-${Math.round(
      Math.random() * 1e9
    )}${extension}`;

    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const extension = path
      .extname(file.originalname)
      .toLowerCase();

    const allowedMimeTypes = [
      "application/pdf",
    ];

    if (
      extension !== ".pdf" ||
      !allowedMimeTypes.includes(file.mimetype)
    ) {
      return cb(
        new Error("Only valid PDF files are allowed")
      );
    }

    cb(null, true);
  },
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },
});

router.use(protect);

router.post(
  "/",
  upload.single("resume"),
  uploadResume
);

router.get("/", getResumes);

router.get("/:id", getResume);

router.delete("/:id", deleteResume);

export default router;