import { Router, type IRouter } from "express";
import healthRouter from "./health";
import medicinesRouter from "./medicines";
import foodLogsRouter from "./foodLogs";
import groceryRouter from "./grocery";
import profileRouter from "./profile";
import recipesRouter from "./recipes";
import summaryRouter from "./summary";
import drugsRouter from "./drugs";
import parseScanRouter from "./parseScan";
import dietChartRouter from "./dietChart";

const router: IRouter = Router();

router.use(healthRouter);
router.use(medicinesRouter);
router.use(foodLogsRouter);
router.use(groceryRouter);
router.use(profileRouter);
router.use(recipesRouter);
router.use(summaryRouter);
router.use(drugsRouter);
router.use(parseScanRouter);
router.use(dietChartRouter);

export default router;
