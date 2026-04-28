import rateLimit from "express-rate-limit";

export const chatRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "rate_limit_exceeded", message: "Too many requests, please try again in a minute" },
});
