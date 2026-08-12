package com.newrred.moemoa;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.util.Optional;
import java.util.Properties;
import java.util.regex.Pattern;

final class LocalMediaStore {
    private static final Pattern SAFE_ASSET_ID = Pattern.compile("[A-Za-z0-9][A-Za-z0-9_-]{0,63}");
    private static final String LOCAL_REF_PREFIX = "asset:";

    private final File pendingRoot;
    private final File mediaRoot;
    private final PendingIntakeStore pendingStore;

    LocalMediaStore(File pendingRoot, File mediaRoot, PendingIntakeStore pendingStore) {
        this.pendingRoot = pendingRoot;
        this.mediaRoot = mediaRoot;
        this.pendingStore = pendingStore;
    }

    synchronized LocalMediaAsset promote(String ticketId, String assetId) throws ImageIntakeException {
        requireAssetId(assetId);
        Optional<LocalMediaAsset> existing = findByAssetId(assetId);
        if (existing.isPresent()) return existing.get();

        final PendingIntakeTicket ticket;
        try {
            ticket = pendingStore.find(ticketId).orElseThrow(() ->
                new ImageIntakeException("MEDIA_TICKET_NOT_FOUND", "Pending image is no longer available")
            );
        } catch (IllegalArgumentException exception) {
            throw new ImageIntakeException("INVALID_TICKET", "Unsafe pending image ticket", exception);
        } catch (IOException exception) {
            throw new ImageIntakeException("TICKET_READ_FAILED", "Unable to read pending image", exception);
        }

        File sourceOriginal = new File(pendingRoot, ticket.getStagedFileName());
        File sourcePreview = new File(pendingRoot, ticket.getPreviewFileName());
        if (!sourceOriginal.isFile() || sourceOriginal.length() != ticket.getByteSize() || !sourcePreview.isFile()) {
            throw new ImageIntakeException("MEDIA_TICKET_CORRUPT", "Pending image files are incomplete");
        }

        ensureMediaRoot();
        File original = originalFile(assetId);
        File preview = previewFile(assetId);
        File metadata = metadataFile(assetId);
        File originalTemp = tempFile(original);
        File previewTemp = tempFile(preview);
        File metadataTemp = tempFile(metadata);

        try {
            copyDurably(sourceOriginal, originalTemp);
            copyDurably(sourcePreview, previewTemp);
            writeMetadata(metadataTemp, assetId, ticket);
            replace(originalTemp, original);
            replace(previewTemp, preview);
            replace(metadataTemp, metadata);
        } catch (IOException exception) {
            deleteRegularFile(originalTemp);
            deleteRegularFile(previewTemp);
            deleteRegularFile(metadataTemp);
            deleteRegularFile(original);
            deleteRegularFile(preview);
            deleteRegularFile(metadata);
            throw new ImageIntakeException(
                "MEDIA_PROMOTION_FAILED",
                "Unable to preserve image in private storage",
                exception
            );
        }

        try {
            pendingStore.discard(ticketId);
        } catch (IOException | IllegalArgumentException ignored) {
            // The permanent metadata is the commit marker. Staging cleanup can be retried later.
        }
        return new LocalMediaAsset(
            assetId,
            ticket.getChecksumSha256(),
            ticket.getMimeType(),
            ticket.getByteSize(),
            ticket.getWidth(),
            ticket.getHeight()
        );
    }

    synchronized Optional<LocalMediaAsset> find(String localRef) throws ImageIntakeException {
        String value = localRef == null ? "" : localRef;
        if (!value.startsWith(LOCAL_REF_PREFIX)) {
            throw new ImageIntakeException("INVALID_LOCAL_REF", "Unknown private media reference");
        }
        return findByAssetId(value.substring(LOCAL_REF_PREFIX.length()));
    }

    synchronized File previewFileFor(String localRef) throws ImageIntakeException {
        Optional<LocalMediaAsset> asset = find(localRef);
        if (!asset.isPresent()) {
            throw new ImageIntakeException("MEDIA_NOT_FOUND", "Private media preview is unavailable");
        }
        return previewFile(localRef.substring(LOCAL_REF_PREFIX.length()));
    }

