package com.newrred.moemoa;

import android.content.ContentResolver;
import android.content.Context;
import android.net.Uri;
import android.util.Base64;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

final class ImageIntakeRuntime {
    private static final long MAX_ORIGINAL_BYTES = 20L * 1024L * 1024L;
    private static final int MAX_PREVIEW_DIMENSION = 1024;
    private static final int MAX_PREVIEW_BYTES = 2 * 1024 * 1024;
    private static final int PREVIEW_JPEG_QUALITY = 82;
    private static volatile ImageIntakeRuntime instance;

    private final ContentResolver contentResolver;
    private final File root;
    private final LocalMediaStore localMediaStore;
    private final PendingIntakeStore store;
    private final ImageIntakeCoordinator coordinator;
    private final ExecutorService executor;
    private final AtomicInteger processingCount = new AtomicInteger();
    private final AtomicReference<String> lastErrorCode = new AtomicReference<>();

    private ImageIntakeRuntime(Context context) {
        Context applicationContext = context.getApplicationContext();
        contentResolver = applicationContext.getContentResolver();
        root = new File(applicationContext.getFilesDir(), "moemoa-intake");
        store = new PendingIntakeStore(root);
        localMediaStore = new LocalMediaStore(
            root,
            new File(applicationContext.getFilesDir(), "moemoa-media"),
            store
        );
        coordinator = new ImageIntakeCoordinator(
            root,
            store,
            new ImageStager(root, MAX_ORIGINAL_BYTES),
            new AndroidImagePreviewer(root, MAX_PREVIEW_DIMENSION, PREVIEW_JPEG_QUALITY),
            () -> UUID.randomUUID().toString(),
            System::currentTimeMillis
        );
        executor = Executors.newSingleThreadExecutor(runnable -> {
            Thread thread = new Thread(runnable, "moemoa-image-intake");
            thread.setDaemon(true);
            return thread;
        });
    }

    static ImageIntakeRuntime get(Context context) {
        ImageIntakeRuntime current = instance;
        if (current != null) return current;

        synchronized (ImageIntakeRuntime.class) {
            if (instance == null) instance = new ImageIntakeRuntime(context);
            return instance;
        }
    }

    CompletableFuture<PendingIntakeTicket> capture(Uri uri, String hintedMimeType) {
        CompletableFuture<PendingIntakeTicket> future = new CompletableFuture<>();
        if (uri == null || !ImageShareIntentPolicy.acceptsSourceScheme(uri.getScheme())) {
            ImageIntakeException exception = new ImageIntakeException(
                "UNSUPPORTED_SOURCE_URI",
                "Only permission-scoped content images can be imported"
            );
            recordErrorCode(exception.getCode());
            future.completeExceptionally(exception);
            return future;
        }

        processingCount.incrementAndGet();
        executor.execute(() -> {
            try {
                String mimeType = selectMimeType(contentResolver.getType(uri), hintedMimeType);
                InputStream input = contentResolver.openInputStream(uri);
                if (input == null) {
                    throw new ImageIntakeException("IMAGE_READ_FAILED", "Unable to open selected image");
                }
                PendingIntakeTicket ticket = coordinator.capture(mimeType, input);
                lastErrorCode.set(null);
                future.complete(ticket);
            } catch (ImageIntakeException exception) {
                recordErrorCode(exception.getCode());
                future.completeExceptionally(exception);
            } catch (IOException | SecurityException exception) {
                ImageIntakeException safe = new ImageIntakeException(
                    "IMAGE_READ_FAILED",
                    "Unable to read selected image",
                    exception
                );
                recordErrorCode(safe.getCode());
                future.completeExceptionally(safe);
            } finally {
                processingCount.decrementAndGet();
            }
        });
        return future;
    }

    Optional<PublicIntakeTicket> claimPublicTicket() throws ImageIntakeException {
        try {
            Optional<PendingIntakeTicket> pending = store.claimOldest();
            if (!pending.isPresent()) return Optional.empty();
            PendingIntakeTicket ticket = pending.get();
            return Optional.of(toPublicTicket(ticket));
        } catch (IOException exception) {
            throw new ImageIntakeException("TICKET_READ_FAILED", "Unable to read pending image", exception);
        }
    }

    PublicIntakeTicket toPublicTicket(PendingIntakeTicket ticket) throws ImageIntakeException {
        return PublicIntakeTicket.from(ticket, readPreviewDataUrl(ticket));
    }

    boolean discard(String ticketId) throws ImageIntakeException {
        try {
            return store.discard(ticketId);
        } catch (IllegalArgumentException exception) {
            throw new ImageIntakeException("INVALID_TICKET", "Unsafe ticket id", exception);
        } catch (IOException exception) {
            throw new ImageIntakeException("DISCARD_FAILED", "Unable to remove pending image", exception);
        }
    }

    LocalMediaAsset promote(String ticketId, String assetId) throws ImageIntakeException {
        return localMediaStore.promote(ticketId, assetId);
    }

    String readAssetPreviewDataUrl(String localRef) throws ImageIntakeException {
        return readPreviewDataUrl(localMediaStore.previewFileFor(localRef));
    }

    boolean deleteAsset(String localRef) throws ImageIntakeException {
        return localMediaStore.delete(localRef);
    }

    boolean isProcessing() {
        return processingCount.get() > 0;
    }

    String consumeLastErrorCode() {
        return lastErrorCode.getAndSet(null);
    }

    void recordErrorCode(String code) {
        lastErrorCode.set(code);
    }

    void execute(Runnable runnable) {
        executor.execute(runnable);
    }

    private String readPreviewDataUrl(PendingIntakeTicket ticket) throws ImageIntakeException {
        return readPreviewDataUrl(new File(root, ticket.getPreviewFileName()));
    }

    private String readPreviewDataUrl(File preview) throws ImageIntakeException {
        long length = preview.length();
        if (length <= 0L || length > MAX_PREVIEW_BYTES) {
            throw new ImageIntakeException("PREVIEW_UNAVAILABLE", "Pending image preview is unavailable");
        }

        try (FileInputStream input = new FileInputStream(preview);
            ByteArrayOutputStream output = new ByteArrayOutputStream((int) length)) {
            byte[] buffer = new byte[32 * 1024];
            int read;
            int total = 0;
            while ((read = input.read(buffer)) != -1) {
                total += read;
                if (total > MAX_PREVIEW_BYTES) {
                    throw new ImageIntakeException("PREVIEW_UNAVAILABLE", "Pending image preview is too large");
                }
                output.write(buffer, 0, read);
            }
            String encoded = Base64.encodeToString(output.toByteArray(), Base64.NO_WRAP);
            return "data:image/jpeg;base64," + encoded;
        } catch (ImageIntakeException exception) {
            throw exception;
        } catch (IOException exception) {
            throw new ImageIntakeException("PREVIEW_UNAVAILABLE", "Unable to read pending image preview", exception);
        }
    }

    private static String selectMimeType(String resolved, String hinted) {
        String preferred = normalizeMimeType(resolved);
        if (preferred != null && !"image/*".equals(preferred)) return preferred;
        String fallback = normalizeMimeType(hinted);
        return fallback == null ? "" : fallback;
    }

    private static String normalizeMimeType(String value) {
        if (value == null) return null;
        String normalized = value.toLowerCase(Locale.ROOT);
        return "image/jpg".equals(normalized) ? "image/jpeg" : normalized;
    }
}
