import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import chatRouter from "./chat";
import feedbackRouter from "./feedback";
import adminRouter from "./admin";
import userRouter from "./user";
import configRouter from "./config";

const router: IRouter = Router();

router.use(healthRouter);
router.use(configRouter);
router.use(authRouter);
router.use(chatRouter);
router.use(feedbackRouter);
router.use(adminRouter);
router.use(userRouter);

export default router;