    synchronized boolean delete(String localRef) throws ImageIntakeException {
        String value = localRef == null ? "" : localRef;
        if (!value.startsWith(LOCAL_REF_PREFIX)) {
            throw new ImageIntakeException("INVALID_LOCAL_REF", "Unknown private media reference");
        }
        String assetId = value.substring(LOCAL_REF_PREFIX.length());
        requireAssetId(assetId);
        try {
            deleteIfPresent(originalFile(assetId));
            deleteIfPresent(previewFile(assetId));
            deleteIfPresent(metadataFile(assetId));
            deleteIfPresent(tempFile(originalFile(assetId)));
            deleteIfPresent(tempFile(previewFile(assetId)));
            deleteIfPresent(tempFile(metadataFile(assetId)));
            return true;
        } catch (IOException exception) {
            throw new ImageIntakeException("MEDIA_DELETE_FAILED", "Unable to delete private media", exception);
        }
    }

    private Optional<LocalMediaAsset> findByAssetId(String assetId) throws ImageIntakeException {
        requireAssetId(assetId);
        File metadata = metadataFile(assetId);
        if (!metadata.isFile() || !originalFile(assetId).isFile() || !previewFile(assetId).isFile()) {
            return Optional.empty();
        }

        Properties properties = new Properties();
        try (FileInputStream input = new FileInputStream(metadata)) {
            properties.load(input);
            if (!assetId.equals(required(properties, "assetId"))) {
                throw new IOException("Asset id does not match metadata file");
            }
            return Optional.of(new LocalMediaAsset(
                assetId,
                required(properties, "checksumSha256"),
                required(properties, "mimeType"),
                Long.parseLong(required(properties, "byteSize")),
                Integer.parseInt(required(properties, "width")),
                Integer.parseInt(required(properties, "height"))
            ));
        } catch (IOException | IllegalArgumentException exception) {
            throw new ImageIntakeException("MEDIA_METADATA_INVALID", "Private media metadata is invalid", exception);
        }
    }

    private void writeMetadata(File destination, String assetId, PendingIntakeTicket ticket) throws IOException {
        Properties properties = new Properties();
        properties.setProperty("assetId", assetId);
        properties.setProperty("checksumSha256", ticket.getChecksumSha256());
        properties.setProperty("mimeType", ticket.getMimeType());
        properties.setProperty("byteSize", Long.toString(ticket.getByteSize()));
        properties.setProperty("width", Integer.toString(ticket.getWidth()));
        properties.setProperty("height", Integer.toString(ticket.getHeight()));
        try (FileOutputStream output = new FileOutputStream(destination)) {
            properties.store(output, null);
            output.getFD().sync();
        }
    }

    private static void copyDurably(File source, File destination) throws IOException {
        try (FileInputStream input = new FileInputStream(source);
            FileOutputStream output = new FileOutputStream(destination)) {
            byte[] buffer = new byte[32 * 1024];
            int read;
            while ((read = input.read(buffer)) != -1) output.write(buffer, 0, read);
            output.getFD().sync();
        }
    }

    private static void replace(File source, File destination) throws IOException {
        if (destination.exists() && (!destination.isFile() || !destination.delete())) {
            throw new IOException("Unable to replace private media destination");
        }
        if (!source.renameTo(destination)) {
            throw new IOException("Unable to finalize private media file");
        }
    }

    private void ensureMediaRoot() throws ImageIntakeException {
        if ((!mediaRoot.exists() && !mediaRoot.mkdirs()) || !mediaRoot.isDirectory()) {
            throw new ImageIntakeException("MEDIA_STORAGE_UNAVAILABLE", "Private media storage is unavailable");
        }
    }

    private File originalFile(String assetId) {
        return new File(mediaRoot, assetId + ".original");
    }

    private File previewFile(String assetId) {
        return new File(mediaRoot, assetId + ".preview.jpg");
    }

    private File metadataFile(String assetId) {
        return new File(mediaRoot, assetId + ".media");
    }

    private static File tempFile(File destination) {
        return new File(destination.getParentFile(), destination.getName() + ".tmp");
    }

    private static void requireAssetId(String assetId) throws ImageIntakeException {
        if (assetId == null || !SAFE_ASSET_ID.matcher(assetId).matches()) {
            throw new ImageIntakeException("INVALID_ASSET_ID", "Unsafe private media asset id");
        }
    }

    private static String required(Properties properties, String key) throws IOException {
        String value = properties.getProperty(key);
        if (value == null || value.isEmpty()) throw new IOException("Missing " + key);
        return value;
    }

    private static void deleteRegularFile(File file) {
        if (file.isFile()) file.delete();
    }


    private static void deleteIfPresent(File file) throws IOException {
        if (file.exists() && (!file.isFile() || !file.delete())) {
            throw new IOException("Unable to delete private media file");
        }
    }
}
