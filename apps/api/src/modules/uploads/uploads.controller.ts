import { BadRequestException, Controller, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { diskStorage } from 'multer';
import { ok } from '../../common/response';
import { uploadPublicUrl, uploadRoot } from './upload-paths';

const allowedMimeTypes = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
  ['image/gif', '.gif'],
]);

function dateFolder() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}${month}${day}`;
}

@Controller('uploads')
export class UploadsController {
  @Post('submission-screenshots')
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_request, file, callback) => {
      if (!allowedMimeTypes.has(file.mimetype)) return callback(new BadRequestException('Only jpg, png, webp and gif images are supported'), false);
      callback(null, true);
    },
    storage: diskStorage({
      destination: (_request, _file, callback) => {
        const folder = join(uploadRoot(), 'submission-screenshots', dateFolder());
        if (!existsSync(folder)) mkdirSync(folder, { recursive: true });
        callback(null, folder);
      },
      filename: (_request, file, callback) => {
        callback(null, `${Date.now()}-${randomUUID()}${allowedMimeTypes.get(file.mimetype) ?? '.jpg'}`);
      },
    }),
  }))
  uploadSubmissionScreenshot(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('Please choose a screenshot to upload');
    const relativePath = relative(uploadRoot(), file.path).replace(/\\/g, '/');
    return ok({
      url: uploadPublicUrl(relativePath),
      filename: file.filename,
      mimeType: file.mimetype,
      size: file.size,
    });
  }
}
