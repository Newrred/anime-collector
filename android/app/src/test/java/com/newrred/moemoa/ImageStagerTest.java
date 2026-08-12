package com.newrred.moemoa;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import org.junit.Test;

public class ImageStagerTest {

    @Test
    public void copiesSupportedImageIntoPrivateStagingAndHashesIt() throws Exception {
        File root = Files.createTempDirectory("moemoa-stage").toFile();
        byte[] source = "moemoa".getBytes(StandardCharsets.UTF_8);

        StagedOriginal staged = new ImageStager(root, 1024L).stage(
            "ticket-1",
            "image/png",
            new ByteArrayInputStream(source)
        );

        assertEquals("ticket-1.original", staged.getFileName());
        assertEquals(source.length, staged.getByteSize());
        assertEquals("dd0ed3506e74145a24db7398c4cc9b6650bfb2647ad33ea68c778c9636845446", staged.getChecksumSha256());
        assertArrayEquals(source, Files.readAllBytes(new File(root, staged.getFileName()).toPath()));
    }

    @Test
    public void rejectsOversizedImageAndRemovesPartialFiles() throws Exception {
        File root = Files.createTempDirectory("moemoa-stage").toFile();

        try {
            new ImageStager(root, 5L).stage(
                "ticket-1",
                "image/jpeg",
                new ByteArrayInputStream(new byte[] { 1, 2, 3, 4, 5, 6 })
            );
        } catch (ImageIntakeException exception) {
            assertEquals("IMAGE_TOO_LARGE", exception.getCode());
        }

        assertFalse(new File(root, "ticket-1.original").exists());
        assertFalse(new File(root, "ticket-1.original.part").exists());
    }

    @Test
    public void rejectsUnsupportedImageSubtypeBeforeWriting() throws Exception {
        File root = Files.createTempDirectory("moemoa-stage").toFile();

        try {
            new ImageStager(root, 1024L).stage(
                "ticket-1",
                "image/svg+xml",
                new ByteArrayInputStream(new byte[] { 1 })
            );
        } catch (ImageIntakeException exception) {
            assertEquals("UNSUPPORTED_IMAGE_TYPE", exception.getCode());
        }

        assertFalse(new File(root, "ticket-1.original").exists());
        assertFalse(new File(root, "ticket-1.original.part").exists());
    }
}
