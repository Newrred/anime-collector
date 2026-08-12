package com.newrred.moemoa;

final class PreviewSampleSize {
    private PreviewSampleSize() {}

    static int forBounds(int width, int height, int maxDimension) {
        if (width <= 0 || height <= 0 || maxDimension <= 0) {
            throw new IllegalArgumentException("Image bounds and max dimension must be positive");
        }

        int sampleSize = 1;
        while (width / sampleSize > maxDimension || height / sampleSize > maxDimension) {
            sampleSize *= 2;
        }
        return sampleSize;
    }
}
