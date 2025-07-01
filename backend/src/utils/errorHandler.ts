import { Response } from 'express';

export function handleApiError(res: Response, error: any, defaultMsg = 'Internal server error') {
  console.error(error);
  res.status(500).json({
    success: false,
    message: error.message || defaultMsg,
  });
} 