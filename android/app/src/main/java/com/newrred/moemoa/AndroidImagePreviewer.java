package com.newrred.moemoa;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.util.regex.Pattern;

final class AndroidImagePreviewer implements PreviewGenerator {
    private static final Pattern SAFE_TICKET_ID = Pattern.compile("[A-Za-z0-9][A-Za-z0-9_-]{0,63}");
    private static final Pattern SAFE_FILE_NAME = Pattern.compile("[A-Za-z0-9][A-Za-z0-9._-]{0,127}");

    private final File root;
    private final int maxDimension;
    private final int jpegQuality;

    AndroidImagePreviewer(File root, int maxDimension, int jpegQuality) {
        this.root = root;
        this.maxDimension = maxDimension;
        this.jpegQuality = jpegQuality;
    }

    @Override
    public PreviewImage create(String ticketId, String stagedFileName) throws ImageIntakeException {
        String previewFileName = previewFileNameFor(ticketId);
        File source = privateFile(stagedFileName);
        File destination = privateFile(previewFileName);
        File partial = privateFile(previewFileName + ".part");

        if (destination.exists() || partial.exists()) {
            throw new ImageIntakeException("TICKET_CONFLICT", "A preview already exists for this ticket");
        }

        Bitmap decoded = null;
        Bitmap scaled = null;
        boolean completed = false;
        try {
            BitmapFactory.Options bounds = new BitmapFactory.Options();
            bounds.inJustDecodeBounds = true;
            BitmapFactory.decodeFile(source.getAbsolutePath(), bounds);
            if (bounds.outWidth <= 0 || bounds.outHeight <= 0) {
                throw new ImageIntakeException("IMAGE_DECODE_FAILED", "Unable to decode image bounds");
            }

            BitmapFactory.Options options = new BitmapFactory.Options();
            options.inSampleSize = PreviewSampleSize.forBounds(
                bounds.outWidth,
                bounds.outHeight,
                maxDimension
            );
            decoded = BitmapFactory.decodeFile(source.getAbsolutePath(), options);
            if (decoded == null) {
                throw new ImageIntakeException("IMAGE_DECODE_FAILED", "Unable to decode image preview");
            }

            scaled = scaleDown(decoded);
            try (FileOutputStream output = new FileOutputStream(partial)) {
                if (!scaled.compress(Bitmap.CompressFormat.JPEG, jpegQuality, output)) {
                    throw new ImageIntakeException("PREVIEW_WRITE_FAILED", "Unable to encode image preview");
                }
                output.getFD().sync();
            }

            if (!partial.renameTo(destination)) {
                throw new ImageIntakeException("PREVIEW_WRITE_FAILED", "Unable to finalize image preview");
            }
            completed = true;
            return new PreviewImage(previewFileName, bounds.outWidth, bounds.outHeight);
        } catch (ImageIntakeException exception) {
            throw exception;
        } catch (IOException exception) {
            throw new ImageIntakeException("PREVIEW_WRITE_FAILED", "Unable to write image preview", exception);
        } catch (OutOfMemoryError error) {
            throw new ImageIntakeException("IMAGE_TOO_COMPLEX", "Image is too large to preview", error);
        } finally {
            if (scaled != null && scaled != decoded) scaled.recycle();
            if (decoded != null) decoded.recycle();
            if (!completed) {
                partial.delete();
                destination.delete();
            }
        }
    }

    static String previewFileNameFor(String ticketId) throws ImageIntakeException {
        if (ticketId == null || !SAFE_TICKET_ID.matcher(ticketId).matches()) {
            throw new ImageIntakeException("INVALID_TICKET", "Unsafe ticket id");
        }
        return ticketId + ".preview.jpg";
    }

    private Bitmap scaleDown(Bitmap source) {
        int width = source.getWidth();
        int height = source.getHeight();
        int largest = Math.max(width, height);
        if (largest <= maxDimension) return source;

        float scale = (float) maxDimension / (float) largest;
        int targetWidth = Math.max(1, Math.round(width * scale));
        int targetHeight = Math.max(1, Math.round(height * scale));
        return Bitmap.createScaledBitmap(source, targetWidth, targetHeight, true);
    }

    private File privateFile(String fileName) throws ImageIntakeException {
        if (fileName == null || !SAFE_FILE_NAME.matcher(fileName).matches()) {
            throw new ImageIntakeException("INVALID_PRIVATE_FILE", "Unsafe private file name");
        }
        return new File(root, fileName);
    }
}
