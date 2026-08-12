package com.newrred.moemoa;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

final class ImageStager {
    private static final Pattern SAFE_TICKET_ID = Pattern.compile("[A-Za-z0-9][A-Za-z0-9_-]{0,63}");
    private static final Set<String> SUPPORTED_MIME_TYPES = new HashSet<>(
        Arrays.asList("image/jpeg", "image/png", "image/webp")
    );

    private final File root;
    private final long maxBytes;

    ImageStager(File root, long maxBytes) {
        this.root = root;
        this.maxBytes = maxBytes;
    }

    StagedOriginal stage(String ticketId, String mimeType, InputStream source) throws ImageIntakeException {
        validateTicketId(ticketId);
        validateMimeType(mimeType);
        ensureRoot();

        String fileName = ticketId + ".original";
        File destination = new File(root, fileName);
        File partial = new File(root, fileName + ".part");
        if (destination.exists() || partial.exists()) {
            throw new ImageIntakeException("TICKET_CONFLICT", "A staged file already exists for this ticket");
        }

        MessageDigest digest = sha256();
        long byteSize = 0L;
        boolean completed = false;

        try {
            try (InputStream input = source; FileOutputStream output = new FileOutputStream(partial)) {
                byte[] buffer = new byte[64 * 1024];
                int read;
                while ((read = input.read(buffer)) != -1) {
                    byteSize += read;
                    if (byteSize > maxBytes) {
                        throw new ImageIntakeException("IMAGE_TOO_LARGE", "Image exceeds the private intake limit");
                    }
                    output.write(buffer, 0, read);
                    digest.update(buffer, 0, read);
                }
                output.getFD().sync();
            }

            if (!partial.renameTo(destination)) {
                throw new ImageIntakeException("STAGING_WRITE_FAILED", "Unable to finalize staged image");
            }
            completed = true;
            return new StagedOriginal(fileName, byteSize, toHex(digest.digest()));
        } catch (ImageIntakeException exception) {
            throw exception;
        } catch (IOException exception) {
            throw new ImageIntakeException("IMAGE_READ_FAILED", "Unable to read shared image", exception);
        } finally {
            if (!completed) {
                partial.delete();
                destination.delete();
            }
        }
    }

    private void validateTicketId(String ticketId) throws ImageIntakeException {
        if (ticketId == null || !SAFE_TICKET_ID.matcher(ticketId).matches()) {
            throw new ImageIntakeException("INVALID_TICKET", "Unsafe ticket id");
        }
    }

    private void validateMimeType(String mimeType) throws ImageIntakeException {
        String normalized = mimeType == null ? "" : mimeType.toLowerCase(Locale.ROOT);
        if (!SUPPORTED_MIME_TYPES.contains(normalized)) {
            throw new ImageIntakeException("UNSUPPORTED_IMAGE_TYPE", "Only JPEG, PNG, and WebP images are supported");
        }
    }

    private void ensureRoot() throws ImageIntakeException {
        if (!root.exists() && !root.mkdirs()) {
            throw new ImageIntakeException("STORAGE_UNAVAILABLE", "Unable to create private intake directory");
        }
        if (!root.isDirectory()) {
            throw new ImageIntakeException("STORAGE_UNAVAILABLE", "Private intake path is not a directory");
        }
    }

    private static MessageDigest sha256() throws ImageIntakeException {
        try {
            return MessageDigest.getInstance("SHA-256");
        } catch (NoSuchAlgorithmException exception) {
            throw new ImageIntakeException("HASH_UNAVAILABLE", "SHA-256 is unavailable", exception);
        }
    }

    private static String toHex(byte[] bytes) {
        StringBuilder hex = new StringBuilder(bytes.length * 2);
        for (byte value : bytes) {
            hex.append(String.format(Locale.ROOT, "%02x", value & 0xff));
        }
        return hex.toString();
    }
}
