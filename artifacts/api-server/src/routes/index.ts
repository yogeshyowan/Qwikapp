import { Router, type IRouter } from "express";
import healthRouter from "./health";
import projectsRouter from "./projects";
import anthropicRouter from "./anthropic";
import authRouter from "./auth";
import billingRouter from "./billing";

const router: IRouter = Router();

router.use(authRouter);
router.use(billingRouter);
router.use(healthRouter);
router.use(projectsRouter);
router.use(anthropicRouter);

export default router;
