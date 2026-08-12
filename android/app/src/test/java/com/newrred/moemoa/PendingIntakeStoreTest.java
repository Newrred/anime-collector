package com.newrred.moemoa;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.util.Optional;
import java.nio.charset.StandardCharsets;
import org.junit.Test;

public class PendingIntakeStoreTest {

    @Test
    public void recoversPendingTicketAcrossStoreInstances() throws Exception {
        File root = Files.createTempDirectory("moemoa-intake").toFile();
        PendingIntakeTicket ticket = new PendingIntakeTicket(
            "ticket-1",
            "ticket-1.original",
            "ticket-1.preview.jpg",
            "image/jpeg",
            4096L,
            "abc123",
            1920,
            1080,
            100L
        );

        new PendingIntakeStore(root).save(ticket);

        Optional<PendingIntakeTicket> recovered = new PendingIntakeStore(root).claimOldest();
        assertTrue(recovered.isPresent());
        assertEquals(ticket, recovered.get());
    }

    @Test
    public void discardRemovesOnlyMatchingTicket() throws Exception {
        File root = Files.createTempDirectory("moemoa-intake").toFile();
        PendingIntakeStore store = new PendingIntakeStore(root);
        Files.write(new File(root, "ticket-1.original").toPath(), new byte[] { 1 });
        Files.write(new File(root, "ticket-1.preview.jpg").toPath(), new byte[] { 2 });
        Files.write(new File(root, "ticket-2.original").toPath(), new byte[] { 3 });
        Files.write(new File(root, "ticket-2.preview.jpg").toPath(), new byte[] { 4 });
        store.save(ticket("ticket-1", 100L));
        store.save(ticket("ticket-2", 200L));

        assertTrue(store.discard("ticket-1"));
        assertFalse(store.find("ticket-1").isPresent());
        assertFalse(new File(root, "ticket-1.original").exists());
        assertFalse(new File(root, "ticket-1.preview.jpg").exists());
        assertTrue(store.find("ticket-2").isPresent());
        assertTrue(new File(root, "ticket-2.original").exists());
        assertTrue(new File(root, "ticket-2.preview.jpg").exists());
    }

    @Test
    public void persistedTicketContainsNoSourceUriOrAbsolutePath() throws Exception {
        File root = Files.createTempDirectory("moemoa-intake").toFile();
        new PendingIntakeStore(root).save(ticket("ticket-1", 100L));

        String persisted = new String(
            Files.readAllBytes(new File(root, "ticket-1.ticket").toPath()),
            StandardCharsets.ISO_8859_1
        );
        assertFalse(persisted.contains("sourceUri"));
        assertFalse(persisted.contains("content://"));
        assertFalse(persisted.contains(root.getAbsolutePath()));
    }

    @Test(expected = IllegalArgumentException.class)
    public void rejectsTicketIdThatCouldEscapePrivateDirectory() throws Exception {
        File root = Files.createTempDirectory("moemoa-intake").toFile();
        new PendingIntakeStore(root).save(
            new PendingIntakeTicket(
                "../outside",
                "outside.original",
                "outside.preview.jpg",
                "image/png",
                1L,
                "abc123",
                1,
                1,
                100L
            )
        );
    }

    @Test
    public void rejectsCorruptedTicketThatReferencesAFileOutsidePrivateIntakeRoot() throws Exception {
        File root = Files.createTempDirectory("moemoa-intake").toFile();
        String corrupted = String.join(
            "\n",
            "ticketId=ticket-1",
            "stagedFileName=../other-private-file",
            "previewFileName=ticket-1.preview.jpg",
            "mimeType=image/jpeg",
            "byteSize=10",
            "checksumSha256=abc123",
            "width=10",
            "height=10",
            "createdAtEpochMs=100",
            ""
        );
        Files.write(
            new File(root, "ticket-1.ticket").toPath(),
            corrupted.getBytes(StandardCharsets.ISO_8859_1)
        );

        try {
            new PendingIntakeStore(root).claimOldest();
            fail("Corrupted ticket should not be recoverable");
        } catch (IOException expected) {
            assertTrue(expected.getMessage().contains("Invalid pending intake ticket"));
        }
    }

    private static PendingIntakeTicket ticket(String ticketId, long createdAtEpochMs) {
        return new PendingIntakeTicket(
            ticketId,
            ticketId + ".original",
            ticketId + ".preview.jpg",
            "image/jpeg",
            4096L,
            "abc123",
            1920,
            1080,
            createdAtEpochMs
        );
    }
}
