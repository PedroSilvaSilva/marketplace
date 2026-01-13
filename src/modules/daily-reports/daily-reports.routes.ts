import { Router, Request, Response } from 'express';
import { asyncHandler } from '@utils/response';
import { authenticate } from '@middlewares/auth';
import { DailyReportService } from '@services/daily-report.service';
import { AppError } from '@utils/errors';

const router = Router();

// Apply authentication to all routes
router.use(authenticate);

/**
 * @swagger
 * /daily-reports/send:
 *   post:
 *     summary: Send daily success report immediately (manual)
 *     tags: [Daily Reports]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               date:
 *                 type: string
 *                 format: date
 *                 description: Date for the report (default is today)
 *     responses:
 *       200:
 *         description: Report sent successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post('/send', asyncHandler(async (req: Request, res: Response) => {
  const { date } = req.body;
  
  const reportDate = date ? new Date(date) : new Date();
  
  await DailyReportService.sendDailySuccessReport(reportDate);

  res.json({
    success: true,
    message: 'Daily success report sent successfully',
    date: reportDate
  });
}));

/**
 * @swagger
 * /daily-reports/preview:
 *   get:
 *     summary: Get preview of daily report without sending email
 *     tags: [Daily Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *         description: Date for the report (default is today)
 *     responses:
 *       200:
 *         description: Report preview data
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/preview', asyncHandler(async (req: Request, res: Response) => {
  const { date } = req.query;
  
  const reportDate = date ? new Date(date as string) : new Date();
  
  const preview = await DailyReportService.getReportPreview(reportDate);

  res.json({
    success: true,
    data: preview
  });
}));

export default router;
