package com.newrred.moemoa;

import static org.junit.Assert.assertEquals;

import org.junit.Test;

public class PreviewSampleSizeTest {

    @Test
    public void keepsSmallImageAtFullDecodeSize() {
        assertEquals(1, PreviewSampleSize.forBounds(800, 600, 1024));
    }

    @Test
    public void choosesPowerOfTwoThatBoundsLargeImage() {
        assertEquals(4, PreviewSampleSize.forBounds(4000, 3000, 1024));
        assertEquals(2, PreviewSampleSize.forBounds(1920, 1080, 1024));
    }

    @Test(expected = IllegalArgumentException.class)
    public void rejectsMissingDecodeBounds() {
        PreviewSampleSize.forBounds(0, 1080, 1024);
    }
}
