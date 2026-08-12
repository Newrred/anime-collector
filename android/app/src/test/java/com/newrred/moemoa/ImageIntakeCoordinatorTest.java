package com.newrred.moemoa;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.Optional;
import org.junit.Test;

public class ImageIntakeCoordinatorTest {

    @Test
    public void stagesPreviewAndPersistsRecoverableTicket() throws Exception {
        File root = Files.createTempDirectory("moemoa-coordinate").toFile();
        PendingIntakeStore store = new PendingIntakeStore(root);
        PreviewGenerator previewGenerator = (ticketId, stagedFileName) -> {
            String previewFileName = ticketId + ".preview.jpg";
            try {
                Files.write(new File(root, previewFileName).toPath(), new byte[] { 9, 8, 7 });
            } catch (IOException exception) {
                throw new ImageIntakeException("PREVIEW_WRITE_FAILED", "Cannot write preview", exception);
            }
            return new PreviewImage(previewFileName, 1920, 1080);
        };
        ImageIntakeCoordinator coordinator = new ImageIntakeCoordinator(
            root,
            store,
            new ImageStager(root, 1024L),
            previewGenerator,
            () -> "ticket-1",
            () -> 123L
        );

        PendingIntakeTicket captured = coordinator.capture(
            "image/png",
            new ByteArrayInputStream("moemoa".getBytes(StandardCharsets.UTF_8))
        );

        Optional<PendingIntakeTicket> recovered = store.claimOldest();
        assertTrue(recovered.isPresent());
        assertEquals(captured, recovered.get());
        assertEquals("ticket-1.original", captured.getStagedFileName());
        assertEquals("ticket-1.preview.jpg", captured.getPreviewFileName());
        assertEquals(1920, captured.getWidth());
        assertEquals(1080, captured.getHeight());
    }

    @Test
    public void previewFailureLeavesNoTicketOrStagedOriginal() throws Exception {
        File root = Files.createTempDirectory("moemoa-coordinate").toFile();
        PendingIntakeStore store = new PendingIntakeStore(root);
        PreviewGenerator failingPreview = (ticketId, stagedFileName) -> {
            throw new ImageIntakeException("IMAGE_DECODE_FAILED", "Cannot decode image");
        };
        ImageIntakeCoordinator coordinator = new ImageIntakeCoordinator(
            root,
            store,
            new ImageStager(root, 1024L),
            failingPreview,
            () -> "ticket-1",
            () -> 123L
        );

        try {
            coordinator.capture(
                "image/png",
                new ByteArrayInputStream("moemoa".getBytes(StandardCharsets.UTF_8))
            );
        } catch (ImageIntakeException exception) {
            assertEquals("IMAGE_DECODE_FAILED", exception.getCode());
        }

        assertFalse(store.claimOldest().isPresent());
        assertFalse(new File(root, "ticket-1.original").exists());
        assertFalse(new File(root, "ticket-1.preview.jpg").exists());
        assertFalse(new File(root, "ticket-1.ticket").exists());
    }
}
