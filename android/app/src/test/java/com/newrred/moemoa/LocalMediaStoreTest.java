package com.newrred.moemoa;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import java.io.File;
import java.nio.file.Files;
import java.util.Map;
import org.junit.Test;

public class LocalMediaStoreTest {

    @Test
    public void promotesPendingFilesToAnOpaquePermanentAsset() throws Exception {
        Fixture fixture = fixture();

        LocalMediaAsset asset = fixture.media.promote("ticket-1", "asset-1");

        assertEquals("asset:asset-1", asset.getLocalRef());
        assertEquals("a".repeat(64), asset.getChecksumSha256());
        assertTrue(new File(fixture.mediaRoot, "asset-1.original").isFile());
        assertTrue(new File(fixture.mediaRoot, "asset-1.preview.jpg").isFile());
        assertTrue(new File(fixture.mediaRoot, "asset-1.media").isFile());
        assertFalse(fixture.pending.find("ticket-1").isPresent());

        Map<String, Object> publicValue = asset.toMap();
        assertFalse(publicValue.toString().contains(fixture.mediaRoot.getAbsolutePath()));
        assertFalse(publicValue.toString().contains("content://"));
        assertFalse(publicValue.containsKey("originalFileName"));
        assertFalse(publicValue.containsKey("previewFileName"));
    }

    @Test
    public void promotionIsIdempotentAfterPendingTicketWasRemoved() throws Exception {
        Fixture fixture = fixture();

        LocalMediaAsset first = fixture.media.promote("ticket-1", "asset-1");
        LocalMediaAsset second = fixture.media.promote("ticket-1", "asset-1");

        assertEquals(first, second);
    }

    @Test
    public void failedPromotionKeepsPendingTicketAndLeavesNoReadablePermanentAsset() throws Exception {
        Fixture fixture = fixture();
        assertTrue(new File(fixture.mediaRoot, "asset-1.preview.jpg.tmp").mkdirs());

        try {
            fixture.media.promote("ticket-1", "asset-1");
            fail("Promotion should fail when a destination is obstructed");
        } catch (ImageIntakeException expected) {
            assertEquals("MEDIA_PROMOTION_FAILED", expected.getCode());
        }

        assertTrue(fixture.pending.find("ticket-1").isPresent());
        assertTrue(new File(fixture.pendingRoot, "ticket-1.original").isFile());
        assertTrue(new File(fixture.pendingRoot, "ticket-1.preview.jpg").isFile());
        assertFalse(new File(fixture.mediaRoot, "asset-1.media").isFile());
        assertFalse(fixture.media.find("asset:asset-1").isPresent());
    }

    @Test(expected = ImageIntakeException.class)
    public void rejectsAssetIdThatCouldEscapePermanentDirectory() throws Exception {
        Fixture fixture = fixture();
        fixture.media.promote("ticket-1", "../outside");
    }

    @Test
    public void deleteRemovesEveryPermanentFileAndIsIdempotent() throws Exception {
        Fixture fixture = fixture();
        LocalMediaAsset asset = fixture.media.promote("ticket-1", "asset-1");

        assertTrue(fixture.media.delete(asset.getLocalRef()));
        assertFalse(new File(fixture.mediaRoot, "asset-1.original").exists());
        assertFalse(new File(fixture.mediaRoot, "asset-1.preview.jpg").exists());
        assertFalse(new File(fixture.mediaRoot, "asset-1.media").exists());
        assertTrue(fixture.media.delete(asset.getLocalRef()));
    }

    private static Fixture fixture() throws Exception {
        File pendingRoot = Files.createTempDirectory("moemoa-pending").toFile();
        File mediaRoot = Files.createTempDirectory("moemoa-media").toFile();
        PendingIntakeStore pending = new PendingIntakeStore(pendingRoot);
        Files.write(new File(pendingRoot, "ticket-1.original").toPath(), new byte[] { 1, 2, 3, 4 });
        Files.write(new File(pendingRoot, "ticket-1.preview.jpg").toPath(), new byte[] { 5, 6, 7 });
        pending.save(new PendingIntakeTicket(
            "ticket-1",
            "ticket-1.original",
            "ticket-1.preview.jpg",
            "image/png",
            4L,
            "a".repeat(64),
            800,
            450,
            100L
        ));
        return new Fixture(pendingRoot, mediaRoot, pending, new LocalMediaStore(pendingRoot, mediaRoot, pending));
    }

    private static final class Fixture {
        final File pendingRoot;
        final File mediaRoot;
        final PendingIntakeStore pending;
        final LocalMediaStore media;

        Fixture(File pendingRoot, File mediaRoot, PendingIntakeStore pending, LocalMediaStore media) {
            this.pendingRoot = pendingRoot;
            this.mediaRoot = mediaRoot;
            this.pending = pending;
            this.media = media;
        }
    }
}
